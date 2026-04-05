import { logger } from './logger.js';

/**
 * SkillService — Herzstück der MEOS:SEO v6 Architektur
 * 
 * Alle Logik der App (Prompts, Regeln, Workflows) steckt in Skills.
 * Skills sind Datenbank-Objekte mit einem JSON-Config-Feld.
 * Der Admin editiert sie über die UI — kein Code, kein Deployment.
 */
export class SkillService {
  constructor(prisma) {
    this.prisma = prisma;
    this.cache = new Map();
  }

  // ==========================================================
  // Cache-Management
  // ==========================================================

  /**
   * Alle aktiven Skills in den Cache laden (beim Serverstart)
   */
  async warmCache() {
    const skills = await this.prisma.skill.findMany({
      where: { isActive: true },
    });
    this.cache.clear();
    for (const skill of skills) {
      this.cache.set(skill.slug, {
        id: skill.id,
        slug: skill.slug,
        name: skill.name,
        category: skill.category,
        config: skill.config,
        dependsOn: skill.dependsOn || [],
        version: skill.version,
      });
    }
    return skills.length;
  }

  cacheSize() {
    return this.cache.size;
  }

  invalidate(slug) {
    this.cache.delete(slug);
  }

  invalidateAll() {
    this.cache.clear();
  }

  // ==========================================================
  // Skill laden (mit Cache + Fallback auf DB)
  // ==========================================================

  /**
   * Einen Skill per Slug laden.
   * Wirft Error wenn nicht gefunden oder inaktiv.
   */
  async load(slug) {
    // 1. Cache prüfen
    if (this.cache.has(slug)) {
      return this.cache.get(slug).config;
    }

    // 2. Aus DB laden
    const skill = await this.prisma.skill.findUnique({
      where: { slug },
    });

    if (!skill) {
      throw new Error(`Skill "${slug}" nicht gefunden`);
    }
    if (!skill.isActive) {
      throw new Error(`Skill "${slug}" ist deaktiviert`);
    }

    // In Cache schreiben
    this.cache.set(slug, {
      id: skill.id,
      slug: skill.slug,
      name: skill.name,
      category: skill.category,
      config: skill.config,
      dependsOn: skill.dependsOn || [],
      version: skill.version,
    });

    return skill.config;
  }

  /**
   * Skill laden UND Variablen ersetzen.
   * Löst auch Abhängigkeiten auf (brand.skill, quality.skill, etc.)
   */
  async resolve(slug, variables = {}) {
    const config = await this.load(slug);
    const cached = this.cache.get(slug);

    // Abhängige Skills laden und deren Variablen einmischen
    const mergedVars = { ...variables };
    if (cached?.dependsOn?.length) {
      for (const depSlug of cached.dependsOn) {
        try {
          const depConfig = await this.load(depSlug);
          // Flache Eigenschaften aus abhängigen Skills als Variablen verfügbar machen
          if (typeof depConfig === 'object' && !Array.isArray(depConfig)) {
            for (const [key, val] of Object.entries(depConfig)) {
              if (typeof val === 'string' || typeof val === 'number') {
                mergedVars[`${depSlug}.${key}`] = String(val);
              }
            }
          }
        } catch (err) {
          logger.warn(`Abhängiger Skill "${depSlug}" konnte nicht geladen werden: ${err.message}`);
        }
      }
    }

    // Variablen in Config ersetzen ({{city}}, {{brand.phone}}, etc.)
    let json = JSON.stringify(config);
    for (const [key, val] of Object.entries(mergedVars)) {
      json = json.replaceAll(`{{${key}}}`, val);
    }

    return JSON.parse(json);
  }

  // ==========================================================
  // CRUD — Erstellen, Bearbeiten, Löschen, Duplizieren
  // ==========================================================

  /**
   * Neuen Skill anlegen
   */
  async create({ slug, name, category, description, config, dependsOn, userId }) {
    // Slug-Validierung
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error('Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten');
    }

    // Prüfen ob Slug schon existiert
    const existing = await this.prisma.skill.findUnique({ where: { slug } });
    if (existing) {
      throw new Error(`Skill mit Slug "${slug}" existiert bereits`);
    }

    const skill = await this.prisma.skill.create({
      data: {
        slug,
        name,
        category,
        description: description || null,
        config,
        dependsOn: dependsOn || [],
        createdById: userId,
        version: 1,
      },
    });

    // Cache aktualisieren
    this.cache.set(slug, {
      id: skill.id,
      slug: skill.slug,
      name: skill.name,
      category: skill.category,
      config: skill.config,
      dependsOn: skill.dependsOn || [],
      version: skill.version,
    });

