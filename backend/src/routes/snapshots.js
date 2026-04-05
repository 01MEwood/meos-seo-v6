import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);

// GET /api/snapshots — Zeitschiene-Daten
router.get('/', async (req, res, next) => {
  try {
    const { type = 'DAILY', days = 90 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    const snapshots = await req.prisma.snapshot.findMany({
      where: { type, date: { gte: since } },
      orderBy: { date: 'asc' },
    });
    res.json(snapshots);
  } catch (err) { next(err); }
});

// GET /api/snapshots/trends — Aktuelle Trends
router.get('/trends', async (req, res, next) => {
  try {
    const trends = await req.jobQueue.services.snapshots.getTrends([7, 30, 90]);
    res.json(trends || { message: 'Noch keine Snapshots vorhanden' });
  } catch (err) { next(err); }
});

// GET /api/snapshots/region/:region — Region-Zeitverlauf
router.get('/region/:region', async (req, res, next) => {
  try {
    const { days = 90 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    const snapshots = await req.prisma.snapshot.findMany({
      where: { type: 'DAILY', date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, regionScores: true, totalScore: true },
    });

    const regionData = snapshots.map(s => ({
      date: s.date,
      score: s.regionScores?.[req.params.region] ?? null,
      totalScore: s.totalScore,
    }));

    res.json(regionData);
  } catch (err) { next(err); }
});

// POST /api/snapshots/create — Manuell Snapshot erstellen (Admin)
router.post('/create', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Nur Admin' });
    }
    const job = await req.prisma.job.create({
      data: { type: 'create_snapshot', payload: {}, createdById: req.user.id },
    });
    await req.jobQueue.add('create-snapshot', { jobId: job.id });
    res.status(202).json({ message: 'Snapshot wird erstellt', jobId: job.id });
  } catch (err) { next(err); }
});

export default router;
