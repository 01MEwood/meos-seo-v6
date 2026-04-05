import { AiService } from './aiService.js';
import { logger } from './logger.js';

const ai = new AiService();

/**
 * ContentPipeline — Orchestriert die 6-Stufen-Pipeline
 * 
 * Jede Stufe wird durch den Skill definiert.
 * Die Pipeline läuft asynchron als Job und reportet Progress.
 */
export class ContentPipeline {
  constructor(prisma, skillService) {
    this.prisma = prisma;
    this.skillService = skillService;
  }

  /**
   * Komplette Pipeline für eine Landingpage durchlaufen
   */
  async generateLandingpage({ region, service, skillSlug = 'landingpage', userId, jobId }) {
    const config = await this.skillService.resolve(skillSlug, {
      city: region,
      service: service || 'Dachschrägenschrank',
    });

    const brandConfig = await this.skillService.load('brand');
    const blacklistConfig = await this.skillService.load('blacklist');
    const qualityConfig = await this.skillService.load('quality');

    const stages = config.pipeline || [];
    const stageResults = {};
    let progress = 0;
    const progressStep = Math.floor(90 / Math.max(stages.length, 1));

    for (const stage of stages) {
      logger.info(`Pipeline [${jobId}]: Stage "${stage.stage}" gestartet`);

      try {
        switch (stage.stage) {
          case 'intelligence':
            stageResults.intelligence = await this.stageIntelligence(stage, region, service);
            break;

          case 'strategy':
            stageResults.strategy = await this.stageStrategy(stage, stageResults.intelligence, region, service);
            break;

          case 'rag':
            stageResults.rag = await this.stageRag(stage, region, service);
            break;

          case 'generation':
            stageResults.generation = await this.stageGeneration(
              stage, stageResults, region, service, brandConfig, config
            );
            break;

          case 'review':
            stageResults.review = await this.stageReview(
              stageResults.generation, blacklistConfig, qualityConfig, stage
            );
            break;

          case 'push':
            // Push wird separat ausgelöst — hier nur vorbereiten
            stageResults.push = {
              ready: true,
              target: stage.target,
              templateId: stage.templateId,
              bylineInjection: stage.bylineInjection,
            };
            break;

          default:
            logger.warn(`Unbekannte Pipeline-Stage: ${stage.stage}`);
        }
      } catch (err) {
        logger.error(`Pipeline [${jobId}]: Stage "${stage.stage}" fehlgeschlagen: ${err.message}`);
        stageResults[stage.stage] = { error: err.message };
      }

      progress += progressStep;

      // Job-Progress aktualisieren
      if (jobId) {
        await this.prisma.job.update({
          where: { id: jobId },
          data: {
            progress: Math.min(progress, 95),
            result: { stages: Object.keys(stageResults), currentStage: stage.stage },
          },
        });
      }
    }

    // Content-Datensatz erstellen
    const html = stageResults.generation?.html || '';
    const qualityScore = stageResults.review?.totalScore || 0;
    const minScore = qualityConfig?.minScore || 85;
    const status = qualityScore >= minScore ? 'APPROVED' : 'REVIEW';

    const content = await this.prisma.content.create({
      data: {
        type: 'LANDINGPAGE',
        status,
        title: `${service || 'Dachschrägenschrank'} ${region}`,
        region,
        service: service || 'Dachschrägenschrank',
        html,
        metadata: {
          seo: stageResults.strategy || {},
          intelligence: stageResults.intelligence || {},
          review: stageResults.review || {},
        },
        qualityScore,
        pipelineState: stageResults,
        skillUsed: skillSlug,
        createdById: userId,
      },
    });

    logger.info(`Pipeline [${jobId}]: Abgeschlossen — Content ${content.id} (Score: ${qualityScore}, Status: ${status})`);
    return content;
  }

  // ==========================================================
  // Einzelne Pipeline-Stufen
  // ==========================================================

  async stageIntelligence(stage, region, service) {
    const prompt = (stage.prompt || '')
      .replaceAll('{{city}}', region)
      .replaceAll('{{service}}', service || 'Dachschrägenschrank');

    if (stage.outputFormat === 'json') {
      return ai.completeJson(prompt);
    }
    const text = await ai.complete(prompt);
    return { analysis: text };
  }

  async stageStrategy(stage, intelligenceResult, region, service) {
    let prompt = (stage.prompt || '')
      .replaceAll('{{city}}', region)
      .replaceAll('{{service}}', service || 'Dachschrägenschrank');

    if (intelligenceResult) {
      prompt = `Kontext der vorherigen Analyse:\n${JSON.stringify(intelligenceResult)}\n\n${prompt}`;
    }

    return ai.completeJson(prompt);
  }

