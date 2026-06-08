import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString: DATABASE_URL });

export const db = drizzle(pool, { schema });
export { pool };

export async function runMigrations(): Promise<void> {
  console.log("Running database migrations...");

  await pool.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'period_type') THEN
        CREATE TYPE period_type AS ENUM ('daily', 'weekly', 'monthly');
      END IF;
    END$$;`);

  await pool.query(`
    
    CREATE TABLE IF NOT EXISTS rss_sources (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL UNIQUE,
      last_fetched TIMESTAMP,
      article_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      config JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      source VARCHAR(255) NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      published_at TIMESTAMP NOT NULL,
      content TEXT,
      profile_relevance JSONB DEFAULT '{}',
      cvss_score REAL,
      is_cisa_kev BOOLEAN NOT NULL DEFAULT false,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS summaries (
      id SERIAL PRIMARY KEY,
      profile_id INTEGER NOT NULL,
      period_type period_type NOT NULL,
      period_start TIMESTAMP NOT NULL,
      content_md TEXT NOT NULL,
      generated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
    CREATE INDEX IF NOT EXISTS idx_articles_is_cisa_kev ON articles(is_cisa_kev) WHERE is_cisa_kev = true;
    CREATE INDEX IF NOT EXISTS idx_summaries_profile_period ON summaries(profile_id, period_type, period_start DESC);
  `);

  console.log("Migrations complete.");
}


export async function seedRssSources(): Promise<void> {
  const sources = [
    { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
    { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews" },
    { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/" },
    { name: "CERT-FR", url: "https://www.cert.ssi.gouv.fr/feed/" },
    { name: "NVD Recent CVEs", url: "https://nvd.nist.gov/feeds/json/cve/1.1/nvdcve-1.1-recent.json.gz" },
    { name: "CISA KEV", url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json" },
    { name: "Exploit-DB", url: "https://www.exploit-db.com/rss.xml" },
    { name: "Dark Reading", url: "https://www.darkreading.com/rss/all.xml" },
    { name: "SecurityWeek", url: "https://feeds.feedburner.com/securityweek" },
  ];

  for (const source of sources) {
    await pool.query(
      `INSERT INTO rss_sources (name, url) VALUES ($1, $2) ON CONFLICT (url) DO NOTHING`,
      [source.name, source.url]
    );
  }

  console.log("Seeded RSS sources.");
}
