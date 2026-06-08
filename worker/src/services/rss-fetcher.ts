import Parser from "rss-parser";
import axios from "axios";
import { z } from "zod";
// pako removed — NVD v2 API replaces the old .json.gz feed
import { pool } from "../db/client";
import { getCached, setCached } from "./redis";

// Browser-like User-Agent to avoid 403s
const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0";

const rssParser = new Parser({
  timeout: 30000,
  headers: { "User-Agent": UA },
});

// ── Zod schemas ────────────────────────────────────────────────────────────

const RssItemSchema = z.object({
  title: z.string().optional(),
  link: z.string().optional(),
  pubDate: z.string().optional(),
  isoDate: z.string().optional(),
  content: z.string().optional(),
  contentSnippet: z.string().optional(),
  summary: z.string().optional(),
});

// NVD API v2 schema
const NvdV2CveSchema = z.object({
  cve: z.object({
    id: z.string(),
    published: z.string(),
    descriptions: z.array(z.object({ lang: z.string(), value: z.string() })),
    metrics: z
      .object({
        cvssMetricV31: z
          .array(z.object({ cvssData: z.object({ baseScore: z.number() }) }))
          .optional(),
        cvssMetricV30: z
          .array(z.object({ cvssData: z.object({ baseScore: z.number() }) }))
          .optional(),
        cvssMetricV2: z
          .array(z.object({ cvssData: z.object({ baseScore: z.number() }) }))
          .optional(),
      })
      .optional(),
    references: z.array(z.object({ url: z.string() })).optional(),
  }),
});

const NvdV2FeedSchema = z.object({
  vulnerabilities: z.array(NvdV2CveSchema).optional(),
});

const CisaKevItemSchema = z.object({
  cveID: z.string(),
  vendorProject: z.string(),
  product: z.string(),
  vulnerabilityName: z.string(),
  dateAdded: z.string(),
  shortDescription: z.string(),
  requiredAction: z.string(),
  dueDate: z.string(),
});

const CisaKevFeedSchema = z.object({
  vulnerabilities: z.array(CisaKevItemSchema),
});

// ── Types ──────────────────────────────────────────────────────────────────

type ParsedArticle = {
  source: string;
  title: string;
  url: string;
  publishedAt: Date;
  content: string | null;
  cvssScore: number | null;
  isCisaKev: boolean;
};

// ── RSS / Atom fetcher (handles standard + GitHub releases.atom) ───────────

async function fetchRssFeed(
  sourceId: number,
  sourceName: string,
  url: string
): Promise<ParsedArticle[]> {
  const cacheKey = `rss:${sourceId}`;
  const cached = await getCached<ParsedArticle[]>(cacheKey);
  if (cached) {
    console.log(`  [cache hit] ${sourceName}`);
    return cached;
  }

  try {
    console.log(`  [fetching] ${sourceName}`);
    const feed = await rssParser.parseURL(url);
    const articles: ParsedArticle[] = [];

    for (const item of feed.items) {
      const parsed = RssItemSchema.safeParse(item);
      if (!parsed.success) continue;

      const { title, link, pubDate, isoDate, content, contentSnippet, summary } = parsed.data;
      if (!title || !link) continue;

      const publishedAt = isoDate
        ? new Date(isoDate)
        : pubDate
        ? new Date(pubDate)
        : new Date();

      articles.push({
        source: sourceName,
        title: title.trim(),
        url: link,
        publishedAt,
        content: content || contentSnippet || summary || null,
        cvssScore: null,
        isCisaKev: false,
      });
    }

    await setCached(cacheKey, articles, 7200);
    return articles;
  } catch (err) {
    console.error(`  [error] ${sourceName}: ${String(err)}`);
    return [];
  }
}

// ── NVD API v2 ─────────────────────────────────────────────────────────────

async function fetchNvdApiV2(): Promise<ParsedArticle[]> {
  const cacheKey = "nvd:v2:recent";
  const cached = await getCached<ParsedArticle[]>(cacheKey);
  if (cached) {
    console.log("  [cache hit] NVD API v2");
    return cached;
  }

  try {
    console.log("  [fetching] NVD API v2 — CVEs récents");

    // Last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace("Z", "+00:00").slice(0, 19) + "+00:00";

    const response = await axios.get(
      "https://services.nvd.nist.gov/rest/json/cves/2.0",
      {
        params: {
          pubStartDate: fmt(sevenDaysAgo),
          pubEndDate: fmt(now),
          resultsPerPage: 100,
        },
        timeout: 60000,
        headers: { "User-Agent": UA },
      }
    );

    const feed = NvdV2FeedSchema.safeParse(response.data);
    if (!feed.success) {
      console.error("  [error] NVD v2 schema validation failed");
      return [];
    }

    const articles: ParsedArticle[] = [];
    for (const vuln of feed.data.vulnerabilities ?? []) {
      const { cve } = vuln;
      const cveId = cve.id;
      const desc =
        cve.descriptions.find((d) => d.lang === "en")?.value ||
        cve.descriptions[0]?.value ||
        "No description";
      const refUrl = cve.references?.[0]?.url;
      const url = refUrl || `https://nvd.nist.gov/vuln/detail/${cveId}`;

      const cvssScore =
        cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ??
        cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore ??
        cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore ??
        null;

      articles.push({
        source: "NVD CVEs",
        title: `${cveId}: ${desc.slice(0, 160)}`,
        url,
        publishedAt: new Date(cve.published),
        content: desc,
        cvssScore,
        isCisaKev: false,
      });
    }

    console.log(`  [nvd v2] ${articles.length} CVEs récupérés`);
    await setCached(cacheKey, articles, 3600); // 1h cache (NVD rate limits)
    return articles;
  } catch (err) {
    console.error(`  [error] NVD API v2: ${String(err)}`);
    return [];
  }
}

