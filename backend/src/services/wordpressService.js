import { logger } from './logger.js';

const WP_URL = process.env.WP_URL || 'https://schreinerhelden.de';
const WP_USER = process.env.WP_USER || 'me_admin_26x';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || '';
const WP_TEMPLATE_ID = parseInt(process.env.WP_TEMPLATE_ID || '9741', 10);

const CLONER_BASE = `${WP_URL}/wp-json/helden-cloner/v1`;

/**
 * WordPressService — Schreinerhelden.de via Helden-Cloner Plugin (v1)
 *
 * Nutzt das WP-Plugin "helden-cloner" statt dem Standard REST API.
 * Plugin-Endpoints:
 *   GET  /helden-cloner/v1/health
 *   GET  /helden-cloner/v1/analyze-template?template_id=9741
 *   GET  /helden-cloner/v1/content-map
 *   POST /helden-cloner/v1/create-landing-page
 *   POST /helden-cloner/v1/update-content/{page_id}
 *   GET  /helden-cloner/v1/landing-pages
 *   POST /helden-cloner/v1/flush-cache/{page_id}
 *   POST /helden-cloner/v1/generate-schema
 *
 * Template 9741 = Stuttgart Master-Landingpage (34 content slots).
 */
export class WordPressService {
  constructor(prisma) {
    this.prisma = prisma;
    this.authHeader =
      'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
  }

  // ----------------------------------------------------------------
  // Low-level HTTP helper
  // ----------------------------------------------------------------
  async _request(method, path, body) {
    const url = path.startsWith('http') ? path : `${CLONER_BASE}${path}`;
    const opts = {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: this.authHeader,
      },
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = data?.message || data?.raw || `HTTP ${res.status}`;
      throw new Error(`Helden-Cloner ${method} ${path} → ${res.status}: ${msg}`);
    }
    return data;
  }

  // ----------------------------------------------------------------
  // Diagnostics
  // ----------------------------------------------------------------
  async health() {
    return this._request('GET', '/health');
  }

  async analyzeTemplate(templateId = WP_TEMPLATE_ID) {
    return this._request('GET', `/analyze-template?template_id=${templateId}`);
  }

  async getContentMap() {
    return this._request('GET', '/content-map');
  }

  async listLandingPages() {
    return this._request('GET', '/landing-pages');
  }

  async flushCache(pageId) {
    return this._request('POST', `/flush-cache/${pageId}`);
  }

  async generateSchema(payload) {
    return this._request('POST', '/generate-schema', payload);
  }

  // ----------------------------------------------------------------
  // Create / Publish
  // ----------------------------------------------------------------
  /**
   * Content → Landing-Page via Helden-Cloner erzeugen und publizieren.
   *
   * Erwartet ein Content-Objekt mit mindestens:
   *   { region, service, title, html?, metadata?: { seo?: { metaTitle, metaDescription } } }
   */
  async publish(contentId) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });
    if (!content) throw new Error(`Content ${contentId} nicht gefunden`);
    if (!content.region) throw new Error('Content hat keine Region');

    const payload = this._buildCreatePayload(content);

    try {
      const result = await this._request('POST', '/create-landing-page', payload);
      const pageId = result.page_id ?? result.id ?? result.ID;
      const pageUrl = result.url ?? result.link ?? result.permalink;

      await this.prisma.content.update({
        where: { id: contentId },
        data: {
          status: 'PUBLISHED',
          wpPostId: pageId ? String(pageId) : null,
          wpUrl: pageUrl || null,
          publishedAt: new Date(),
        },
      });

      await this.prisma.activity.create({
        data: {
          action: 'content_published',
          target: `content:${contentId}`,
          details: {
            wpPostId: pageId,
            wpUrl: pageUrl,
            title: content.title,
            via: 'helden-cloner/v1',
          },
        },
      });

      logger.info(
        `Helden-Cloner: Published "${content.title}" → ${pageUrl || '(no url returned)'}`
      );
      return { id: pageId, link: pageUrl, raw: result };
    } catch (err) {
      logger.error(`Helden-Cloner Publish-Fehler: ${err.message}`);
      throw new Error(`Publishing fehlgeschlagen: ${err.message}`);
    }
  }

  /**
   * Bestehende Landing-Page via Plugin aktualisieren.
   */
  async update(contentId) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });
    if (!content) throw new Error(`Content ${contentId} nicht gefunden`);
    if (!content.wpPostId) throw new Error('Content hat keine wpPostId');

    const payload = this._buildCreatePayload(content);
    const pageId = content.wpPostId;

    const result = await this._request('POST', `/update-content/${pageId}`, payload);

    await this.prisma.content.update({
      where: { id: contentId },
      data: { updatedAt: new Date() },
    });

    logger.info(`Helden-Cloner: Updated page ${pageId}`);
    return result;
  }

  // ----------------------------------------------------------------
  // Payload-Builder
  // ----------------------------------------------------------------
  _buildCreatePayload(content) {
    const seo = content.metadata?.seo || {};
    return {
      template_id: WP_TEMPLATE_ID,
      region: content.region,
      service: content.service || 'Dachschrägenschrank',
      title: content.title,
      slug: this.generateSlug(content),
      status: 'publish',
      meta_title: seo.metaTitle || content.title,
      meta_description: seo.metaDescription || '',
      content_html: content.html || '',
      content_overrides: content.metadata?.slots || {},
      schema: content.metadata?.schema || null,
    };
  }

  // ----------------------------------------------------------------
  // GSC (Platzhalter — siehe google-site-kit/v1 Namespace als Backup)
  // ----------------------------------------------------------------
  async requestIndexing(url) {
    logger.info(`Indexierung beantragt: ${url}`);
    // TODO: GSC Service-Account-Flow sobald GSC_SERVICE_ACCOUNT_JSON gesetzt
  }

  // ----------------------------------------------------------------
  // Slug-Helper
  // ----------------------------------------------------------------
  generateSlug(content) {
    const norm = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

    const parts = [];
    if (content.service) parts.push(norm(content.service));
    if (content.region) parts.push(norm(content.region));
    return parts.filter(Boolean).join('-') || 'seite';
  }
}
