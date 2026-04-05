import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding MEOS:SEO v6.0 ...');

  // ==========================================================
  // 1. USERS
  // ==========================================================

  const mario = await prisma.user.upsert({
    where: { email: 'mario@schreinerhelden.de' },
    update: {},
    create: {
      email: 'mario@schreinerhelden.de',
      name: 'Mario Esch',
      passwordHash: await bcrypt.hash('changeme123', 12),
      role: 'ADMIN',
    },
  });

  const melanie = await prisma.user.upsert({
    where: { email: 'melanie@schreinerhelden.de' },
    update: {},
    create: {
      email: 'melanie@schreinerhelden.de',
      name: 'Melanie',
      passwordHash: await bcrypt.hash('changeme123', 12),
      role: 'POWERUSER',
    },
  });

  console.log(`Users: ${mario.name} (ADMIN), ${melanie.name} (POWERUSER)`);

  // ==========================================================
  // 2. SKILLS — Globale Skills
  // ==========================================================

  const skills = [
    {
      slug: 'brand',
      name: 'Markenidentität',
      category: 'GLOBAL',
      description: 'Schreinerhelden-Tonalität, CTA, Kontaktdaten — wird von fast allen anderen Skills referenziert',
      config: {
        company: 'Schreinerhelden GmbH & Co. KG',
        location: 'Murrhardt-Fornsbach, Baden-Württemberg',
        since: 'seit 1998',
        phone: '07192 978901',
        email: 'info@schreinerhelden.de',
        website: 'https://schreinerhelden.de',
        owner: 'Mario Esch',
        title: 'Schreinermeister',
        ansprache: 'Du',
        cta: {
          text: 'Jetzt Beratungstermin vereinbaren',
          link: '/termin',
          color: '#EE7E00',
        },
        colors: {
          background: '#f6f8f5',
          primary: '#EE7E00',
          text: '#333333',
        },
        usp: [
          '3D-Lasermessung auf 0,1mm genau',
          'Blum-Beschläge mit lebenslanger Garantie',
          'Meisterbetrieb mit über 25 Jahren Erfahrung',
          'Fertigung in eigener Werkstatt in Murrhardt',
        ],
        regionen: [
          'Stuttgart', 'Ludwigsburg', 'Waiblingen', 'Esslingen',
          'Böblingen', 'Sindelfingen', 'Fellbach', 'Leonberg',
          'Backnang', 'Schorndorf', 'Winnenden', 'Kornwestheim',
          'Bietigheim-Bissingen', 'Murrhardt', 'Schwäbisch Hall',
          'Heilbronn', 'Göppingen', 'Rems-Murr-Kreis',
        ],
        services: [
          'Dachschrägenschrank',
          'Einbauschrank',
          'Begehbarer Kleiderschrank',
          'Schiebetüren-Schranksystem',
          'Ankleide',
          'Stauraum unter Treppen',
        ],
      },
      dependsOn: [],
    },
    {
      slug: 'blacklist',
      name: 'Verbotene Wörter',
      category: 'GLOBAL',
      description: 'Wörter die in keinem generierten Content vorkommen dürfen',
      config: {
        words: [
          'Lokalkolorit', 'einzigartig', 'ganzheitlich', 'synergie',
          'state-of-the-art', 'cutting-edge', 'revolutionär',
          'Ihr Partner für', 'Wir bieten Ihnen', 'Herzlich willkommen',
          'in der heutigen Zeit', 'heutzutage',
        ],
        patterns: [
          'Klick(e|en) Sie hier',
          'Zögern Sie nicht',
          'Worauf warten Sie',
        ],
      },
      dependsOn: [],
    },
    {
      slug: 'quality',
      name: 'HELDENFORMEL Qualitäts-Gate',
      category: 'GLOBAL',
      description: '3-Pass-Gate: Customer Value → Conversion → Search Performance',
      config: {
        passes: [
          {
            name: 'Customer Value',
            weight: 0.4,
            checks: [
              'Beantwortet die Seite die Frage des Kunden?',
              'Enthält sie mindestens 3 konkrete Fakten (Preis, Maße, Material)?',
              'Gibt es Social Proof (Bewertungen, Referenzen)?',
              'Ist die Sprache verständlich (kein Fachchinesisch)?',
            ],
          },
          {
            name: 'Conversion',
            weight: 0.3,
            checks: [
              'Ist der CTA sichtbar und klar?',
              'Gibt es einen Handlungsgrund (Dringlichkeit, Vorteil)?',
              'Sind Kontaktdaten prominent platziert?',
              'Funktioniert die Seite auf Mobilgeräten?',
            ],
          },
          {
            name: 'Search Performance',
            weight: 0.3,
            checks: [
              'Enthält der Title-Tag das Hauptkeyword?',
              'Gibt es eine Meta-Description mit CTA?',
              'Sind H1-H3 logisch strukturiert?',
              'Schema.org vorhanden und fehlerfrei?',
              'Interne Links zu verwandten Seiten?',
            ],
          },
        ],
        minScore: 85,
      },
      dependsOn: [],
    },
    {
      slug: 'timeline',
      name: 'Zeitschiene-Konfiguration',
      category: 'GLOBAL',
      description: 'Snapshot-Zeitplan, Vergleichszeiträume, Alert-Schwellenwerte, Daten-Retention',
      config: {
        snapshotSchedule: '0 3 * * *',
        comparisonPeriods: [
          { label: 'vs. Vorwoche', days: 7 },
          { label: 'vs. Vormonat', days: 30 },
          { label: 'vs. Vor-3-Monate', days: 90 },
          { label: 'vs. Jahresanfang', anchor: 'yearStart' },
        ],
        alerts: {
          keywordDrop: { threshold: 5, severity: 'WARNING' },
          keywordCrash: { threshold: 15, severity: 'CRITICAL' },
          sentimentFlip: { from: 'POSITIVE', to: 'NEGATIVE', severity: 'CRITICAL' },
          scoreDrop: { pointsPerWeek: 10, severity: 'WARNING' },
          milestones: [50, 60, 70, 80, 90],
        },
        notifications: {
          email: ['melanie@schreinerhelden.de'],
          dashboard: true,
        },
        retention: {
          daily: '90d',
          weekly: '1y',
          monthly: 'forever',
        },
      },
      dependsOn: [],
    },

    // ==========================================================
    // 3. SKILLS — Content
    // ==========================================================

    {
      slug: 'landingpage',
      name: 'Landingpage-Generator',
      category: 'CONTENT',
      description: 'HELDENFORMEL 6-Stufen-Pipeline für Orts-Landingpages',
      config: {
        pipeline: [
          {
            stage: 'intelligence',
            prompt: 'Analysiere den Markt für {{service}} in {{city}}. Identifiziere: Hauptprobleme der Kunden, lokale Besonderheiten, Wettbewerbsumfeld. Antworte als JSON.',
            model: 'gpt-4o',
            outputFormat: 'json',
          },
          {
            stage: 'strategy',
            prompt: 'Basierend auf der Analyse, definiere: Hauptkeyword, 5 Nebenkeywords, USP-Fokus, empfohlene FAQ-Fragen, Schema.org-Typ. Antworte als JSON.',
            model: 'gpt-4o',
            dependsOn: 'intelligence',
          },
          {
            stage: 'rag',
            sources: ['website', 'reviews', 'competitor'],
            description: 'Sammle relevante Inhalte von schreinerhelden.de, Google Reviews, und Wettbewerber-Seiten',
          },
          {
            stage: 'generation',
            prompt: 'Schreibe eine vollständige Landingpage für {{service}} in {{city}}. Du-Ansprache. CTA: {{brand.cta.text}} mit Link {{brand.cta.link}}. Telefon: {{brand.phone}}. Seit: {{brand.since}}. Baue ein FAQ mit mindestens 5 Fragen ein. Format: HTML mit Elementor-kompatiblen Klassen.',
            model: 'gpt-4o',
            dependsOn: 'strategy',
          },
          {
            stage: 'review',
            qualityGate: 'quality',
            minScore: 85,
            autoReject: true,
          },
          {
            stage: 'push',
            target: 'wordpress',
            templateId: 9741,
            method: 'elementor-clone',
            bylineInjection: 'push',
          },
        ],
        pricing: 'ab ca. 3.500 €',
        measurement: '3D-Lasermessung',
        guarantee: 'Blum-Beschläge mit lebenslanger Garantie',
      },
      dependsOn: ['brand', 'blacklist', 'quality'],
    },
    {
      slug: 'blog',
      name: 'Blog-Artikel-Generator',
      category: 'CONTENT',
      description: 'Autoblog-Pipeline für Blog-Content auf schreinerhelden.de',
      config: {
        sources: ['keywords', 'rss', 'trending'],
        schedule: 'weekly',
        prompt: 'Schreibe einen Blog-Artikel über {{topic}} für schreinerhelden.de. Du-Ansprache. Mindestens 1.500 Wörter. Baue interne Links zu relevanten Landingpages ein. Format: HTML.',
        model: 'gpt-4o',
        autoPublish: false,
        autoPublishThreshold: 85,
        internalLinking: {
          minLinks: 3,
          maxLinks: 8,
          preferLandingpages: true,
        },
      },
      dependsOn: ['brand', 'blacklist', 'quality'],
    },
    {
      slug: 'social',
      name: 'Social Multiplier',
      category: 'CONTENT',
      description: 'Generiert Social-Media-Posts aus veröffentlichten Blog-Artikeln und Landingpages',
      config: {
        channels: ['instagram', 'facebook', 'linkedin'],
        promptPerChannel: {
          instagram: 'Erstelle einen Instagram-Post (max 2.200 Zeichen) basierend auf: {{content}}. Verwende relevante Hashtags.',
          facebook: 'Erstelle einen Facebook-Post basierend auf: {{content}}. Mit Link zur Seite.',
          linkedin: 'Erstelle einen LinkedIn-Post (professioneller Ton) basierend auf: {{content}}.',
        },
        autoPost: false,
      },
      dependsOn: ['brand'],
    },

    // ==========================================================
    // 4. SKILLS — SEO
    // ==========================================================

    {
      slug: 'audit',
      name: 'SEO-Audit-Regeln',
      category: 'SEO',
      description: 'Definiert was gecrawlt und geprüft wird',
      config: {
        crawlUrl: 'https://schreinerhelden.de',
        maxPages: 200,
        checks: [
          { type: 'missing_title', severity: 'CRITICAL' },
          { type: 'missing_meta_description', severity: 'WARNING' },
          { type: 'missing_h1', severity: 'CRITICAL' },
          { type: 'duplicate_title', severity: 'WARNING' },
          { type: 'missing_alt_text', severity: 'WARNING' },
          { type: 'broken_internal_link', severity: 'CRITICAL' },
          { type: 'broken_external_link', severity: 'INFO' },
          { type: 'missing_schema', severity: 'CRITICAL' },
          { type: 'invalid_schema', severity: 'WARNING' },
          { type: 'missing_canonical', severity: 'WARNING' },
          { type: 'slow_page', severity: 'WARNING', threshold: 3000 },
          { type: 'no_internal_links', severity: 'WARNING' },
          { type: 'thin_content', severity: 'INFO', minWords: 300 },
        ],
        schedule: 'weekly',
      },
      dependsOn: ['brand'],
    },
    {
      slug: 'autofix',
      name: 'Auto-Fix-Regeln',
      category: 'SEO',
      description: 'Was der SEO-Agent automatisch reparieren darf (und was nicht)',
      config: {
        allowedFixes: [
          'missing_alt_text',
          'missing_meta_description',
          'missing_schema',
          'invalid_schema',
          'missing_canonical',
        ],
        requireApproval: [
          'missing_title',
          'missing_h1',
          'broken_internal_link',
        ],
        neverAutoFix: [
          'thin_content',
          'slow_page',
        ],
        altTextPrompt: 'Beschreibe dieses Bild für einen Alt-Text. Kontext: Schreinerei, Möbelbau, Einbauschränke. Max 125 Zeichen.',
        metaDescPrompt: 'Schreibe eine Meta-Description (max 155 Zeichen) für diese Seite. Hauptkeyword: {{keyword}}. CTA einbauen.',
      },
      dependsOn: ['brand'],
    },
    {
      slug: 'schema',
      name: 'Schema.org Templates',
      category: 'SEO',
      description: 'Schema.org-Vorlagen pro Seitentyp',
      config: {
        landingpage: {
          types: ['LocalBusiness', 'Product', 'FAQPage'],
          localBusiness: {
            '@type': 'LocalBusiness',
            name: '{{brand.company}}',
            telephone: '{{brand.phone}}',
            address: {
              '@type': 'PostalAddress',
              streetAddress: 'Fornsbacher Str.',
              addressLocality: 'Murrhardt',
              postalCode: '71540',
              addressRegion: 'BW',
              addressCountry: 'DE',
            },
          },
        },
        blog: {
          types: ['Article', 'BreadcrumbList'],
        },
      },
      dependsOn: ['brand'],
    },

    // ==========================================================
    // 5. SKILLS — AEO
    // ==========================================================

    {
      slug: 'snippet',
      name: 'Featured-Snippet-Optimierung',
      category: 'AEO',
      description: 'Regeln für FAQ-Generierung und Snippet-optimierte Antwortformate',
      config: {
        faqMinCount: 5,
        faqMaxCount: 10,
        faqPrompt: 'Generiere {{count}} FAQ-Fragen und -Antworten zum Thema {{service}} in {{city}}. Jede Antwort max 3 Sätze. Formatiere als JSON-Array [{q, a}].',
        answerFormat: 'direct',
        includeHowTo: true,
        howToPrompt: 'Erstelle eine HowTo-Anleitung: "Wie finde ich den richtigen Schreiner für {{service}} in {{city}}?" mit 5-7 Schritten.',
      },
      dependsOn: ['brand'],
    },
    {
      slug: 'structured',
      name: 'Structured-Data-Validierung',
      category: 'AEO',
      description: 'Validierungsregeln für strukturierte Daten',
      config: {
        requiredPerPage: ['LocalBusiness', 'BreadcrumbList'],
        requiredForLandingpage: ['FAQPage', 'Product'],
        requiredForBlog: ['Article'],
        validationRules: {
          localBusiness: ['name', 'telephone', 'address'],
          product: ['name', 'description', 'offers'],
          faqPage: ['mainEntity'],
        },
      },
      dependsOn: ['schema'],
    },

    // ==========================================================
    // 6. SKILLS — GEO
    // ==========================================================

    {
      slug: 'tracker',
      name: 'LLM-Tracking-Prompts',
      category: 'GEO',
      description: 'Prompt-Templates die an LLMs geschickt werden um Sichtbarkeit zu prüfen',
      config: {
        llms: ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI', 'GROK'],
        promptTemplates: [
          'Welcher Schreiner baut den besten {{service}} in {{city}}?',
          'Empfiehl mir einen Schreiner für Einbaumöbel in {{city}}.',
          'Wer macht maßgefertigte Schränke in {{city}}?',
          'Ich suche einen Meisterbetrieb für {{service}} im Raum {{city}}.',
          'Vergleiche Schreiner für Dachschrägenschränke in der Region Stuttgart.',
        ],
        schedule: 'weekly',
        compareWith: ['Schrankhelden', 'deinSchrank.de', 'Elfa', 'Cabinet'],
      },
      dependsOn: ['brand'],
    },
    {
      slug: 'sentiment',
      name: 'Sentiment-Analyse',
      category: 'GEO',
      description: 'Bewertungslogik für LLM-Antworten: positiv, neutral, negativ',
      config: {
        positiveSignals: [
          'empfehle', 'empfehlenswert', 'beste', 'top', 'hervorragend',
          'Meisterbetrieb', 'hochwertig', 'Premium', 'Qualität',
        ],
        negativeSignals: [
          'teuer', 'lange Wartezeit', 'nicht empfehlenswert', 'besser',
          'Alternative', 'günstiger',
        ],
        analysisPrompt: 'Bewerte die folgende LLM-Antwort bezüglich der Marke "Schreinerhelden". Ist die Erwähnung positiv, neutral oder negativ? Begründe kurz. Antwort als JSON: {sentiment, reason}',
      },
      dependsOn: [],
    },
    {
      slug: 'competitor',
      name: 'Wettbewerbs-Tracking',
      category: 'GEO',
      description: 'Wettbewerber-Definitionen für Share-of-Voice-Berechnung',
      config: {
        competitors: [
          {
            name: 'Schrankhelden',
            type: 'franchise',
            website: 'https://schrankhelden.de',
            regions: 'bundesweit',
            threat: 'high',
          },
          {
            name: 'deinSchrank.de',
            type: 'online-konfigurator',
            website: 'https://deinschrank.de',
            regions: 'bundesweit',
            threat: 'medium',
          },
          {
            name: 'Elfa',
            type: 'system-anbieter',
            website: 'https://elfa.com',
            regions: 'DACH',
            threat: 'low',
          },
        ],
        shareOfVoiceCalc: 'mentions_schreinerhelden / (mentions_schreinerhelden + mentions_competitors) * 100',
      },
      dependsOn: [],
    },
  ];

  // Skills upserten
  for (const skill of skills) {
    await prisma.skill.upsert({
      where: { slug: skill.slug },
      update: {
        config: skill.config,
        description: skill.description,
        dependsOn: skill.dependsOn,
      },
      create: {
        ...skill,
        createdById: mario.id,
      },
    });
    console.log(`  Skill: ${skill.slug} (${skill.category})`);
  }

  // ==========================================================
  // 7. KEYWORDS — Initiale Keywords für alle Regionen
  // ==========================================================

  const services = ['Schreiner', 'Dachschrägenschrank', 'Einbauschrank'];
  const regions = [
    'Stuttgart', 'Ludwigsburg', 'Waiblingen', 'Esslingen',
    'Böblingen', 'Fellbach', 'Backnang', 'Schorndorf',
  ];

  for (const region of regions) {
    for (const service of services) {
      await prisma.keyword.upsert({
        where: {
          keyword_region: {
            keyword: `${service} ${region}`,
            region,
          },
        },
        update: {},
        create: {
          keyword: `${service} ${region}`,
          region,
          service,
        },
      });
    }
  }
  console.log(`  Keywords: ${regions.length * services.length} angelegt`);

  // ==========================================================
  // 8. LLM-PROMPTS — Initiale Tracking-Prompts
  // ==========================================================

  const llmPrompts = [
    { prompt: 'Welcher Schreiner baut den besten Dachschrägenschrank in Stuttgart?', region: 'Stuttgart', service: 'Dachschrägenschrank' },
    { prompt: 'Empfiehl mir einen Schreiner für Einbaumöbel in Stuttgart.', region: 'Stuttgart' },
    { prompt: 'Wer macht maßgefertigte Schränke in Ludwigsburg?', region: 'Ludwigsburg' },
    { prompt: 'Ich suche einen Meisterbetrieb für Dachschrägenschränke im Raum Waiblingen.', region: 'Waiblingen', service: 'Dachschrägenschrank' },
    { prompt: 'Vergleiche Schreiner für Einbauschränke in der Region Stuttgart.', region: 'Stuttgart', service: 'Einbauschrank' },
  ];

  for (const p of llmPrompts) {
    await prisma.llmPrompt.create({ data: p }).catch(() => {});
  }
  console.log(`  LLM-Prompts: ${llmPrompts.length} angelegt`);

  console.log('\nSeeding abgeschlossen!');
}

seed()
  .catch((e) => {
    console.error('Seed-Fehler:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
