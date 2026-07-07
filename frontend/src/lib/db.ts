import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      query_timeout: 15000,
    });
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
  lang: "fr" | "en" = "fr",
  mode: "concise" | "detailed" = "concise"
): Promise<Summary | null> {
  const db = getPool();
  const res = await db.query(
    `SELECT * FROM summaries WHERE profile_id = $1 AND period_type = $2 AND lang = $3 AND mode = $4
     ORDER BY period_start DESC LIMIT 1`,
    [profileId, periodType, lang, mode]
  );
  if (res.rows[0]) return res.rows[0];
  // Fallbacks : detailed absent → concise ; EN absent → FR
  if (mode === "detailed") {
    const conciseFallback = await db.query(
      `SELECT * FROM summaries WHERE profile_id = $1 AND period_type = $2 AND lang = $3 AND mode = 'concise'
       ORDER BY period_start DESC LIMIT 1`,
      [profileId, periodType, lang]
    );
    if (conciseFallback.rows[0]) return conciseFallback.rows[0];
  }
  if (lang === "en") {
    const fallback = await db.query(
      `SELECT * FROM summaries WHERE profile_id = $1 AND period_type = $2
       ORDER BY period_start DESC LIMIT 1`,
      [profileId, periodType]
    );
    return fallback.rows[0] ?? null;
  }
  return null;
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
  lang: "fr" | "en" = "fr",
  mode: "concise" | "detailed" = "concise"
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
    `SELECT * FROM summaries WHERE profile_id = $1 AND period_type = $2 AND period_start = $3 AND lang = $4 AND mode = $5 LIMIT 1`,
    [profileId, periodType, periodStart, lang, mode]
  );
  if (res.rows[0]) return res.rows[0];
  // Fallbacks : detailed → concise ; EN → n'importe quelle lang
  if (mode === "detailed") {
    const c = await db.query(
      `SELECT * FROM summaries WHERE profile_id = $1 AND period_type = $2 AND period_start = $3 AND lang = $4 AND mode = 'concise' LIMIT 1`,
      [profileId, periodType, periodStart, lang]
    );
    if (c.rows[0]) return c.rows[0];
  }
  if (lang === "en") {
    const fallback = await db.query(
      `SELECT * FROM summaries WHERE profile_id = $1 AND period_type = $2 AND period_start = $3 LIMIT 1`,
      [profileId, periodType, periodStart]
    );
    return fallback.rows[0] ?? null;
  }
  return null;
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
  // Depuis 2024 — le backfill NVD (worker/src/backfill-nvd.ts) fournit l'historique
  const chartStart = new Date(Date.UTC(2024, 0, 1));

  const rows: { app: string; month: string; count: number }[] = [];

  for (const app of monitoredApps) {
    const res = await db.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', published_at), 'YYYY-MM') AS month, COUNT(*) AS count
       FROM articles
       WHERE (LOWER(title) LIKE $1 OR LOWER(content) LIKE $1)
         AND published_at >= $2
       GROUP BY month
       ORDER BY month`,
      [`%${app.toLowerCase()}%`, chartStart]
    );
    for (const r of res.rows) {
      rows.push({ app, month: r.month, count: parseInt(r.count, 10) });
    }
  }

  return rows;
}

// ── CVE sub-page (interactive chart drill-down) ─────────────────────────────

export interface CveArticle extends Article {
  fix: string | null;
}

/** Extrait la ligne "Required Action: ..." du contenu CISA KEV si présente. */
function extractFix(content: string | null): string | null {
  if (!content) return null;
  const m = content.match(/Required Action:\s*(.+?)(?:\n|$)/);
  return m ? m[1].trim() : null;
}

/**
 * Articles de type CVE/vuln mentionnant une app, filtrables par année/mois.
 * Utilisé par la sous-page /security-news/[profile]/cve.
 */
export async function getCveArticlesForApp(
  app: string,
  opts: { year?: number | null; month?: string | null; limit?: number } = {}
): Promise<CveArticle[]> {
  const db = getPool();
  const conditions = [
    `(LOWER(title) LIKE $1 OR LOWER(content) LIKE $1)`,
    `(title ~* 'CVE-\\d{4}-\\d+' OR content ~* 'CVE-\\d{4}-\\d+' OR is_cisa_kev = true OR cvss_score IS NOT NULL)`,
  ];
  const params: unknown[] = [`%${app.toLowerCase()}%`];

  if (opts.month) {
    params.push(opts.month);
    conditions.push(`TO_CHAR(DATE_TRUNC('month', published_at), 'YYYY-MM') = $${params.length}`);
  } else if (opts.year) {
    params.push(opts.year);
    conditions.push(`EXTRACT(YEAR FROM published_at) = $${params.length}`);
  }

  params.push(opts.limit ?? 200);
  const res = await db.query(
    `SELECT * FROM articles
     WHERE ${conditions.join(" AND ")}
     ORDER BY published_at DESC
     LIMIT $${params.length}`,
    params
  );

  return res.rows.map((r: Article) => ({ ...r, fix: extractFix(r.content) }));
}

// ── Time-range queries (Kibana-like picker) ─────────────────────────────────

/**
 * Articles d'un profil sur une plage [start, end) arbitraire
 * (jour, semaine, mois — le picker construit la plage).
 */
export async function getArticlesForProfileRange(
  profileId: number,
  start: Date,
  end: Date,
  limit = 100
): Promise<{ articles: Article[]; total: number }> {
  const db = getPool();
  const [dataRes, countRes] = await Promise.all([
    db.query(
      `SELECT * FROM articles
       WHERE published_at >= $1 AND published_at < $2
         AND (profile_relevance->>$3)::int > 0
       ORDER BY published_at DESC
       LIMIT $4`,
      [start, end, profileId.toString(), limit]
    ),
    db.query(
      `SELECT COUNT(*) FROM articles
       WHERE published_at >= $1 AND published_at < $2
         AND (profile_relevance->>$3)::int > 0`,
      [start, end, profileId.toString()]
    ),
  ]);
  return { articles: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) };
}

export async function getSourcesForProfileRange(
  profileId: number,
  start: Date,
  end: Date
): Promise<{ source: string; count: number }[]> {
  const db = getPool();
  const res = await db.query(
    `SELECT source, COUNT(*) as count FROM articles
     WHERE published_at >= $1 AND published_at < $2
       AND (profile_relevance->>$3)::int > 0
     GROUP BY source ORDER BY count DESC`,
    [start, end, profileId.toString()]
  );
  return res.rows;
}

/** News "grand public" pour la Home : breaches, actu étatique/réglementaire —
 * uniquement les sources médias lisibles (exclut flux techniques CVE/releases). */
export async function getPublicNews(limit = 10): Promise<Article[]> {
  const db = getPool();
  const res = await db.query(
    `SELECT * FROM articles
     WHERE source NOT IN ('NVD CVEs', 'CISA KEV', 'Exploit-DB', 'Zero Day Initiative')
       AND source NOT LIKE 'GitHub —%'
       AND source NOT LIKE 'CISA%'
       AND source NOT LIKE 'ANSSI%'
       AND source != 'CERT-FR'
       AND (
         LOWER(title) LIKE ANY(ARRAY[
           '%breach%', '%leak%', '%fuite%', '%ransomware%', '%hack%',
           '%piratage%', '%cyberattaque%', '%cyberattack%', '%stolen%',
           '%vol de données%', '%government%', '%gouvernement%', '%police%',
           '%arrest%', '%law%', '%loi %', '%regulation%', '%nis2%', '%dora%',
           '%anssi%', '%cisa%', '%europe%', '%sanction%'
         ])
       )
     ORDER BY published_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

/** Stats rapides pour la Home : volume 7 derniers jours + compteurs. */
export async function getHomeStats(): Promise<{
  articles24h: number;
  articles7d: number;
  kev30d: number;
  sourcesActive: number;
  sparkline: { day: string; count: number }[];
}> {
  const db = getPool();
  const [a24, a7, kev, src, spark] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM articles WHERE published_at >= NOW() - INTERVAL '24 hours'`),
    db.query(`SELECT COUNT(*) FROM articles WHERE published_at >= NOW() - INTERVAL '7 days'`),
    db.query(`SELECT COUNT(*) FROM articles WHERE is_cisa_kev = true AND published_at >= NOW() - INTERVAL '30 days'`),
    db.query(`SELECT COUNT(*) FROM rss_sources WHERE is_active = true`),
    db.query(
      `SELECT TO_CHAR(DATE(published_at), 'YYYY-MM-DD') as day, COUNT(*) as count
       FROM articles
       WHERE published_at >= NOW() - INTERVAL '14 days'
       GROUP BY day ORDER BY day`
    ),
  ]);
  return {
    articles24h: parseInt(a24.rows[0].count, 10),
    articles7d: parseInt(a7.rows[0].count, 10),
    kev30d: parseInt(kev.rows[0].count, 10),
    sourcesActive: parseInt(src.rows[0].count, 10),
    sparkline: spark.rows.map((r: { day: string; count: string }) => ({
      day: r.day,
      count: parseInt(r.count, 10),
    })),
  };
}

export async function getReportingStats() {
  const db = getPool();

  const [sources, volume, totalArticles, totalSummaries, severity, topApps, health, kevRecent] = await Promise.all([
    db.query(
      `SELECT s.name, s.url, s.last_fetched, s.is_active,
              COALESCE(a.cnt, 0) AS articles_30d
       FROM rss_sources s
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS cnt FROM articles
         WHERE source = s.name AND published_at >= NOW() - INTERVAL '30 days'
       ) a ON true
       WHERE s.is_active = true
       ORDER BY a.cnt DESC NULLS LAST`
    ),
    db.query(
      `SELECT TO_CHAR(DATE(published_at), 'YYYY-MM-DD') as day, COUNT(*) as count
       FROM articles
       WHERE published_at >= NOW() - INTERVAL '30 days'
       GROUP BY day ORDER BY day`
    ),
    db.query(`SELECT COUNT(*) FROM articles`),
    db.query(`SELECT COUNT(*) FROM summaries`),
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_cisa_kev) AS kev,
         COUNT(*) FILTER (WHERE cvss_score >= 9.0) AS critical,
         COUNT(*) FILTER (WHERE cvss_score >= 7.0 AND cvss_score < 9.0) AS high,
         COUNT(*) FILTER (WHERE cvss_score > 0 AND cvss_score < 7.0) AS medium
       FROM articles WHERE published_at >= NOW() - INTERVAL '30 days'`
    ),
    db.query(
      `SELECT unnest(ARRAY['Proxmox','Teleport','Wazuh','Elasticsearch','Kibana','Keycloak','Grafana','Mailcow','OpenProject','Portainer','Velociraptor','Unifi','Windows','Linux']) AS app`
    ).then(async (appsRes) => {
      const out: { app: string; count: number }[] = [];
      for (const r of appsRes.rows as { app: string }[]) {
        const c = await db.query(
          `SELECT COUNT(*) FROM articles
           WHERE (LOWER(title) LIKE $1) AND published_at >= NOW() - INTERVAL '30 days'`,
          [`%${r.app.toLowerCase()}%`]
        );
        out.push({ app: r.app, count: parseInt(c.rows[0].count, 10) });
      }
      return out.filter((x) => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);
    }),
    db.query(
      `SELECT
         (SELECT MAX(last_fetched) FROM rss_sources) AS last_fetch,
         (SELECT MAX(generated_at) FROM summaries) AS last_summary,
         (SELECT COUNT(*) FROM rss_sources WHERE is_active = true AND (last_fetched IS NULL OR last_fetched < NOW() - INTERVAL '6 hours')) AS stale_sources`
    ),
    db.query(
      `SELECT title, url, published_at FROM articles
       WHERE is_cisa_kev ORDER BY published_at DESC LIMIT 5`
    ),
  ]);

  return {
    sources: sources.rows as { name: string; url: string; last_fetched: Date | null; is_active: boolean; articles_30d: string }[],
    volume: volume.rows as { day: string; count: string }[],
    totalArticles: parseInt(totalArticles.rows[0].count, 10),
    totalSummaries: parseInt(totalSummaries.rows[0].count, 10),
    severity: {
      kev: parseInt(severity.rows[0].kev, 10),
      critical: parseInt(severity.rows[0].critical, 10),
      high: parseInt(severity.rows[0].high, 10),
      medium: parseInt(severity.rows[0].medium, 10),
    },
    topApps,
    health: {
      lastFetch: health.rows[0].last_fetch as Date | null,
      lastSummary: health.rows[0].last_summary as Date | null,
      staleSources: parseInt(health.rows[0].stale_sources, 10),
    },
    kevRecent: kevRecent.rows as { title: string; url: string; published_at: Date }[],
  };
}
