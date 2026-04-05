import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Alle Skills-Routen erfordern Authentifizierung
router.use(authenticate);

// GET /api/skills — Alle Skills auflisten (alle Rollen sehen das)
router.get('/', async (req, res, next) => {
  try {
    const { category, active } = req.query;
    const filters = {};
    if (category) filters.category = category;
    if (active !== undefined) filters.isActive = active === 'true';
    const skills = await req.skillService.list(filters);
    res.json(skills);
  } catch (err) {
    next(err);
  }
});

// GET /api/skills/:slug — Einen Skill im Detail
router.get('/:slug', async (req, res, next) => {
  try {
    const skill = await req.skillService.getBySlug(req.params.slug);
    if (!skill) return res.status(404).json({ error: 'Skill nicht gefunden' });
    res.json(skill);
  } catch (err) {
    next(err);
  }
});

// POST /api/skills — Neuen Skill anlegen (nur Admin)
router.post('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { slug, name, category, description, config, dependsOn } = req.body;
    if (!slug || !name || !category || !config) {
      return res.status(400).json({
        error: 'slug, name, category und config sind erforderlich',
      });
    }

    const skill = await req.skillService.create({
      slug, name, category, description, config, dependsOn,
      userId: req.user.id,
    });

    await req.prisma.activity.create({
      data: {
        userId: req.user.id,
        action: 'skill_created',
        target: `skill:${slug}`,
      },
    });

    res.status(201).json(skill);
  } catch (err) {
    if (err.message.includes('existiert bereits') || err.message.includes('Slug darf nur')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// PUT /api/skills/:slug — Skill bearbeiten (nur Admin)
router.put('/:slug', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { config, name, description, dependsOn, note } = req.body;

    const skill = await req.skillService.update(req.params.slug, {
      config, name, description, dependsOn, note,
      userId: req.user.id,
    });

    await req.prisma.activity.create({
      data: {
        userId: req.user.id,
        action: 'skill_updated',
        target: `skill:${req.params.slug}`,
        details: { note, newVersion: skill.version },
      },
    });

    res.json(skill);
  } catch (err) {
    if (err.message.includes('nicht gefunden')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/skills/:slug — Skill löschen (nur Admin)
router.delete('/:slug', authorize('ADMIN'), async (req, res, next) => {
  try {
    await req.skillService.delete(req.params.slug);

    await req.prisma.activity.create({
      data: {
        userId: req.user.id,
        action: 'skill_deleted',
        target: `skill:${req.params.slug}`,
      },
    });

    res.json({ message: `Skill "${req.params.slug}" gelöscht` });
  } catch (err) {
    if (err.message.includes('nicht gefunden')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('kann nicht gelöscht werden')) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

// PATCH /api/skills/:slug/toggle — Skill aktivieren/deaktivieren (nur Admin)
router.patch('/:slug/toggle', authorize('ADMIN'), async (req, res, next) => {
  try {
    const skill = await req.skillService.toggleActive(req.params.slug);

    await req.prisma.activity.create({
      data: {
        userId: req.user.id,
        action: skill.isActive ? 'skill_activated' : 'skill_deactivated',
        target: `skill:${req.params.slug}`,
      },
    });

    res.json(skill);
  } catch (err) {
    next(err);
  }
});

// POST /api/skills/:slug/duplicate — Skill duplizieren (nur Admin)
router.post('/:slug/duplicate', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { newSlug } = req.body;
    if (!newSlug) {
      return res.status(400).json({ error: 'newSlug ist erforderlich' });
    }

    const skill = await req.skillService.duplicate(
      req.params.slug, newSlug, req.user.id
    );

    await req.prisma.activity.create({
      data: {
        userId: req.user.id,
        action: 'skill_duplicated',
        target: `skill:${newSlug}`,
        details: { duplicatedFrom: req.params.slug },
      },
    });

    res.status(201).json(skill);
  } catch (err) {
    next(err);
  }
});

// GET /api/skills/:slug/history — Versionsverlauf
router.get('/:slug/history', authorize('ADMIN'), async (req, res, next) => {
  try {
    const history = await req.skillService.getHistory(req.params.slug);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// POST /api/skills/:slug/rollback — Auf alte Version zurückrollen
router.post('/:slug/rollback', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { version } = req.body;
    if (!version) {
      return res.status(400).json({ error: 'version ist erforderlich' });
    }

    const skill = await req.skillService.rollback(
      req.params.slug, version, req.user.id
    );

    await req.prisma.activity.create({
      data: {
        userId: req.user.id,
        action: 'skill_rollback',
        target: `skill:${req.params.slug}`,
        details: { rolledBackToVersion: version },
      },
    });

    res.json(skill);
  } catch (err) {
    next(err);
  }
});

export default router;