  async stageRag(stage, region, service) {
    // RAG-Phase: In v6.0 sammeln wir Kontext aus:
    // 1. Bestehende Inhalte auf schreinerhelden.de
    // 2. Google Reviews
    // 3. Wettbewerber-Seiten
    // TODO Iteration 3: Echte RAG-Implementation mit Embeddings
    return {
      sources: stage.sources || [],
      context: `Schreinerhelden ist ein Meisterbetrieb in Murrhardt-Fornsbach, spezialisiert auf maßgefertigte Einbaumöbel und Dachschrägenschränke. Liefergebiet: ${region} und Umgebung.`,
    };
  }

  async stageGeneration(stage, previousResults, region, service, brandConfig, pipelineConfig) {
    const strategy = previousResults.strategy || {};
    const rag = previousResults.rag || {};

    const systemPrompt = `Du bist ein SEO-Texter für Schreinerhelden, einen Meisterbetrieb für maßgefertigte Einbaumöbel.
Schreibe in Du-Ansprache. Vermeide: Lokalkolorit, einzigartig, ganzheitlich.
Firma: ${brandConfig.company}, Telefon: ${brandConfig.phone}, ${brandConfig.since}.
USPs: ${(brandConfig.usp || []).join(', ')}.
Preis: ${pipelineConfig.pricing || 'ab ca. 3.500 €'}.
Messung: ${pipelineConfig.measurement || '3D-Lasermessung'}.
Garantie: ${pipelineConfig.guarantee || 'Blum-Beschläge mit lebenslanger Garantie'}.`;

    let prompt = (stage.prompt || '')
      .replaceAll('{{city}}', region)
      .replaceAll('{{service}}', service || 'Dachschrägenschrank');

    if (strategy.mainKeyword) {
      prompt += `\n\nHauptkeyword: ${strategy.mainKeyword}`;
    }
    if (strategy.secondaryKeywords) {
      prompt += `\nNebenkeywords: ${strategy.secondaryKeywords.join(', ')}`;
    }
    if (rag.context) {
      prompt += `\n\nKontext:\n${rag.context}`;
    }

    const html = await ai.complete(prompt, { systemPrompt, maxTokens: 8000 });
    return { html };
  }

  async stageReview(generationResult, blacklistConfig, qualityConfig, stageConfig) {
    const html = generationResult?.html || '';

    // 1. Blacklist-Check
    const blacklistViolations = ai.checkBlacklist(html, blacklistConfig);

    // 2. Qualitäts-Scoring
    const qualityResult = await ai.scoreContent(html, qualityConfig);

    // 3. Ergebnis zusammenbauen
    const minScore = stageConfig?.minScore || qualityConfig?.minScore || 85;
    const passed = qualityResult.totalScore >= minScore && blacklistViolations.length === 0;

    return {
      passed,
      totalScore: qualityResult.totalScore,
      scores: qualityResult.scores,
      summary: qualityResult.summary,
      blacklistViolations,
      minScore,
    };
  }

  // ==========================================================
  // Blog-Artikel generieren
  // ==========================================================

  async generateBlogPost({ topic, skillSlug = 'blog', userId, jobId }) {
    const config = await this.skillService.resolve(skillSlug, { topic });
    const brandConfig = await this.skillService.load('brand');
    const blacklistConfig = await this.skillService.load('blacklist');
    const qualityConfig = await this.skillService.load('quality');

    const systemPrompt = `Du bist ein Blog-Autor für Schreinerhelden. Du-Ansprache. Mindestens 1.500 Wörter. Baue interne Links ein.`;

    const prompt = (config.prompt || '')
      .replaceAll('{{topic}}', topic);

    const html = await ai.complete(prompt, { systemPrompt, maxTokens: 8000 });

    const blacklistViolations = ai.checkBlacklist(html, blacklistConfig);
    const qualityResult = await ai.scoreContent(html, qualityConfig);

    const status = qualityResult.totalScore >= (config.autoPublishThreshold || 85)
      && blacklistViolations.length === 0
      && config.autoPublish
      ? 'APPROVED'
      : 'REVIEW';

    const content = await this.prisma.content.create({
      data: {
        type: 'BLOG',
        status,
        title: topic,
        html,
        qualityScore: qualityResult.totalScore,
        metadata: { review: qualityResult, blacklistViolations },
        skillUsed: skillSlug,
        createdById: userId,
      },
    });

    logger.info(`Blog erstellt: "${topic}" (Score: ${qualityResult.totalScore}, Status: ${status})`);
    return content;
  }
}
