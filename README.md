# 🐺 SecurityNews

Plateforme de veille cybersécurité personnalisée par profils, alimentée par Claude AI.

## Stack

- **Frontend:** Astro SSR + TypeScript + React islands + Chart.js
- **Worker:** TypeScript (Node.js) + pg-boss + Drizzle ORM
- **DB:** PostgreSQL 16
- **Cache:** Redis 7
- **AI:** Anthropic Claude (haiku pour daily/weekly, sonnet pour monthly)

## Démarrage rapide

### 1. Prérequis

- Docker + Docker Compose
- Clé API Anthropic → https://console.anthropic.com/

### 2. Configuration

```bash
cp .env.example .env
# Éditer .env : renseigner POSTGRES_PASSWORD et ANTHROPIC_API_KEY
```

### 3. Lancer

```bash
# Créer les volumes
mkdir -p /opt/securitynews/volumes/{postgres,redis,logs}

# Build + start
docker compose up -d --build

# Vérifier les logs du worker
docker compose logs -f worker
```

L'app est disponible sur **http://localhost:3000**

### 4. Vérification

```bash
# Status des services
docker compose ps

# Logs frontend
docker compose logs frontend

# Logs worker (fetch RSS + jobs AI)
docker compose logs -f worker
```

## Pages

| URL | Description |
|-----|-------------|
| `/` | Home — preview actualités + Big Alert si critique |
| `/security-news` | Sélecteur de profils |
| `/security-news/nemea` | Profil Nemea — CVE/0day avec résumés AI |
| `/reporting` | KPIs — sources, volumes, stats |

## Profils

Les profils sont gérés manuellement en BDD. Le profil **Nemea** est seedé automatiquement au démarrage du worker.

## Tâches planifiées (pg-boss)

| Cron | Action |
|------|--------|
| `0 */2 * * *` | Fetch RSS + NVD + CISA KEV |
| `0 6 * * *` | Résumé daily par profil |
| `0 7 * * 1` | Résumé weekly (lundi) |
| `0 7 1 * *` | Résumé monthly (1er du mois) |

Le scan "Big News" (2-3h) est implémenté mais **désactivé par défaut**.

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL |
| `POSTGRES_PASSWORD` | Password BDD |
| `REDIS_URL` | URL Redis |
| `ANTHROPIC_API_KEY` | Clé API Claude |
| `PUBLIC_API_URL` | URL publique du frontend |
