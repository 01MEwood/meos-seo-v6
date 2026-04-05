import { logger } from './logger.js';

/**
 * SnapshotService — Erstellt Zeitschiene-Snapshots
 * 
 * Läuft als Cronjob (täglich 03:00) und aggregiert alle Metriken.
 * Konfiguration kommt aus dem timeline.skill.
 */
export class SnapshotService {
  constructor(prisma, skillService) {
    this.prisma = prisma;
    this.skillService = skillService;
  }

  /**
   * Täglichen Snapshot erstellen
   */
  async createDailySnapshot() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Prüfen ob heute schon ein Snapshot existiert
    const existing = await this.prisma.snapshot.findFirst({
      where: { date: today, type: 'DAILY' },
    });
    if (existing) {
      logger.info('Snapshot: Heutiger Snapshot existiert bereits');
      return existing;
    }

    // Metriken aggregieren
    const seoMetrics = await this.aggregateSeoMetrics();
    const aeoMetrics = await this.aggregateAeoMetrics();
    const geoMetrics = await this.aggregateGeoMetrics();
    const contentMetrics = await this.aggregateContentMetrics();

    // Scores berechnen
    const seoScore = this.calculateSeoScore(seoMetrics);
    const aeoScore = this.calculateAeoScore(aeoMetrics);
    const geoScore = this.calculateGeoScore(geoMetrics);
    const totalScore = Math.round(seoScore * 0.4 + aeoScore * 0.3 + geoScore * 0.3);

    // Region-Scores berechnen
    const regionScores = await this.calculateRegionScores();

    const snapshot = await this.prisma.snapshot.create({
      data: {
        date: today,
        type: 'DAILY',
        seoScore,
        aeoScore,
        geoScore,
        totalScore,
        // SEO
        avgKeywordPosition: seoMetrics.avgPosition,
        keywordsInTop3: seoMetrics.inTop3,
        keywordsInTop10: seoMetrics.inTop10,
        keywordsTracked: seoMetrics.tracked,
        pagesIndexed: seoMetrics.pagesIndexed,
        issuesOpen: seoMetrics.issuesOpen,
        issuesFixed: seoMetrics.issuesFixed,
        schemaHealth: seoMetrics.schemaHealth,
        // AEO
        featuredSnippets: aeoMetrics.snippets,
        aiOverviews: aeoMetrics.aiOverviews,
        faqCoverage: aeoMetrics.faqCoverage,
        // GEO
        llmMentionsTotal: geoMetrics.total,
        llmMentionsPositive: geoMetrics.positive,
        llmMentionsNeutral: geoMetrics.neutral,
        llmMentionsNegative: geoMetrics.negative,
        shareOfVoice: geoMetrics.shareOfVoice,
        // Content
        contentPublished: contentMetrics.totalPublished,
        contentNewThisPeriod: contentMetrics.newToday,
        avgQualityScore: contentMetrics.avgQuality,
        // Details
        regionScores,
      },
    });

    // Alerts prüfen
    await this.checkAlerts(snapshot);