// ── CISA KEV ───────────────────────────────────────────────────────────────

async function fetchCisaKev(): Promise<ParsedArticle[]> {
  const cacheKey = "cisa:kev";
  const cached = await getCached<ParsedArticle[]>(cacheKey);
  if (cached) {
    console.log("  [cache hit] CISA KEV");
    return cached;
  }

  try {
    console.log("  [fetching] CISA KEV");
    const response = await axios.get(
      "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
      { timeout: 30000, headers: { "User-Agent": UA } }
    );

    const feedData = CisaKevFeedSchema.safeParse(response.data);
    if (!feedData.success) {
      console.error("  [error] CISA KEV schema failed");
      return [];
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const articles: ParsedArticle[] = feedData.data.vulnerabilities
      .filter((v) => new Date(v.dateAdded) > thirtyDaysAgo)
      .map((v) => ({
        source: "CISA KEV",
        title: `${v.cveID}: ${v.vulnerabilityName} (${v.vendorProject} ${v.product})`,
        url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
        publishedAt: new Date(v.dateAdded),
        content: `${v.shortDescription}\n\nRequired Action: ${v.requiredAction}\nDue Date: ${v.dueDate}`,
        cvssScore: null,
        isCisaKev: true,
      }));

    await setCached(cacheKey, articles, 7200);
    return articles;
  } catch (err) {
    console.error(`  [error] CISA KEV: ${String(err)}`);
    return [];
  }
}

// ── Scoring ────────────────────────────────────────────────────────────────

function scoreArticleRelevance(
  article: ParsedArticle,
  profileConfig: { monitoredApps: string[]; keywords: string[] }
): number {
  const text = `${article.title} ${article.content || ""}`.toLowerCase();
  let score = 0;

  for (const app of profileConfig.monitoredApps) {
    if (text.includes(app.toLowerCase())) score += 10;
  }
  for (const keyword of profileConfig.keywords) {
    if (text.includes(keyword.toLowerCase())) score += 5;
  }

  if (article.isCisaKev) score += 20;
  if (article.cvssScore && article.cvssScore >= 9.0) score += 15;
  if (article.cvssScore && article.cvssScore >= 7.0) score += 5;

  // Boost GitHub release mentions for monitored apps
  if (article.source.startsWith("GitHub —")) score += 8;

  return score;
}

// ── Store ──────────────────────────────────────────────────────────────────

async function storeArticles(articles: ParsedArticle[]): Promise<number> {
  let stored = 0;
  for (const article of articles) {
    try {
      await pool.query(
        `INSERT INTO articles (source, title, url, published_at, content, cvss_score, is_cisa_kev)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (url) DO UPDATE SET
           cvss_score = EXCLUDED.cvss_score,
           is_cisa_kev = EXCLUDED.is_cisa_kev`,
        [
          article.source,
          article.title,
          article.url,
          article.publishedAt,
          article.content,
          article.cvssScore,
          article.isCisaKev,
        ]
      );
      stored++;
    } catch (err) {
      console.error(`  [error] store "${article.title?.slice(0, 60)}": ${String(err)}`);
    }
  }
  return stored;
}

async function updateProfileRelevance(articles: ParsedArticle[]): Promise<void> {
  const profilesResult = await pool.query("SELECT id, name, config FROM profiles");
  const profiles = profilesResult.rows as {
    id: number;
    name: string;
    config: { monitoredApps: string[]; keywords: string[] };
  }[];

  for (const article of articles) {
    const relevance: Record<string, number> = {};
    for (const profile of profiles) {
      relevance[profile.id] = scoreArticleRelevance(article, profile.config);
    }
    await pool.query(
      `UPDATE articles SET profile_relevance = $1 WHERE url = $2`,
      [JSON.stringify(relevance), article.url]
    );
  }
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function fetchAllFeeds(): Promise<void> {
  console.log("[RSS] Starting feed fetch cycle...");

  // RSS/Atom sources from DB (covers standard RSS + GitHub releases.atom)
  const sourcesResult = await pool.query(
    `SELECT id, name, url FROM rss_sources
     WHERE is_active = true
       AND url NOT LIKE '%.json%'
       AND url NOT LIKE '%.json.gz'`
  );
  const rssSources = sourcesResult.rows as { id: number; name: string; url: string }[];

  const allArticles: ParsedArticle[] = [];

  for (const source of rssSources) {
    const articles = await fetchRssFeed(source.id, source.name, source.url);
    allArticles.push(...articles);
    await pool.query(
      "UPDATE rss_sources SET last_fetched = NOW(), article_count = article_count + $1 WHERE id = $2",
      [articles.length, source.id]
    );
  }

  // NVD API v2
  const nvdArticles = await fetchNvdApiV2();
  allArticles.push(...nvdArticles);

  // CISA KEV
  const cisaArticles = await fetchCisaKev();
  allArticles.push(...cisaArticles);

  // Store + score
  const stored = await storeArticles(allArticles);
  console.log(`[RSS] Stored ${stored} / ${allArticles.length} articles.`);

  await updateProfileRelevance(allArticles);
  console.log("[RSS] Profile relevance updated.");
}
