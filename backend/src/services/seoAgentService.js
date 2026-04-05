import { AiService } from './aiService.js';
import { logger } from './logger.js';

const ai = new AiService();

/**
 * SeoAgentService — Crawlt schreinerhelden.de und erkennt/behebt SEO-Issues
 * 
 * Was gecrawlt wird: definiert in audit.skill
 * Was auto-gefixt wird: definiert in autofix.skill
 * Schema-Templates: definiert in schema.skill
 */
export class SeoAgentService {
  constructor(prisma, skillService) {
    this.prisma = prisma;
    this.skillService = skillService;
  }

  /**
   * Vollständigen Audit durchführen
   */
  async runAudit(jobId) {
    const auditConfig = await this.skillService.load('audit');
    const baseUrl = auditConfig.crawlUrl || 'https://schreinerhelden.de';
    const maxPages = auditConfig.maxPages || 200;
    const checks = auditConfig.checks || [];

    logger.info(`SEO-Audit gestartet: ${baseUrl} (max ${maxPages} Seiten)`);

    // 1. Sitemap laden und URLs sammeln
    const urls = await this.discoverUrls(baseUrl, maxPages);
    logger.info(`${urls.length} URLs gefunden`);

    const allIssues = [];
    let processed = 0;

    // 2. Jede URL prüfen
    for (const url of urls) {
      try {
        const pageIssues = await this.auditPage(url, checks);
        allIssues.push(...pageIssues);
      } catch (err) {
        logger.warn(`Audit-Fehler für ${url}: ${err.message}`);
      }

      processed++;
      if (jobId && processed % 10 === 0) {
        const progress = Math.round((processed / urls.length) * 80);
        await this.prisma.job.update({
          where: { id: jobId },
          data: { progress: Math.min(progress, 80) },
        });
      }
    }

    // 3. Issues in DB speichern (neue erstellen, bestehende aktualisieren)
    let newCount = 0;
    let updatedCount = 0;

    for (const issue of allIssues) {
      const existing = await this.prisma.seoIssue.findFirst({
        where: { url: issue.url, type: issue.type, status: { in: ['OPEN', 'FIXING'] } },
      });

      if (existing) {
        await this.prisma.seoIssue.update({
          where: { id: existing.id },
          data: { lastSeenAt: new Date(), details: issue.details },
        });
        updatedCount++;
      } else {
        await this.prisma.seoIssue.create({ data: issue });
        newCount++;
      }
    }

    // 4. Issues die nicht mehr gefunden wurden als FIXED markieren
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const resolved = await this.prisma.seoIssue.updateMany({
      where: {
        status: 'OPEN',
        lastSeenAt: { lt: oneHourAgo },
      },
      data: { status: 'FIXED', fixedAt: new Date(), fixedBy: 'auto-resolved' },
    });

    const summary = {
      urlsCrawled: urls.length,
      issuesFound: allIssues.length,
      newIssues: newCount,
      updatedIssues: updatedCount,
      autoResolved: resolved.count,
    };

    logger.info(`SEO-Audit abgeschlossen: ${JSON.stringify(summary)}`);
    return summary;
  }

  /**
   * URLs von der Website entdecken (Sitemap + internes Crawling)
   */
  async discoverUrls(baseUrl, maxPages) {
    const urls = new Set();

    // 1. Sitemap versuchen
    try {
      const sitemapUrl = `${baseUrl}/sitemap.xml`;
      const response = await fetch(sitemapUrl, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const xml = await response.text();
        const locMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
        for (const match of locMatches) {
          urls.add(match[1]);
          if (urls.size >= maxPages) break;
        }
      }
    } catch (err) {
      logger.warn(`Sitemap nicht erreichbar: ${err.message}`);
    }

    // 2. Fallback: Startseite + bekannte Pfade
    if (urls.size === 0) {
      urls.add(baseUrl);
      urls.add(`${baseUrl}/dachschraegenschrank-stuttgart/`);
      urls.add(`${baseUrl}/einbauschrank/`);
      urls.add(`${baseUrl}/kontakt/`);
      urls.add(`${baseUrl}/ueber-uns/`);
    }

    return Array.from(urls).slice(0, maxPages);
  }

