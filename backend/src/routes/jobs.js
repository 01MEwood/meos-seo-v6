import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);

// GET /api/jobs — Alle Jobs (neueste zuerst)
router.get('/', async (req, res, next) => {
  try {
    const { status, type, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const jobs = await req.prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      include: { createdBy: { select: { name: true } } },
    });
    res.json(jobs);
  } catch (err) { next(err); }
});

// GET /api/jobs/:id — Job-Details + Progress
router.get('/:id', async (req, res, next) => {
  try {
    const job = await req.prisma.job.findUnique({
      where: { id: req.params.id },
      include: { createdBy: { select: { name: true } } },
    });
    if (!job) return res.status(404).json({ error: 'Job nicht gefunden' });
    res.json(job);
  } catch (err) { next(err); }
});

export default router;
