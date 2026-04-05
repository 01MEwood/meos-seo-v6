import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);

// GET /api/tracking/keywords — Alle Keywords mit letzter Position
router.get('/keywords', async (req, res, next) => {
  try {
    const { region } = req.query;
    const where = { isActive: true };
    if (region) where.region = region;

    const keywords = await req.prisma.keyword.findMany({
      where,
      include: { positions: { orderBy: { date: 'desc' }, take: 2 } },
      orderBy: { keyword: 'asc' },
    });

    // Trend berechnen
    const enriched = keywords.map(k => {
      const current = k.positions[0]?.position ?? null;
      const previous = k.positions[1]?.position ?? null;
      const change = current && previous ? previous - current : 0;
      return {
        ...k,
        currentPosition: current,
        previousPosition: previous,
        change,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      };
    });

    res.json(enriched);
  } catch (err) { next(err); }
});

// GET /api/tracking/keywords/:id/history — Positionsverlauf eines Keywords
router.get('/keywords/:id/history', async (req, res, next) => {
  try {
    const { days = 90 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    const positions = await req.prisma.keywordPosition.findMany({
      where: { keywordId: req.params.id, date: { gte: since } },
      orderBy: { date: 'asc' },
    });
    res.json(positions);
  } catch (err) { next(err); }
});

// POST /api/tracking/keywords — Neues Keyword hinzufügen
router.post('/keywords', authorize('ADMIN', 'POWERUSER'), async (req, res, next) => {
  try {
    const { keyword, region, service } = req.body;
    if (!keyword || !region) {
      return res.status(400).json({ error: 'keyword und region erforderlich' });
    }
    const created = await req.prisma.keyword.create({
      data: { keyword, region, service },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Keyword+Region existiert bereits' });
    }
    next(err);
  }
});

export default router;
