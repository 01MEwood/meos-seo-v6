import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);

// GET /api/audit/issues — Alle SEO-Issues
router.get('/issues', async (req, res, next) => {
  try {
    const { status, severity, limit = 100 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const issues = await req.prisma.seoIssue.findMany({
      where,
      orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
      take: parseInt(limit),
    });
    res.json(issues);
  } catch (err) { next(err); }
});

// POST /api/audit/run — One-Click: Audit starten
router.post('/run', authorize('ADMIN', 'POWERUSER'), async (req, res, next) => {
  try {
    const job = await req.prisma.job.create({
      data: {
        type: 'run_audit',
        payload: {},
        createdById: req.user.id,
        skillSlug: 'audit',
      },
    });
    await req.jobQueue.add('run-audit', { jobId: job.id });
    res.status(202).json({ message: 'Audit gestartet', jobId: job.id });
  } catch (err) { next(err); }
});

// POST /api/audit/autofix — One-Click: Auto-Fix starten
router.post('/autofix', authorize('ADMIN', 'POWERUSER'), async (req, res, next) => {
  try {
    const openIssues = await req.prisma.seoIssue.count({ where: { status: 'OPEN' } });
    if (openIssues === 0) {
      return res.json({ message: 'Keine offenen Issues' });
    }
    const job = await req.prisma.job.create({
      data: {
        type: 'run_autofix',
        payload: {},
        createdById: req.user.id,
        skillSlug: 'autofix',
      },
    });
    await req.jobQueue.add('run-audit', { jobId: job.id });
    res.status(202).json({ message: `Auto-Fix gestartet für ${openIssues} Issues`, jobId: job.id });
  } catch (err) { next(err); }
});

// PATCH /api/audit/issues/:id — Issue-Status ändern
router.patch('/issues/:id', authorize('ADMIN', 'POWERUSER'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const issue = await req.prisma.seoIssue.update({
      where: { id: req.params.id },
      data: { status, fixedAt: status === 'FIXED' ? new Date() : undefined },
    });
    res.json(issue);
  } catch (err) { next(err); }
});

export default router;
