import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import { logger } from './services/logger.js';
import { SkillService } from './services/skillService.js';
import { createJobQueue } from './jobs/queue.js';
import { CronScheduler } from './jobs/cronScheduler.js';
import { apiRateLimit, authRateLimit, sanitizeInput, securityHeaders } from './middleware/security.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import skillRoutes from './routes/skills.js';
import contentRoutes from './routes/content.js';
import trackingRoutes from './routes/tracking.js';
import llmRoutes from './routes/llm.js';
import auditRoutes from './routes/audit.js';
import snapshotRoutes from './routes/snapshots.js';
import alertRoutes from './routes/alerts.js';
import dashboardRoutes from './routes/dashboard.js';
import jobRoutes from './routes/jobs.js';

// ============================================================
// Init
// ============================================================

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

// Globale Services — einmal initialisieren, überall nutzen
const skillService = new SkillService(prisma);
const jobQueue = createJobQueue(prisma, skillService);

// Services an Request anhängen (kein DI-Framework nötig)
app.use((req, res, next) => {
  req.prisma = prisma;
  req.skillService = skillService;
  req.jobQueue = jobQueue;
  next();
});

// ============================================================
// Middleware
// ============================================================

app.use(helmet());
app.use(securityHeaders);
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(sanitizeInput);
app.use(apiRateLimit);
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ============================================================
// Routes
// ============================================================

app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/jobs', jobRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '6.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// Error Handler
// ============================================================

app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} — ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Interner Serverfehler'
      : err.message,
  });
});

// ============================================================
// Start
// ============================================================

async function start() {
  try {
    await prisma.$connect();
    logger.info('Datenbank verbunden');

    await skillService.warmCache();
    logger.info(`Skills geladen: ${skillService.cacheSize()} aktive Skills im Cache`);

    // Cronjobs starten
    const cronScheduler = new CronScheduler(prisma, jobQueue);
    cronScheduler.start();

    app.listen(PORT, () => {
      logger.info(`MEOS:SEO v6.0 läuft auf Port ${PORT}`);
    });

    // Für Graceful Shutdown merken
    app.locals.cronScheduler = cronScheduler;
  } catch (err) {
    logger.error('Startfehler:', err);
    process.exit(1);
  }
}

start();

// Graceful Shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM empfangen, fahre herunter...');
  if (app.locals.cronScheduler) app.locals.cronScheduler.stop();
  await jobQueue.close();
  await prisma.$disconnect();
  process.exit(0);
});
