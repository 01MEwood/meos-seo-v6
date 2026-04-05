import { logger } from './logger.js';

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN || '';
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD || '';

/**
 * DataForSeoService — SERP-Tracking über DataForSEO API
 * 
 * Trackt Keyword-Positionen für alle 18 Regionen.
 * Erkennt Featured Snippets und AI Overviews.
 */
export class DataForSeoService {
  constructor(prisma) {
    this.prisma = prisma;
    this.authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');
    this.baseUrl = 'https://api.dataforseo.com/v3';
  }

  /**
   * Alle aktiven Keywords tracken
   */
  async trackAllKeywords(jobId) {
    const keywords = await this.prisma.keyword.findMany({
      where: { isActive: true },
    });

    logger.info(`DataForSEO: Tracking ${keywords.length} Keywords`);

    // In Batches von 3 verarbeiten (Rate-Limit)
    const batchSize = 3;
    let processed = 0;

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(kw => this.trackKeyword(kw))
      );

      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          const data = results[j].value;
          await this.prisma.keywordPosition.create({
            data: {
              keywordId: batch[j].id,
              position: data.position,
              url: data.url,
              searchVolume: data.searchVolume,
              difficulty: data.difficulty,
              hasSnippet: data.hasSnippet,
              hasAiOverview: data.hasAiOverview,
            },
          });
        } else {
          logger.warn(`DataForSEO-Fehler für "${batch[j].keyword}": ${results[j].reason}`);
        }
        processed++;
      }

      if (jobId) {
        const progress = Math.round((processed / keywords.length) * 90);
        await this.prisma.job.update({
          where: { id: jobId },
          data: { progress: Math.min(progress, 95) },
        });
      }

      // Rate-Limit: 1s Pause zwischen Batches
      if (i + batchSize < keywords.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    logger.info(`DataForSEO: ${processed} Keywords getrackt`);
    return { tracked: processed, total: keywords.length };
  }

  /**
   * Einzelnes Keyword bei DataForSEO abfragen
   */
  async trackKeyword(keyword) {
    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
      // Fallback: Dummy-Daten im Dev-Modus
      return this.dummyResult(keyword);
    }

    try {
      // SERP-Abfrage erstellen
      const taskResponse = await fetch(`${this.baseUrl}/serp/google/organic/live/advanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.authHeader,
        },
        body: JSON.stringify([{
          keyword: keyword.keyword,
          location_name: 'Germany',
          language_name: 'German',
          device: 'desktop',
          os: 'windows',
          depth: 30,
        }]),
        signal: AbortSignal.timeout(30000),
      });

      if (!taskResponse.ok) {
        throw new Error(`API ${taskResponse.status}`);
      }

      const data = await taskResponse.json();
      const task = data?.tasks?.[0];

      if (task?.status_code !== 20000) {
        throw new Error(task?.status_message || 'Unknown error');
      }

      const items = task.result?.[0]?.items || [];
      const searchInfo = task.result?.[0]?.search_information || {};

      // Schreinerhelden finden
      let position = null;
      let url = null;
      let hasSnippet = false;
      let hasAiOverview = false;

      for (const item of items) {
        // Featured Snippet prüfen
        if (item.type === 'featured_snippet') {
          if (item.url?.includes('schreinerhelden')) {
            hasSnippet = true;
            position = position || 0; // Position 0 = Snippet
            url = url || item.url;
          }
        }

        // AI Overview prüfen
        if (item.type === 'ai_overview') {
          const text = JSON.stringify(item).toLowerCase();
          if (text.includes('schreinerhelden')) {
            hasAiOverview = true;
          }
        }

        // Organische Position
        if (item.type === 'organic' && item.url?.includes('schreinerhelden')) {
          position = position || item.rank_absolute;
          url = url || item.url;
        }
      }

      return {
        position,
        url,
        searchVolume: task.result?.[0]?.keyword_info?.search_volume || null,
        difficulty: task.result?.[0]?.keyword_info?.keyword_difficulty || null,
        hasSnippet,
        hasAiOverview,
      };
    } catch (err) {
      logger.warn(`DataForSEO-Abfrage fehlgeschlagen für "${keyword.keyword}": ${err.message}`);
      throw err;
    }
  }

  /**
   * Dummy-Ergebnis für Entwicklung ohne API-Key
   */
  dummyResult(keyword) {
    const region = keyword.region || 'Stuttgart';
    // Regionen näher an Murrhardt → bessere Position
    const nearRegions = ['Backnang', 'Murrhardt', 'Winnenden', 'Waiblingen', 'Schorndorf'];
    const isNear = nearRegions.includes(region);

    return {
      position: isNear ? Math.floor(Math.random() * 10) + 1 : Math.floor(Math.random() * 30) + 5,
      url: `https://schreinerhelden.de/${keyword.service?.toLowerCase() || 'schreiner'}-${region.toLowerCase()}/`,
      searchVolume: Math.floor(Math.random() * 500) + 50,
      difficulty: Math.round(Math.random() * 60 + 20),
      hasSnippet: Math.random() > 0.8,
      hasAiOverview: Math.random() > 0.7,
    };
  }
}
