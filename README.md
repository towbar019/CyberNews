# 🐺 SecurityNews

Personalized cybersecurity monitoring platform, powered by Claude AI.
RSS/API feeds are ingested continuously, scored per profile, and turned into
daily / weekly / monthly AI briefings (FR + EN).

> This repository contains **source code only**. Deployment, infrastructure and
> operational documentation live outside the repo.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Astro 7 (SSR) + TypeScript + React islands + Chart.js |
| Worker | TypeScript (Node.js 22) + pg-boss + Drizzle ORM + rss-parser + axios + zod |
| DB | PostgreSQL 17 |
| Cache | Redis 8 |
| AI | Anthropic Claude API (`claude-haiku-4-5`) |
| Proxy | nginx (TLS) |

## Source tree

```
.
├── docker-compose.yml            # 5 services: frontend, worker, postgres, redis, nginx
├── .env.example                  # template des variables d'environnement (secrets)
├── diagram.mmd                   # diagramme d'architecture (Mermaid)
├── nginx/
│   └── securitynews.conf         # reverse proxy TLS (80→443 redirect, proxy → frontend:3000)
│
├── frontend/                     # ── Site web (Astro SSR) ──
│   ├── astro.config.mjs          # config Astro (adapter node standalone, host/port)
│   ├── Dockerfile                # build multi-stage node:22-alpine
│   ├── public/                   # assets statiques (logo, favicon)
│   └── src/
│       ├── middleware.ts         # headers de sécurité HTTP (CSP, X-Frame-Options, nosniff…)
│       ├── layouts/
│       │   └── Base.astro        # layout global : design tokens CSS (:root), navbar, footer, i18n FR/EN
│       ├── lib/
│       │   ├── db.ts             # toutes les requêtes SQL (pg, requêtes paramétrées) :
│       │   │                     #   profils, summaries, articles, plages temporelles,
│       │   │                     #   chart CVE, sous-page CVE (getCveArticlesForApp), stats home
│       │   ├── security.ts       # sanitisation : safeUrl (anti javascript:), escapeHtml,
│       │   │                     #   markdownToHtml sanitisé, schémas zod des params URL
│       │   └── i18n.ts           # traductions FR/EN + helpers t() / getLang()
│       ├── components/           # React islands (hydratés client-side)
│       │   ├── CVEChart.tsx      # histogramme CVE par app (12 mois), filtres par app,
│       │   │                     #   drill-down au clic → /security-news/[profile]/cve?app&month
│       │   ├── Timeline.tsx      # timeline articles avec vu/non-vu (localStorage)
│       │   ├── VolumeChart.tsx   # volume articles/jour (page reporting)
│       │   └── PDFExportButton.tsx # export PDF du briefing (fenêtre print, DOM sûr)
│       └── pages/
│           ├── index.astro       # Home : hero animé, alertes critiques, stats live, sparkline
│           ├── profiles/index.astro       # résumés éditoriaux des profils
│           ├── reporting.astro   # KPIs : sources, volumes, derniers fetches
│           └── security-news/
│               ├── index.astro   # sélecteur de profils
│               ├── [profile].astro        # page briefing : tabs daily/weekly/monthly,
│               │                          #   time picker (jour/semaine/mois + presets),
│               │                          #   vue Résumé/Détaillé, sources, chart CVE full-width
│               └── [profile]/cve.astro    # explorateur CVE : table (vulnérabilité, fix,
│                                          #   score, date) + filtres app/année/mois/tri
│
└── worker/                       # ── Ingestion + génération AI ──
    ├── Dockerfile
    ├── drizzle.config.ts
    ├── RESEARCH.md               # ★ doc du module de recherche : pipeline, règles pour le
    │                             #   modèle AI, affectation sources→profils, instructions profils
    └── src/
        ├── index.ts              # entrypoint : migrations → seeds → scheduler
        ├── gen-summaries-manual.ts  # régénération manuelle des résumés (node dist/gen-summaries-manual.js)
        ├── db/
        │   ├── client.ts         # pool pg + migrations SQL idempotentes
        │   ├── schema.ts         # schéma Drizzle (articles, summaries, profiles, rss_sources)
        │   └── seeds.ts          # ★ profils (config + promptInstructions injectées dans les
        │                         #   prompts AI, upsert au démarrage) + sources RSS/API
        ├── jobs/
        │   └── scheduler.ts      # pg-boss : fetch 2h, daily 06h, weekly lun 07h, monthly 1er 07h (UTC)
        └── services/
            ├── rss-fetcher.ts    # fetch RSS/Atom (fallback axios + sanitisation XML),
            │                     #   NVD API v2 (clé optionnelle NVD_API_KEY, retry backoff),
            │                     #   CISA KEV (URL unique par CVE), scoring par profil (sourceScope)
            ├── ai-summary.ts     # génération briefings Claude (FR+EN), prompts construits
            │                     #   depuis profiles.config.promptInstructions
            └── redis.ts          # helpers cache
```

## Data flow

```
Sources (RSS / CISA KEV / NVD API / Google News / GitHub releases)
   → worker: fetch (2h) → scoring par profil → PostgreSQL
   → worker: Claude API → summaries FR+EN (daily/weekly/monthly)
   → frontend: SSR read-only sur PostgreSQL
```

See `diagram.mmd` for the full architecture diagram.

## Quick start (dev)

```bash
cp .env.example .env          # renseigner POSTGRES_PASSWORD + ANTHROPIC_API_KEY (+ NVD_API_KEY)
mkdir -p /opt/securitynews/volumes/{postgres,redis,logs,nginx-logs} /opt/securitynews/certs
# générer un cert TLS autosigné dans /opt/securitynews/certs/ (ou retirer le service nginx)
docker compose up -d --build
```

- Frontend : http://localhost:3000 (direct) / https://localhost (nginx TLS)
- Logs worker : `docker compose logs -f worker`

## Profiles

Profiles are seeded (upserted) from `worker/src/db/seeds.ts` — each profile embeds
its full AI processing instructions (`promptInstructions`) and its source scope.
See `worker/RESEARCH.md` for the research module documentation.

| Profile | Focus |
|---|---|
| **Nemea** | SOC/CERT ops — strict CVE/0-day tracking on a defined app perimeter (CISA KEV / CVSS alerting) |
| **Axel** | Macro CISO view — strategic threats, governance, AI/SecOps/Cloud watch |
