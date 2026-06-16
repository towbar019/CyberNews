import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  }
  return pool;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Article {
  id: number;
  source: string;
  title: string;
  url: string;
  published_at: Date;
  content: string | null;
  profile_relevance: Record<string, number>;
  cvss_score: number | null;
  is_cisa_kev: boolean;
  is_read: boolean;
  created_at: Date;
}

export interface Summary {
  id: number;
  profile_id: number;
  period_type: "daily" | "weekly" | "monthly";
  period_start: Date;
  content_md: string;
  generated_at: Date;
}

export interface Profile {
  id: number;
  name: string;
  config: {
    description: string;
    monitoredApps: string[];
    keywords: string[];
  };
  created_at: Date;
}

export interface RssSource {
  id: number;
  name: string;
  url: string;
  last_fetched: Date | null;
  article_count: number;
  is_active: boolean;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getProfiles(): Promise<Profile[]> {
  const db = getPool();
  const res = await db.query("SELECT * FROM profiles ORDER BY name");
  return res.rows;
}

export async function getProfileByName(name: string): Promise<Profile | null> {
  const db = getPool();
  const res = await db.query("SELECT * FROM profiles WHERE LOWER(name) = LOWER($1)", [name]);
  return res.rows[0] ?? null;
}

export async function getLatestSummary(
  profileId: number,
  periodType: "daily" | "weekly" | "monthly",
  lang: "fr" | "en" = "fr"
): Promise<Summary | null> {
  const db = getPool();
  const res = await db.query(
    `SELECT * FROM summaries WHERE profile_id = $1 AND period_type = $2 AND lang = $3
     ORDER BY period_start DESC LIMIT 1`,
    [profileId, periodType, lang]
  );
  // Fallback to FR if EN not yet generated
  if (!res.rows[0] && lang === "en") {
    const fallback = await db.query(
      `SELECT * FROM summaries WHERE profile_id = $1 AND period_type = $2
       ORDER BY period_start DESC LIMIT 1`,
      [profileId, periodType]
    );
    return fallback.rows[0] ?? null;
  }
  return res.rows[0] ?? null;
}

export async function getSummariesForProfile(
  profileId: number,
  periodType: "daily" | "weekly" | "monthly",
  limit = 10
): Promise<Summary[]> {
  const db = getPool();
  const res = await db.query(
    `SELECT * FROM summaries WHERE profile_id = $1 AND period_type = $2
     ORDER BY period_start DESC LIMIT $3`,
    [profileId, periodType, limit]
  );
  return res.rows;
}

export async function getRecentArticles(limit = 20): Promise<Article[]> {
  const db = getPool();
  const res = await db.query(
    `SELECT * FROM articles ORDER BY published_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

export async function getBigAlertArticles(): Promise<Article[]> {
  const db = getPool();
  const res = await db.query(
    `SELECT * FROM articles
     WHERE is_cisa_kev = true OR cvss_score >= 9.8
     ORDER BY published_at DESC
     LIMIT 5`
  );
  return res.rows;
}

export async function getArticlesForProfile(
  profileId: number,
  page = 1,
  pageSize = 30
): Promise<{ articles: Article[]; total: number }> {
  const db = getPool();
  const offset = (page - 1) * pageSize;

  const [dataRes, countRes] = await Promise.all([
    db.query(
      `SELECT * FROM articles
       WHERE (profile_relevance->>$1)::int > 0
       ORDER BY published_at DESC
       LIMIT $2 OFFSET $3`,
      [profileId.toString(), pageSize, offset]
    ),
    db.query(
      `SELECT COUNT(*) FROM articles WHERE (profile_relevance->>$1)::int > 0`,
      [profileId.toString()]
    ),
  ]);

  return {
    articles: dataRes.rows,
    total: parseInt(countRes.rows[0].count, 10),
  };
}

export async function getArticlesForProfileByDate(
  profileId: number,
  date: Date,
  limit = 60
): Promise<{ articles: Article[]; total: number }> {
  const db = getPool();
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [dataRes, countRes] = await Promise.all([
    db.query(
      `SELECT * FROM articles
       WHERE published_at >= $1 AND published_at < $2
         AND (profile_relevance->>$3)::int > 0
       ORDER BY published_at DESC
       LIMIT $4`,
      [dayStart, dayEnd, profileId.toString(), limit]
    ),
    db.query(
      `SELECT COUNT(*) FROM articles
       WHERE published_at >= $1 AND published_at < $2
         AND (profile_relevance->>$3)::int > 0`,
      [dayStart, dayEnd, profileId.toString()]
    ),
  ]);

  return {
    articles: dataRes.rows,
    total: parseInt(countRes.rows[0].count, 10),
  };
}

export async function getSummaryForDate(
  profileId: number,
  periodType: "daily" | "weekly" | "monthly",
  date: Date,
  lang: "fr" | "en" = "fr"
): Promise<Summary | null> {
  const db = getPool();
  let periodStart: Date;
  if (periodType === "daily") {
    periodStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  } else if (periodType === "weekly") {
    const dow = date.getUTCDay();
    const daysToMon = dow === 0 ? 6 : dow - 1;
    periodStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysToMon));
  } else {
    periodStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  const res = await db.query(
    `SELECT * FROM summaries WHERE profile_id = $1 AND period_type = $2 AND period_start = $3 AND lang = $4 LIMIT 1`,
    [profileId, periodType, periodStart, lang]
  );
  if (!res.rows[0] && lang === "en") {
    const fallback = await db.query(
      `SELECT * FROM summaries WHERE profile_id = $1 AND period_type = $2 AND period_start = $3 LIMIT 1`,
      [profileId, periodType, periodStart]
    );
    return fallback.rows[0] ?? null;
  }
  return res.rows[0] ?? null;
}

export async function getSourcesForProfile(
  profileId: number,
  date?: Date
): Promise<{ source: string; count: number }[]> {
  const db = getPool();
  let query: string;
  let params: unknown[];
  if (date) {
    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    query = `SELECT source, COUNT(*) as count FROM articles
             WHERE published_at >= $1 AND published_at < $2
               AND (profile_relevance->>$3)::int > 0
             GROUP BY source ORDER BY count DESC`;
    params = [dayStart, dayEnd, profileId.toString()];
  } else {
    query = `SELECT source, COUNT(*) as count FROM articles
             WHERE (profile_relevance->>$1)::int > 0
             GROUP BY source ORDER BY count DESC`;
    params = [profileId.toString()];
  }
  const res = await db.query(query, params);
  return res.rows;
}

export async function getCveChartData(
  profileId: number,
  monitoredApps: string[]
): Promise<{ app: string; month: string; count: number }[]> {
  const db = getPool();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const rows: { app: string; month: string; count: number }[] = [];

  for (const app of monitoredApps) {
    const res = await db.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', published_at), 'YYYY-MM') AS month, COUNT(*) AS count
       FROM articles
       WHERE (LOWER(title) LIKE $1 OR LOWER(content) LIKE $1)
         AND published_at >= $2
       GROUP BY month
       ORDER BY month`,
      [`%${app.toLowerCase()}%`, sixMonthsAgo]
    );
    for (const r of res.rows) {
      rows.push({ app, month: r.month, count: parseInt(r.count, 10) });
    }
  }

  return rows;
}

export async function getReportingStats() {
  const db = getPool();

  const [sources, volume, totalArticles, totalSummaries] = await Promise.all([
    db.query(
      `SELECT name, url, last_fetched, article_count FROM rss_sources WHERE is_active = true ORDER BY article_count DESC`
    ),
    db.query(
      `SELECT DATE(published_at) as day, COUNT(*) as count
       FROM articles
       WHERE published_at >= NOW() - INTERVAL '30 days'
       GROUP BY day ORDER BY day`
    ),
    db.query(`SELECT COUNT(*) FROM articles`),
    db.query(`SELECT COUNT(*) FROM summaries`),
  ]);

  return {
    sources: sources.rows as { name: string; url: string; last_fetched: Date | null; article_count: number }[],
    volume: volume.rows as { day: string; count: number }[],
    totalArticles: parseInt(totalArticles.rows[0].count, 10),
    totalSummaries: parseInt(totalSummaries.rows[0].count, 10),
  };
}
