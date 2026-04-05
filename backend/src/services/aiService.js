import OpenAI from 'openai';
import { logger } from './logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI-Service — Zentraler GPT-4o-Aufruf
 * 
 * Alle Prompts kommen aus Skills — hier wird nur der API-Call gemacht.
 * Unterstützt: Text-Completion, JSON-Output, Streaming.
 */
export class AiService {

  /**
   * Einfacher Prompt → Text-Antwort
   */
  async complete(prompt, { model = 'gpt-4o', temperature = 0.7, maxTokens = 4000, systemPrompt = null } = {}) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const text = response.choices[0]?.message?.content || '';
      logger.debug(`AI complete: ${prompt.slice(0, 80)}... → ${text.length} Zeichen`);
      return text;
    } catch (err) {
      logger.error(`AI-Fehler: ${err.message}`);
      throw new Error(`GPT-4o Fehler: ${err.message}`);
    }
  }

  /**
   * Prompt → JSON-Antwort (parsed)
   */
  async completeJson(prompt, { model = 'gpt-4o', temperature = 0.5 } = {}) {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Du antwortest ausschließlich mit validem JSON. Kein Markdown, keine Erklärung, nur JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content || '{}';

    try {
      return JSON.parse(text);
    } catch (parseErr) {
      logger.warn(`JSON-Parse-Fehler, versuche Cleanup: ${text.slice(0, 200)}`);
      // Versuche JSON aus Markdown-Block zu extrahieren
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) return JSON.parse(match[1].trim());
      throw new Error('AI-Antwort ist kein gültiges JSON');
    }
  }

  /**
   * Content-Qualität bewerten (HELDENFORMEL-Score)
   */
  async scoreContent(html, qualitySkillConfig) {
    const passes = qualitySkillConfig.passes || [];
    const allChecks = passes.flatMap(p => p.checks.map(c => ({ pass: p.name, check: c, weight: p.weight })));

    const prompt = `
Bewerte den folgenden HTML-Content anhand dieser Kriterien.
Für jedes Kriterium: vergib einen Score von 0-100 und eine kurze Begründung.

Kriterien:
${allChecks.map((c, i) => `${i + 1}. [${c.pass}] ${c.check}`).join('\n')}

Content:
${html.slice(0, 8000)}

Antworte als JSON:
{
  "scores": [
    { "index": 0, "score": 85, "reason": "..." },
    ...
  ],
  "totalScore": 82,
  "summary": "Kurze Gesamtbewertung"
}`;

    const result = await this.completeJson(prompt);

    // Gewichteten Score berechnen
    if (result.scores && passes.length) {
      let weighted = 0;
      for (const pass of passes) {
        const passScores = result.scores.filter((s, i) => {
          const check = allChecks[i];
          return check && check.pass === pass.name;
        });
        const avgPassScore = passScores.length
          ? passScores.reduce((sum, s) => sum + (s.score || 0), 0) / passScores.length
          : 0;
        weighted += avgPassScore * pass.weight;
      }
      result.totalScore = Math.round(weighted);
    }

    return result;
  }

  /**
   * Blacklist-Check — prüft ob verbotene Wörter im Text sind
   */
  checkBlacklist(text, blacklistConfig) {
    const violations = [];
    const lowerText = text.toLowerCase();

    for (const word of (blacklistConfig.words || [])) {
      if (lowerText.includes(word.toLowerCase())) {
        violations.push({ type: 'word', value: word });
      }
    }

    for (const pattern of (blacklistConfig.patterns || [])) {
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(text)) {
        violations.push({ type: 'pattern', value: pattern });
      }
    }

    return violations;
  }
}