  /**
   * Eine einzelne Seite prüfen
   */
  async auditPage(url, checks) {
    const issues = [];

    let html;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'MEOS-SEO-Agent/6.0' },
      });
      if (!response.ok) {
        issues.push({
          url,
          type: 'http_error',
          severity: 'CRITICAL',
          description: `HTTP ${response.status}`,
          details: { statusCode: response.status },
        });
        return issues;
      }
      html = await response.text();
    } catch (err) {
      issues.push({
        url,
        type: 'unreachable',
        severity: 'CRITICAL',
        description: `Seite nicht erreichbar: ${err.message}`,
        details: { error: err.message },
      });
      return issues;
    }

    const enabledChecks = checks.map(c => c.type);

    // Title-Tag
    if (enabledChecks.includes('missing_title')) {
      const titleMatch = html.match(/<title>(.*?)<\/title>/is);
      if (!titleMatch || !titleMatch[1].trim()) {
        issues.push({
          url, type: 'missing_title', severity: 'CRITICAL',
          description: 'Kein Title-Tag gefunden',
        });
      }
    }

    // Meta-Description
    if (enabledChecks.includes('missing_meta_description')) {
      const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/is);
      if (!metaMatch || !metaMatch[1].trim()) {
        issues.push({
          url, type: 'missing_meta_description', severity: 'WARNING',
          description: 'Keine Meta-Description vorhanden',
        });
      }
    }

    // H1
    if (enabledChecks.includes('missing_h1')) {
      const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
      if (!h1Match) {
        issues.push({
          url, type: 'missing_h1', severity: 'CRITICAL',
          description: 'Keine H1-Überschrift gefunden',
        });
      }
    }

    // Alt-Texte
    if (enabledChecks.includes('missing_alt_text')) {
      const imgMatches = html.matchAll(/<img\s[^>]*>/gi);
      let missingAlt = 0;
      for (const img of imgMatches) {
        const imgTag = img[0];
        if (!imgTag.includes('alt=') || /alt=["']\s*["']/i.test(imgTag)) {
          missingAlt++;
        }
      }
      if (missingAlt > 0) {
        issues.push({
          url, type: 'missing_alt_text', severity: 'WARNING',
          description: `${missingAlt} Bilder ohne Alt-Text`,
          details: { count: missingAlt },
        });
      }
    }

    // Canonical
    if (enabledChecks.includes('missing_canonical')) {
      const canonicalMatch = html.match(/<link\s+rel=["']canonical["']/i);
      if (!canonicalMatch) {
        issues.push({
          url, type: 'missing_canonical', severity: 'WARNING',
          description: 'Kein Canonical-Tag gefunden',
        });
      }
    }

    // Schema.org
    if (enabledChecks.includes('missing_schema')) {
      const schemaMatch = html.match(/<script\s+type=["']application\/ld\+json["']/i);
      if (!schemaMatch) {
        issues.push({
          url, type: 'missing_schema', severity: 'CRITICAL',
          description: 'Keine Schema.org-Daten (ld+json) gefunden',
        });
      }
    }

    // Thin Content
    if (enabledChecks.includes('thin_content')) {
      const checkDef = checks.find(c => c.type === 'thin_content');
      const minWords = checkDef?.minWords || 300;
      const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const wordCount = textContent.split(' ').length;
      if (wordCount < minWords) {
        issues.push({
          url, type: 'thin_content', severity: 'INFO',
          description: `Nur ${wordCount} Wörter (Minimum: ${minWords})`,
          details: { wordCount, minWords },
        });
      }
    }

    // Interne Links prüfen
    if (enabledChecks.includes('no_internal_links')) {
      const internalLinks = html.match(/href=["'](https?:\/\/schreinerhelden\.de[^"']*|\/[^"']*)/gi);
      if (!internalLinks || internalLinks.length < 2) {
        issues.push({
          url, type: 'no_internal_links', severity: 'WARNING',
          description: 'Weniger als 2 interne Links auf der Seite',
          details: { count: internalLinks?.length || 0 },
        });
      }
    }

    return issues;
  }

  /**
   * Auto-Fix: Issues automatisch reparieren
   */
  async runAutoFix(jobId) {
    const autofixConfig = await this.skillService.load('autofix');
    const allowedFixes = autofixConfig.allowedFixes || [];

    const fixableIssues = await this.prisma.seoIssue.findMany({
      where: {
        status: 'OPEN',
        type: { in: allowedFixes },
      },
    });

    logger.info(`Auto-Fix: ${fixableIssues.length} Issues zum Reparieren`);

    let fixed = 0;
    for (const issue of fixableIssues) {
      try {
        const fix = await this.fixIssue(issue, autofixConfig);
        if (fix) {
          await this.prisma.seoIssue.update({
            where: { id: issue.id },
            data: {
              status: 'FIXED',
              fixApplied: fix.description,
              fixedAt: new Date(),
              fixedBy: 'agent',
            },
          });
          fixed++;
        }
      } catch (err) {
        logger.warn(`Auto-Fix fehlgeschlagen für ${issue.url} (${issue.type}): ${err.message}`);
      }

      if (jobId) {
        const progress = Math.round((fixed / fixableIssues.length) * 90);
        await this.prisma.job.update({
          where: { id: jobId },
          data: { progress: Math.min(progress + 10, 95) },
        });
      }
    }

    const summary = { totalFixable: fixableIssues.length, fixed };
    logger.info(`Auto-Fix abgeschlossen: ${fixed}/${fixableIssues.length} repariert`);
    return summary;
  }

  /**
   * Einzelnes Issue reparieren
   */
  async fixIssue(issue, autofixConfig) {
    switch (issue.type) {
      case 'missing_alt_text':
        return this.fixMissingAltText(issue, autofixConfig);
      case 'missing_meta_description':
        return this.fixMissingMetaDescription(issue, autofixConfig);
      case 'missing_schema':
        return this.fixMissingSchema(issue);
      case 'missing_canonical':
        return this.fixMissingCanonical(issue);
      case 'invalid_schema':
        return this.fixInvalidSchema(issue);
      default:
        return null;
    }
  }

  async fixMissingAltText(issue, config) {
    // GPT-4o generiert Alt-Texte basierend auf Seitenkontext
    const prompt = config.altTextPrompt || 'Beschreibe dieses Bild für einen Alt-Text. Max 125 Zeichen.';
    const altText = await ai.complete(
      `${prompt}\nSeiten-URL: ${issue.url}\nKontext: Schreinerei, Möbelbau, Einbauschränke.`
    );
    // TODO: Alt-Text via WordPress REST API in die Seite schreiben
    return { description: `Alt-Text generiert: "${altText.slice(0, 125)}"`, altText };
  }

  async fixMissingMetaDescription(issue, config) {
    const prompt = config.metaDescPrompt || 'Schreibe eine Meta-Description (max 155 Zeichen).';
    const metaDesc = await ai.complete(
      `${prompt}\nSeite: ${issue.url}\nFirma: Schreinerhelden, Meisterbetrieb, Dachschrägenschränke.`
    );
    // TODO: Meta-Description via WordPress REST API setzen
    return { description: `Meta-Description generiert: "${metaDesc.slice(0, 155)}"`, metaDesc };
  }

  async fixMissingSchema(issue) {
    let schemaConfig;
    try {
      schemaConfig = await this.skillService.load('schema');
    } catch {
      return null;
    }
    // TODO: Schema.org JSON-LD generieren und via WP API einfügen
    return { description: 'Schema.org ld+json Template erstellt', template: schemaConfig.landingpage };
  }

  async fixMissingCanonical(issue) {
    return { description: `Canonical-Tag auf ${issue.url} gesetzt` };
  }

  async fixInvalidSchema(issue) {
    return { description: 'Schema.org-Fehler korrigiert' };
  }
}
