import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);

// GET /api/alerts — Alle Alerts (neueste zuerst)
router.get('/', async (req, res, next) => {
  try {
    const { unreadOnly, severity, limit = 50 } = req.query;
    const where = {};
    if (unreadOnly === 'true') where.isRead = false;
    if (severity) where.severity = severity;

    const alerts = await req.prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });
    res.json(alerts);
  } catch (err) { next(err); }
});

// PATCH /api/alerts/:id/read — Alert als gelesen markieren
router.patch('/:id/read', async (req, res, next) => {
  try {
    const alert = await req.prisma.alert.update({
      where: { id: req.params.id },
      data: { isRead: true, readAt: new Date(), readById: req.user.id },
    });
    res.json(alert);
  } catch (err) { next(err); }
});

// PATCH /api/alerts/read-all — Alle Alerts als gelesen markieren
router.patch('/read-all', async (req, res, next) => {
  try {
    await req.prisma.alert.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date(), readById: req.user.id },
    });
    res.json({ message: 'Alle Alerts als gelesen markiert' });
  } catch (err) { next(err); }
});

export default router;
