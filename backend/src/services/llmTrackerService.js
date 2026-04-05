import { AiService } from './aiService.js';
import { logger } from './logger.js';

const ai = new AiService();

/**
 * LlmTrackerService — GEO-Sichtbarkeit tracken
 * 
 * Simuliert Prompts bei ChatGPT, Claude, Perplexity, Gemini, Grok
 * und prüft ob Schreinerhelden erwähnt wird, mit welchem Sentiment,
 * und wie die Share-of-Voice vs. Wettbewerber aussieht.
 */
export class LlmTrackerService {
  constructor(prisma, skillService) {
    this.prisma = prisma;
    this.skillService = skillService;
  }

  /**
   * Alle aktiven Prompts bei allen LLMs tracken
   */
  async runFullTrack(jobId) {
    const trackerConfig = await this.skillService.load('tracker');
    const sentimentConfig = await this.skillService.load('sentiment');
    const competitorConfig = await this.skillService.load('competitor');

    const prompts = await this.prisma.llmPrompt.findMany({
      where: { isActive: true },
    });

    const llms = trackerConfig.llms || ['CHATGPT'];
    const competitors = (competitorConfig.competitors || []).map(c => c.name);
    let processed = 0;

    for (const prompt of prompts) {
      for (const llm of llms) {
        try {
          const result = await this.trackSinglePrompt(prompt, llm, competitors, sentimentConfig);

          await this.prisma.llmResult.create({
            data: {
              promptId: prompt.id,
              llm,
              mentioned: result.mentioned,
              sentiment: result.sentiment,
              response: result.response?.slice(0, 5000),
              position: result.position,
              citedUrl: result.citedUrl,
              competitorsMentioned: result.competitorsMentioned,
            },
          });

          processed++;
        } catch (err) {
          logger.warn(`LLM-Track fehlgeschlagen (${llm}, prompt ${prompt.id}): ${err.message}`);
        }
      }

      // Progress aktualisieren
      if (jobId) {
        const progress = Math.round((processed / (prompts.length * llms.length)) * 100);
        await this.prisma.job.update({
          where: { id: jobId },
          data: { progress: Math.min(progress, 95) },
        });
      }
    }

    logger.info(`LLM-Tracking abgeschlossen: ${processed} Prompt-LLM-Kombinationen verarbeitet`);
    return { processed, prompts: prompts.length, llms: llms.length };
  }

  /**
   * Einen Prompt bei einem LLM prüfen
   * 
   * In v6.0 nutzen wir GPT-4o als Proxy um zu simulieren, wie
   * verschiedene LLMs antworten würden. In einer späteren Version
   * können echte API-Calls an jedes LLM gemacht werden.
   */
  async trackSinglePrompt(prompt, llm, competitors, sentimentConfig) {
    // GPT-4o als Simulator nutzen
    const simulationPrompt = `Simuliere wie ${llm} auf folgende Frage antworten würde.
Beantworte die Frage so, wie ${llm} es tun würde — mit Empfehlungen, Firmen, und Begründungen.
Die Antwort soll realistisch sein.

Frage: "${prompt.prompt}"

Antworte als JSON:
{
  "response": "Die vollständige simulierte Antwort",
  "mentionedBrands": ["Liste", "aller", "erwähnten", "Firmen"],
  "topRecommendation": "Name der erstgenannten/empfohlenen Firma"
}`;

    const simResult = await ai.completeJson(simulationPrompt, { temperature: 0.8 });

    const response = simResult.response || '';
    const mentionedBrands = simResult.mentionedBrands || [];

    // Schreinerhelden-Check
    const mentioned = response.toLowerCase().includes('schreinerhelden')
      || mentionedBrands.some(b => b.toLowerCase().includes('schreinerhelden'));

    // Position bestimmen
    let position = null;
    if (mentioned) {
      const brands = mentionedBrands.map(b => b.toLowerCase());
      const idx = brands.findIndex(b => b.includes('schreinerhelden'));
      position = idx >= 0 ? idx + 1 : null;
    }

    // Sentiment analysieren
    let sentiment = null;
    if (mentioned) {
      sentiment = await this.analyzeSentiment(response, sentimentConfig);
    }

    // Wettbewerber-Erwähnungen
    const competitorsMentioned = competitors.filter(comp =>
      response.toLowerCase().includes(comp.toLowerCase())
    );

    return {
      mentioned,
      sentiment,
      response,
      position,
      citedUrl: null,
      competitorsMentioned,
    };
  }

  /**
   * Sentiment einer LLM-Antwort bezüglich Schreinerhelden bewerten
   */
  async analyzeSentiment(response, sentimentConfig) {
    // Schnell-Check über Keywords
    const lowerResponse = response.toLowerCase();
    const positiveHits = (sentimentConfig.positiveSignals || [])
      .filter(s => lowerResponse.includes(s.toLowerCase())).length;
    const negativeHits = (sentimentConfig.negativeSignals || [])
      .filter(s => lowerResponse.includes(s.toLowerCase())).length;

    // Bei klarem Signal: direkt zurückgeben
    if (positiveHits > negativeHits + 1) return 'POSITIVE';
    if (negativeHits > positiveHits + 1) return 'NEGATIVE';

    // Bei Unsicherheit: GPT-4o fragen
    const prompt = sentimentConfig.analysisPrompt
      ? sentimentConfig.analysisPrompt + `\n\nAntwort:\n${response.slice(0, 3000)}`
      : `Bewerte: Ist die Erwähnung von "Schreinerhelden" in folgendem Text positiv, neutral oder negativ?\n\n${response.slice(0, 3000)}\n\nAntwort als JSON: {"sentiment": "POSITIVE|NEUTRAL|NEGATIVE"}`;

    try {
      const result = await ai.completeJson(prompt);
      return result.sentiment || 'NEUTRAL';
    } catch {
      return 'NEUTRAL';
    }
  }

  /**
   * Share-of-Voice berechnen für einen Zeitraum
   */
  async getShareOfVoice(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const results = await this.prisma.llmResult.findMany({
      where: { date: { gte: since } },
    });

    const totalPrompts = results.length;
    const ourMentions = results.filter(r => r.mentioned).length;

    // Wettbewerber-Erwähnungen aggregieren
    const competitorCounts = {};
    for (const r of results) {
      for (const comp of (r.competitorsMentioned || [])) {
        competitorCounts[comp] = (competitorCounts[comp] || 0) + 1;
      }
    }

    return {
      totalPrompts,
      schreinerhelden: ourMentions,
      shareOfVoice: totalPrompts > 0 ? Math.round((ourMentions / totalPrompts) * 100) : 0,
      competitors: competitorCounts,
      period: `${days} Tage`,
    };
  }
}
