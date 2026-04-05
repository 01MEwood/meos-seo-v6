import { logger } from './logger.js';

const WP_URL = process.env.WP_URL || 'https://schreinerhelden.de';
const WP_USER = process.env.WP_USER || 'me_admin_26x';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || '';
const WP_TEMPLATE_ID = parseInt(process.env.WP_TEMPLATE_ID || '9741', 10);

/**
 * WordPressService — Published Content auf schreinerhelden.de
 * 
 * Methode: Elementor Template Clone + String Replace
 * Template 9741 = Stuttgart Master-Landingpage
 */
export class WordPressService {
  constructor(prisma) {
    this.prisma = prisma;
    this.authHeader = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
  }

  /**
   * Content als WordPress-Post veröffentlichen
   */
  async publish(contentId) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content) throw new Error(`Content ${contentId} nicht gefunden`);
    if (!content.html) throw new Error('Content hat keinen HTML-Inhalt');

    try {
      // WordPress-Post erstellen
      const wpPost = await this.createPost({
        title: content.title,
        content: content.html,
        status: 'publish',
        slug: this.generateSlug(content),
        meta: content.metadata?.seo || {},
      });

      // Content-Datensatz aktualisieren
      await this.prisma.content.update({
        where: { id: contentId },
        data: {
          status: 'PUBLISHED',
          wpPostId: wpPost.id,
          wpUrl: wpPost.link,
          publishedAt: new Date(),
        },
      });

      // Activity loggen
      await this.prisma.activity.create({
        data: {
          action: 'content_published',
          target: `content:${contentId}`,
          details: {
            wpPostId: wpPost.id,
            wpUrl: wpPost.link,
            title: content.title,
          },
        },
      });

      logger.info(`WordPress: Published "${content.title}" → ${wpPost.link}`);
      return wpPost;
    } catch (err) {
      logger.error(`WordPress-Fehler: ${err.message}`);
      throw new Error(`WordPress Publishing fehlgeschlagen: ${err.message}`);
    }
  }

  /**
   * WordPress REST API: Post erstellen
   */
  async createPost({ title, content, status = 'draft', slug, meta }) {
    const body = {
      title,
      content,
      status,
      slug,
    };

    // Meta-Daten (Yoast SEO) hinzufügen wenn vorhanden
    if (meta?.metaTitle || meta?.metaDescription) {
      body.meta = {};
      if (meta.metaTitle) body.meta._yoast_wpseo_title = meta.metaTitle;
      if (meta.metaDescription) body.meta._yoast_wpseo_metadesc = meta.metaDescription;
    }

    const response = await fetch(`${WP_URL}/wp-json/wp/v2/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WP API ${response.status}: ${error}`);
    }

    return response.json();
  }

  /**
   * Elementor-Template klonen und Ortsnamen ersetzen
   */
  async cloneFromTemplate(region, service) {
    // 1. Template laden
    const templateResponse = await fetch(
      `${WP_URL}/wp-json/wp/v2/pages/${WP_TEMPLATE_ID}`,
      { headers: { 'Authorization': this.authHeader } }
    );

    if (!templateResponse.ok) {
      throw new Error(`Template ${WP_TEMPLATE_ID} nicht gefunden`);
    }

    const template = await templateResponse.json();

    // 2. String-Replace: Stuttgart → Zielregion
    let content = template.content?.rendered || '';
    content = content.replaceAll('Stuttgart', region);
    if (service) {
      content = content.replaceAll('Dachschrägenschrank', service);
    }

    // 3. Elementor-Daten klonen (wenn vorhanden)
    let elementorData = template.meta?._elementor_data || '';
    if (elementorData) {
      elementorData = elementorData.replaceAll('Stuttgart', region);
      if (service) {
        elementorData = elementorData.replaceAll('Dachschrägenschrank', service);
      }
    }

    return { content, elementorData };
  }

  /**
   * Google Search Console: Indexierung beantragen
   */
  async requestIndexing(url) {
    // TODO Iteration 3: GSC API Integration
    logger.info(`Indexierung beantragt: ${url}`);
  }

  /**
   * URL-Slug generieren
   */
  generateSlug(content) {
    const parts = [];
    if (content.service) parts.push(content.service.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss'));
    if (content.region) parts.push(content.region.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss'));
    return parts.join('-').replace(/[^a-z0-9-]/g, '') || 'seite';
  }
}
