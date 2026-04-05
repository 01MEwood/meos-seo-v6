import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);

// GET /api/content — Liste aller Content-Stücke
router.get('/', async (req, res, next) => {
  try {
    const { type, status, region } = req.query;
    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (region) where.region = region;
    // Redakteur sieht nur eigene Drafts
    if (req.user.role === 'REDAKTEUR') where.createdById = req.user.id;

    const content = await req.prisma.content.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { createdBy: { select: { name: true } } },
    });
    res.json(content);
  } catch (err) { next(err); }
});

// POST /api/content/generate — One-Click: Landingpage/Blog generieren
router.post('/generate', authorize('ADMIN', 'POWERUSER'), async (req, res, next) => {
  try {
    const { type, region, service, skillSlug } = req.body;
    // Job in die Queue stellen
    const job = await req.prisma.job.create({
      data: {
        type: `generate_${type?.toLowerCase() || 'landingpage'}`,
        payload: { region, service, skillSlug: skillSlug || 'landingpage' },
        createdById: req.user.id,
        skillSlug: skillSlug || 'landingpage',
      },
    });
    await req.jobQueue.add('generate-content', { jobId: job.id });
    res.status(202).json({ message: 'Content-Generierung gestartet', jobId: job.id });
  } catch (err) { next(err); }
});

// PUT /api/content/:id — Content bearbeiten
router.put('/:id', async (req, res, next) => {
  try {
    const { html, metadata, title, status } = req.body;
    const data = {};
    if (html !== undefined) data.html = html;
    if (metadata !== undefined) data.metadata = metadata;
    if (title !== undefined) data.title = title;
    // Redakteur darf nur auf DRAFT/REVIEW setzen
    if (status) {
      if (req.user.role === 'REDAKTEUR' && !['DRAFT', 'REVIEW'].includes(status)) {
        return res.status(403).json({ error: 'Redakteur kann nur Entwürfe und Reviews setzen' });
      }
      data.status = status;
    }
    const content = await req.prisma.content.update({ where: { id: req.params.id }, data });
    res.json(content);
  } catch (err) { next(err); }
});

// POST /api/content/:id/publish — One-Click: An WordPress publishen
router.post('/:id/publish', authorize('ADMIN', 'POWERUSER'), async (req, res, next) => {
  try {
    const job = await req.prisma.job.create({
      data: {
        type: 'publish_content',
        payload: { contentId: req.params.id },
        createdById: req.user.id,
      },
    });
    await req.jobQueue.add('publish-content', { jobId: job.id });
    res.status(202).json({ message: 'Publishing gestartet', jobId: job.id });
  } catch (err) { next(err); }
});

export default router;
