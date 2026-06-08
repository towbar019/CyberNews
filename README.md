# 🐺 SecurityNews

Customized cybersecurity intelligence platform by profiles, powered by Claude AI.

## Stack

- **Frontend:** Astro SSR + TypeScript + React islands + Chart.js
- **Worker:** TypeScript (Node.js) + pg-boss + Drizzle ORM
- **DB:** PostgreSQL 16
- **Cache:** Redis 7
- **AI:** Anthropic Claude (haiku for daily/weekly, sonnet for monthly)

## Quick Start

### 1. Prerequisites

- Docker + Docker Compose
- Anthropic API Key → https://console.anthropic.com/

### 2. Configuration

```bash
cp .env.example .env
# Edit .env: fill in POSTGRES_PASSWORD and ANTHROPIC_API_KEY
3. StartBash# Create volumes
mkdir -p /opt/securitynews/volumes/{postgres,redis,logs}
```
# Build + start
```bash
docker compose up -d --build
```
# Check worker logs
```bash
docker compose logs -f worker
The app is available at http://localhost:30004. VerificationBash# Services status
docker compose ps
```
# Frontend logs
```bash
docker compose logs frontend
```
# Worker logs (RSS fetch + AI jobs)
```bash
docker compose logs -f worker
```
PagesURLDescription/Home — news preview + Big Alert if critical/security-newsProfile selector/security-news/nemeaNemea Profile — CVE/0day with AI summaries/reportingKPIs — sources, volumes, statsProfilesProfiles are managed manually in the DB. The Nemea profile is automatically seeded when the worker starts.Scheduled Tasks (pg-boss)CronAction0 */2 * * *Fetch RSS + NVD + CISA KEV0 6 * * *Daily summary per profile0 7 * * 1Weekly summary (Monday)0 7 1 * *Monthly summary (1st of the month)The "Big News" scan (2-3h) is implemented but disabled by default.Environment VariablesVariableDescriptionDATABASE_URLPostgreSQL URLPOSTGRES_PASSWORDDB PasswordREDIS_URLRedis URLANTHROPIC_API_KEYClaude API KeyPUBLIC_API_URLFrontend public URL
