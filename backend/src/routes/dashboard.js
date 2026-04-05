import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);

// GET /api/dashboard — Alle KPIs + Trends auf einen Blick
router.get('/', async (req, res, next) => {
  try {
    // Letzten Snapshot laden
    const latest = await req.prisma.snapshot.findFirst({
      where: { type: 'DAILY' },
      orderBy: { date: 'desc' },
    });

    // Vorwoche laden (7 Tage zurück)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const lastWeek = await req.prisma.snapshot.findFirst({
      where: { type: 'DAILY', date: { lte: weekAgo } },
      orderBy: { date: 'desc' },
    });

    // Vormonat laden
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const lastMonth = await req.prisma.snapshot.findFirst({
      where: { type: 'DAILY', date: { lte: monthAgo } },
      orderBy: { date: 'desc' },
    });

    // Offene Issues
    const openIssues = await req.prisma.seoIssue.count({
      where: { status: 'OPEN' },
    });
    const criticalIssues = await req.prisma.seoIssue.count({
      where: { status: 'OPEN', severity: 'CRITICAL' },
    });

    // Ungelesene Alerts
    const unreadAlerts = await req.prisma.alert.count({
      where: { isRead: false },
    });

    // Laufende Jobs
    const runningJobs = await req.prisma.job.count({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
    });

    // Trend berechnen
    const trend = (current, previous) => {
      if (!current || !previous) return { change: 0, direction: 'flat' };
      const diff = Math.round((current - previous) * 10) / 10;
      return {
        change: diff,
        direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
      };
    };

    res.json({
      scores: {
        seo: latest?.seoScore ?? 0,
        aeo: latest?.aeoScore ?? 0,
        geo: latest?.geoScore ?? 0,
        total: latest?.totalScore ?? 0,
      },
      trends: {
        vsWeek: {
          seo: trend(latest?.seoScore, lastWeek?.seoScore),
          aeo: trend(latest?.aeoScore, lastWeek?.aeoScore),
          geo: trend(latest?.geoScore, lastWeek?.geoScore),
          total: trend(latest?.totalScore, lastWeek?.totalScore),
        },
        vsMonth: {
          seo: trend(latest?.seoScore, lastMonth?.seoScore),
          aeo: trend(latest?.aeoScore, lastMonth?.aeoScore),
          geo: trend(latest?.geoScore, lastMonth?.geoScore),
          total: trend(latest?.totalScore, lastMonth?.totalScore),
        },
      },
      overview: {
        openIssues,
        criticalIssues,
        unreadAlerts,
        runningJobs,
        pagesIndexed: latest?.pagesIndexed ?? 0,
        keywordsInTop3: latest?.keywordsInTop3 ?? 0,
        keywordsInTop10: latest?.keywordsInTop10 ?? 0,
        llmMentionsTotal: latest?.llmMentionsTotal ?? 0,
        shareOfVoice: latest?.shareOfVoice ?? 0,
        contentPublished: latest?.contentPublished ?? 0,
      },
      regionScores: latest?.regionScores ?? {},
      snapshotDate: latest?.date ?? null,
    });
  } catch (err) { next(err); }
});

export default router;