    logger.info(`Snapshot erstellt: ${today.toISOString().split('T')[0]} (Total: ${totalScore})`);
    return snapshot;
  }

  // ==========================================================
  // Metrik-Aggregation
  // ==========================================================

  async aggregateSeoMetrics() {
    // Letzte Keyword-Positionen
    const keywords = await this.prisma.keyword.findMany({
      where: { isActive: true },
      include: {
        positions: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    const positions = keywords
      .map(k => k.positions[0]?.position)
      .filter(p => p !== null && p !== undefined);

    const avgPosition = positions.length
      ? Math.round((positions.reduce((s, p) => s + p, 0) / positions.length) * 10) / 10
      : 0;

    const issuesOpen = await this.prisma.seoIssue.count({ where: { status: 'OPEN' } });
    const issuesFixed = await this.prisma.seoIssue.count({ where: { status: 'FIXED' } });

    return {
      avgPosition,
      inTop3: positions.filter(p => p <= 3).length,
      inTop10: positions.filter(p => p <= 10).length,
      tracked: keywords.length,
      pagesIndexed: await this.prisma.content.count({ where: { status: 'PUBLISHED' } }),
      issuesOpen,
      issuesFixed,
      schemaHealth: 0, // TODO Iteration 3
    };
  }

  async aggregateAeoMetrics() {
    // Featured Snippets und AI Overviews aus den letzten Keyword-Positionen
    const recentPositions = await this.prisma.keywordPosition.findMany({
      where: {
        date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    return {
      snippets: recentPositions.filter(p => p.hasSnippet).length,
      aiOverviews: recentPositions.filter(p => p.hasAiOverview).length,
      faqCoverage: 0, // TODO: FAQ-Abdeckung berechnen
    };
  }

  async aggregateGeoMetrics() {
    // LLM-Ergebnisse der letzten 7 Tage
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const results = await this.prisma.llmResult.findMany({
      where: { date: { gte: weekAgo } },
    });

    const mentioned = results.filter(r => r.mentioned);
    const total = mentioned.length;
    const positive = mentioned.filter(r => r.sentiment === 'POSITIVE').length;
    const neutral = mentioned.filter(r => r.sentiment === 'NEUTRAL').length;
    const negative = mentioned.filter(r => r.sentiment === 'NEGATIVE').length;

    // Share-of-Voice: wie oft werden WIR erwähnt vs. Wettbewerber?
    const allMentioned = results.length;
    const shareOfVoice = allMentioned > 0
      ? Math.round((total / allMentioned) * 100)
      : 0;

    return { total, positive, neutral, negative, shareOfVoice };
  }

  async aggregateContentMetrics() {
    const totalPublished = await this.prisma.content.count({ where: { status: 'PUBLISHED' } });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = await this.prisma.content.count({
      where: { publishedAt: { gte: today } },
    });

    const avgResult = await this.prisma.content.aggregate({
      where: { qualityScore: { not: null } },
      _avg: { qualityScore: true },
    });

    return {
      totalPublished,
      newToday,
      avgQuality: avgResult._avg.qualityScore
        ? Math.round(avgResult._avg.qualityScore)
        : null,
    };
  }

  // ==========================================================
  // Score-Berechnung
  // ==========================================================

  calculateSeoScore(metrics) {
    let score = 50; // Basis
    if (metrics.avgPosition > 0 && metrics.avgPosition <= 3) score += 30;
    else if (metrics.avgPosition <= 10) score += 20;
    else if (metrics.avgPosition <= 20) score += 10;
    if (metrics.inTop3 > 5) score += 10;
    if (metrics.issuesOpen === 0) score += 10;
    else if (metrics.issuesOpen < 5) score += 5;
    return Math.min(Math.max(Math.round(score), 0), 100);
  }

  calculateAeoScore(metrics) {
    let score = 30;
    score += Math.min(metrics.snippets * 10, 30);
    score += Math.min(metrics.aiOverviews * 5, 20);
    score += (metrics.faqCoverage || 0) * 0.2;
    return Math.min(Math.max(Math.round(score), 0), 100);
  }

  calculateGeoScore(metrics) {
    let score = 20;
    score += Math.min(metrics.total * 5, 30);
    if (metrics.total > 0) {
      const positiveRatio = metrics.positive / metrics.total;
      score += Math.round(positiveRatio * 30);
    }
    score += Math.min(metrics.shareOfVoice * 0.2, 20);
    return Math.min(Math.max(Math.round(score), 0), 100);
  }

  // ==========================================================
  // Region-Scores
  // ==========================================================

  async calculateRegionScores() {
    const regions = await this.prisma.keyword.findMany({
      where: { isActive: true },
      select: { region: true },
      distinct: ['region'],
    });

    const scores = {};
    for (const { region } of regions) {
      const keywords = await this.prisma.keyword.findMany({
        where: { region, isActive: true },
        include: {
          positions: { orderBy: { date: 'desc' }, take: 1 },
        },
      });

      const positions = keywords
        .map(k => k.positions[0]?.position)
        .filter(p => p !== null && p !== undefined);

      const avgPos = positions.length
        ? positions.reduce((s, p) => s + p, 0) / positions.length
        : 100;

      // Score: Position 1 = 100, Position 50+ = 0
      scores[region] = Math.max(0, Math.round(100 - (avgPos - 1) * 2));
    }

    return scores;
  }

  // ==========================================================
  // Alert-Prüfung
  // ==========================================================

  async checkAlerts(snapshot) {
    let timelineConfig;
    try {
      timelineConfig = await this.skillService.load('timeline');
    } catch {
      return; // Kein timeline-Skill → keine Alerts
    }

    const alertConfig = timelineConfig.alerts || {};

    // Vorwoche laden
    const weekAgo = new Date(snapshot.date);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const lastWeek = await this.prisma.snapshot.findFirst({
      where: { type: 'DAILY', date: { lte: weekAgo } },
      orderBy: { date: 'desc' },
    });

    if (!lastWeek) return;

    // Score-Drop prüfen
    const scoreDrop = lastWeek.totalScore - snapshot.totalScore;
    if (scoreDrop >= (alertConfig.scoreDrop?.pointsPerWeek || 10)) {
      await this.createAlert({
        type: 'DROP',
        severity: alertConfig.scoreDrop?.severity || 'WARNING',
        metric: 'score_total',
        title: `Gesamt-Score gefallen: ${lastWeek.totalScore} → ${snapshot.totalScore}`,
        message: `Der Gesamt-Score ist in einer Woche um ${scoreDrop} Punkte gefallen.`,
        details: { from: lastWeek.totalScore, to: snapshot.totalScore, change: -scoreDrop },
      });
    }

    // Meilensteine prüfen
    const milestones = alertConfig.milestones || [50, 60, 70, 80, 90];
    for (const milestone of milestones) {
      if (snapshot.totalScore >= milestone && lastWeek.totalScore < milestone) {
        await this.createAlert({
          type: 'MILESTONE',
          severity: 'INFO',
          metric: 'score_total',
          title: `Meilenstein erreicht: Score ${milestone}!`,
          message: `Der Gesamt-Score hat die Marke von ${milestone} überschritten.`,
          details: { milestone, score: snapshot.totalScore },
        });
      }
    }
  }

  async createAlert({ type, severity, metric, title, message, details }) {
    await this.prisma.alert.create({
      data: { type, severity, metric, title, message, details },
    });
    logger.info(`Alert erstellt: [${severity}] ${title}`);
  }

  // ==========================================================
  // Trend-Vergleich
  // ==========================================================

  async getTrends(comparisonDays = [7, 30, 90]) {
    const latest = await this.prisma.snapshot.findFirst({
      where: { type: 'DAILY' },
      orderBy: { date: 'desc' },
    });
    if (!latest) return null;

    const trends = {};
    for (const days of comparisonDays) {
      const compareDate = new Date(latest.date);
      compareDate.setDate(compareDate.getDate() - days);

      const compareSnapshot = await this.prisma.snapshot.findFirst({
        where: { type: 'DAILY', date: { lte: compareDate } },
        orderBy: { date: 'desc' },
      });

      if (compareSnapshot) {
        trends[`${days}d`] = {
          seo: Math.round((latest.seoScore - compareSnapshot.seoScore) * 10) / 10,
          aeo: Math.round((latest.aeoScore - compareSnapshot.aeoScore) * 10) / 10,
          geo: Math.round((latest.geoScore - compareSnapshot.geoScore) * 10) / 10,
          total: Math.round((latest.totalScore - compareSnapshot.totalScore) * 10) / 10,
        };
      }
    }

    return { current: latest, trends };
  }

  // ==========================================================
  // Retention: Alte Snapshots aggregieren/löschen
  // ==========================================================

  async applyRetention() {
    let timelineConfig;
    try {
      timelineConfig = await this.skillService.load('timeline');
    } catch {
      return;
    }

    const retention = timelineConfig.retention || {};

    // Daily: 90 Tage behalten
    if (retention.daily) {
      const days = parseInt(retention.daily, 10) || 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const deleted = await this.prisma.snapshot.deleteMany({
        where: { type: 'DAILY', date: { lt: cutoff } },
      });
      if (deleted.count > 0) {
        logger.info(`Retention: ${deleted.count} tägliche Snapshots älter als ${days} Tage gelöscht`);
      }
    }

    // Weekly: 1 Jahr behalten
    if (retention.weekly && retention.weekly !== 'forever') {
      const days = retention.weekly === '1y' ? 365 : parseInt(retention.weekly, 10) || 365;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const deleted = await this.prisma.snapshot.deleteMany({
        where: { type: 'WEEKLY', date: { lt: cutoff } },
      });
      if (deleted.count > 0) {
        logger.info(`Retention: ${deleted.count} wöchentliche Snapshots gelöscht`);
      }
    }
  }
}
