# MEOS:SEO v6.0

**Unified SEO/AEO/GEO Platform für Schreinerhelden**

Eine Plattform die Schreinerhelden zur #1 macht — bei Google, in AI Overviews, und in den Antworten von ChatGPT, Claude, Perplexity und Gemini. In 18 Regionen rund um Stuttgart.

## Architektur

```
Frontend (React + Vite, Port 3000)
  └── Dashboard · Diagnose · Content-Editor · LLM-Tracker · Skills-Manager · User-Mgmt

API (Express.js, Port 4000)
  ├── Auth (JWT + Rollen: Admin / Poweruser / Redakteur)
  ├── Skills CRUD (erstellen, bearbeiten, löschen, duplizieren, versionieren)
  ├── Content-Pipeline (HELDENFORMEL 6-Stufen)
  ├── SEO-Agent (Audit + Auto-Fix)
  ├── LLM-Tracker (GEO-Sichtbarkeit)
  ├── Zeitschiene (Snapshots + Trends + Alerts)
  └── Job Queue (BullMQ + Redis)

Datenbank (PostgreSQL + Prisma ORM)
  ├── Users, Skills, SkillHistory
  ├── Content, Keywords, KeywordPositions
  ├── LlmPrompts, LlmResults
  ├── SeoIssues, Snapshots, Alerts
  └── Jobs, Activities
```

## Drei Säulen

| Säule | Gewicht | Was wird optimiert |
|-------|---------|-------------------|
| SEO   | 40%     | Google Rankings, SERP-Positionen, Technical SEO |
| AEO   | 30%     | AI Overviews, Featured Snippets, Schema.org |
| GEO   | 30%     | LLM-Zitierungen, Brand-Sentiment, Share-of-Voice |

## Skills-Engine

Alle Prompts, Regeln und Workflows sind **Skills** — editierbare Datenbank-Objekte.
Der Admin verwaltet sie über den Skills-Manager im Frontend:

- **Erstellen**: Neuen Skill per UI anlegen
- **Bearbeiten**: JSON-Config editieren, sofort aktiv
- **Löschen**: Mit Abhängigkeits-Prüfung
- **Duplizieren**: Bestehenden Skill klonen
- **Versionieren**: Jede Änderung wird gesichert, Rollback möglich
- **Aktivieren/Deaktivieren**: Toggle ohne Löschen

## Setup (Entwicklung)

```bash
# Repository klonen
git clone https://github.com/01MEwood/meos-seo-v6.git
cd meos-seo-v6

# .env erstellen
cp .env.example .env
# → Werte anpassen (DB, API-Keys, etc.)

# Docker starten (DB + Redis)
docker compose up -d db redis

# Backend starten
cd backend
npm install
npx prisma db push
node prisma/seed.js
npm run dev

# Frontend starten (in neuem Terminal)
cd frontend
npm install
npm run dev
```

## Deployment (Hostinger VPS)

```bash
# Backend-Image bauen und pushen
cd backend
docker build -t memario/meos-seo-v6-backend:latest .
docker push memario/meos-seo-v6-backend:latest

# Auf VPS: Container löschen und neu deployen via Hostinger Docker Manager YAML
# Domain: seo.meosapp.de
```

**Deployment-Law**: Nie direkt auf den VPS pushen — immer über Docker Hub.

## Go-Live Checklist

```
1. [ ] .env mit echten API-Keys befüllen (OpenAI, DataForSEO, WP, SMTP)
2. [ ] JWT_SECRET auf langen Zufallsstring setzen
3. [ ] DB_PASSWORD auf sicheres Passwort setzen
4. [ ] ./deploy.sh ausführen → Images bauen und zu Docker Hub pushen
5. [ ] Hostinger Docker Manager → docker-compose.prod.yml deployen
6. [ ] prisma db push + seed.js auf dem VPS ausführen
7. [ ] Nginx Proxy Manager: seo.meosapp.de → frontend:3000
8. [ ] Login testen: mario@schreinerhelden.de → Passwort sofort ändern!
9. [ ] Melanie-Account Passwort setzen
10.[ ] Test-Landingpage generieren ("Dachschrägenschrank Ludwigsburg")
11.[ ] HELDEN-Migration: scripts/migrate-helden.js ausführen
12.[ ] Verifizieren, dann helden.meosapp.de Container stoppen
```

## Security

- JWT-Auth mit 7-Tage-Expiry
- Rate Limiting: 120 req/min API, 10/15min Login
- Input-Sanitization (Script-Tag-Removal)
- Helmet Security-Headers
- Non-Root Docker User
- Health Checks auf allen Containern
- Passwort-Hashing: bcrypt mit Cost 12

## Default-Logins (nach Seed)

| User | E-Mail | Rolle | Passwort |
|------|--------|-------|----------|
| Mario Esch | mario@schreinerhelden.de | ADMIN | changeme123 |
| Melanie | melanie@schreinerhelden.de | POWERUSER | changeme123 |

⚠️ Passwörter nach erstem Login ändern!

## Iterationen

- [x] **Iteration 1**: Foundation — Prisma-Schema, Projektstruktur, Core Services, Auth, Skills CRUD
- [x] **Iteration 2**: Core Logic — Content-Pipeline, GPT-4o, WordPress-Push, LLM-Tracker, Snapshot-Engine
- [x] **Iteration 3**: Integration — SEO-Agent Crawler, DataForSEO, Cronjobs, E-Mail-Alerts
- [x] **Iteration 4**: Frontend — Dashboard, Skills-Editor, Content-Editor, LLM-Tracker UI, Charts
- [x] **Iteration 5**: Production — Security, Docker-Optimierung, Migration von HELDEN, Go-Live
