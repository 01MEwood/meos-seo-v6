import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);

// GET /api/llm/results — LLM-Tracking-Ergebnisse
router.get('/results', async (req, res, next) => {
  try {
    const { llm, days = 7 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    const where = { date: { gte: since } };
    if (llm) where.llm = llm;

    const results = await req.prisma.llmResult.findMany({
      where,
      include: { prompt: { select: { prompt: true, region: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    });
    res.json(results);
  } catch (err) { next(err); }
});

// GET /api/llm/share-of-voice — Share-of-Voice vs. Wettbewerber
router.get('/share-of-voice', async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const sov = await req.jobQueue.services.llmTracker.getShareOfVoice(parseInt(days));
    res.json(sov);
  } catch (err) { next(err); }
});

// POST /api/llm/track — One-Click: LLM-Tracking starten
router.post('/track', authorize('ADMIN', 'POWERUSER'), async (req, res, next) => {
  try {
    const job = await req.prisma.job.create({
      data: {
        type: 'track_llm',
        payload: {},
        createdById: req.user.id,
      },
    });
    await req.jobQueue.add('track-llm', { jobId: job.id });
    res.status(202).json({ message: 'LLM-Tracking gestartet', jobId: job.id });
  } catch (err) { next(err); }
});

// GET /api/llm/prompts — Tracking-Prompts verwalten
router.get('/prompts', async (req, res, next) => {
  try {
    const prompts = await req.prisma.llmPrompt.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(prompts);
  } catch (err) { next(err); }
});

// POST /api/llm/prompts — Neuen Tracking-Prompt hinzufügen
router.post('/prompts', authorize('ADMIN', 'POWERUSER'), async (req, res, next) => {
  try {
    const { prompt, region, service } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt ist erforderlich' });
    const created = await req.prisma.llmPrompt.create({
      data: { prompt, region, service },
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// DELETE /api/llm/prompts/:id
router.delete('/prompts/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    await req.prisma.llmPrompt.delete({ where: { id: req.params.id } });
    res.json({ message: 'Prompt gelöscht' });
  } catch (err) { next(err); }
});

export default router;