    logger.info(`Skill erstellt: ${slug} (v1) von User ${userId}`);
    return skill;
  }

  /**
   * Skill bearbeiten — alte Version wird in History gesichert
   */
  async update(slug, { config, name, description, dependsOn, userId, note }) {
    const skill = await this.prisma.skill.findUnique({ where: { slug } });
    if (!skill) throw new Error(`Skill "${slug}" nicht gefunden`);

    // Alte Version in History sichern
    await this.prisma.skillHistory.create({
      data: {
        skillId: skill.id,
        version: skill.version,
        config: skill.config,
        changedBy: userId,
        note: note || null,
      },
    });

    // Skill aktualisieren
    const updated = await this.prisma.skill.update({
      where: { slug },
      data: {
        config: config !== undefined ? config : skill.config,
        name: name !== undefined ? name : skill.name,
        description: description !== undefined ? description : skill.description,
        dependsOn: dependsOn !== undefined ? dependsOn : skill.dependsOn,
        version: skill.version + 1,
      },
    });

    // Cache aktualisieren
    this.cache.set(slug, {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      category: updated.category,
      config: updated.config,
      dependsOn: updated.dependsOn || [],
      version: updated.version,
    });

    logger.info(`Skill aktualisiert: ${slug} (v${skill.version} → v${updated.version}) von User ${userId}`);
    return updated;
  }

  /**
   * Skill löschen — mit Abhängigkeits-Prüfung
   */
  async delete(slug) {
    // Prüfen ob andere Skills von diesem abhängen
    const dependents = await this.prisma.skill.findMany({
      where: {
        dependsOn: { has: slug },
        isActive: true,
      },
      select: { slug: true, name: true },
    });

    if (dependents.length > 0) {
      const names = dependents.map(d => d.name).join(', ');
      throw new Error(
        `Skill "${slug}" kann nicht gelöscht werden — wird von ${dependents.length} anderen Skills referenziert: ${names}`
      );
    }

    await this.prisma.skill.delete({ where: { slug } });
    this.cache.delete(slug);

    logger.info(`Skill gelöscht: ${slug}`);
  }

  /**
   * Skill duplizieren
   */
  async duplicate(slug, newSlug, userId) {
    const original = await this.prisma.skill.findUnique({ where: { slug } });
    if (!original) throw new Error(`Skill "${slug}" nicht gefunden`);

    return this.create({
      slug: newSlug,
      name: `${original.name} (Kopie)`,
      category: original.category,
      description: original.description,
      config: original.config,
      dependsOn: original.dependsOn,
      userId,
    });
  }

  /**
   * Skill aktivieren/deaktivieren
   */
  async toggleActive(slug) {
    const skill = await this.prisma.skill.findUnique({ where: { slug } });
    if (!skill) throw new Error(`Skill "${slug}" nicht gefunden`);

    const updated = await this.prisma.skill.update({
      where: { slug },
      data: { isActive: !skill.isActive },
    });

    if (updated.isActive) {
      // Wieder in Cache aufnehmen
      this.cache.set(slug, {
        id: updated.id,
        slug: updated.slug,
        name: updated.name,
        category: updated.category,
        config: updated.config,
        dependsOn: updated.dependsOn || [],
        version: updated.version,
      });
    } else {
      // Aus Cache entfernen
      this.cache.delete(slug);
    }

    logger.info(`Skill ${updated.isActive ? 'aktiviert' : 'deaktiviert'}: ${slug}`);
    return updated;
  }

  /**
   * Versionsverlauf eines Skills abrufen
   */
  async getHistory(slug) {
    const skill = await this.prisma.skill.findUnique({ where: { slug } });
    if (!skill) throw new Error(`Skill "${slug}" nicht gefunden`);

    return this.prisma.skillHistory.findMany({
      where: { skillId: skill.id },
      orderBy: { version: 'desc' },
      include: {
        editor: { select: { name: true, email: true } },
      },
    });
  }

  /**
   * Auf eine frühere Version zurückrollen
   */
  async rollback(slug, targetVersion, userId) {
    const skill = await this.prisma.skill.findUnique({ where: { slug } });
    if (!skill) throw new Error(`Skill "${slug}" nicht gefunden`);

    const historyEntry = await this.prisma.skillHistory.findFirst({
      where: { skillId: skill.id, version: targetVersion },
    });
    if (!historyEntry) {
      throw new Error(`Version ${targetVersion} von Skill "${slug}" nicht gefunden`);
    }

    return this.update(slug, {
      config: historyEntry.config,
      userId,
      note: `Rollback auf Version ${targetVersion}`,
    });
  }

  // ==========================================================
  // Abfragen
  // ==========================================================

  async list({ category, isActive } = {}) {
    const where = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive;

    return this.prisma.skill.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        description: true,
        isActive: true,
        version: true,
        dependsOn: true,
        updatedAt: true,
      },
    });
  }

  async getBySlug(slug) {
    return this.prisma.skill.findUnique({
      where: { slug },
      include: {
        createdBy: { select: { name: true, email: true } },
      },
    });
  }
}
