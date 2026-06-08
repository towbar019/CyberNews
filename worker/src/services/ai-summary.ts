import Anthropic from "@anthropic-ai/sdk";
import { pool } from "../db/client";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type PeriodType = "daily" | "weekly" | "monthly";
type Lang = "fr" | "en";

interface ArticleRow {
  title: string;
  url: string;
  source: string;
  published_at: Date;
  content: string | null;
  cvss_score: number | null;
  is_cisa_kev: boolean;
  relevance: number;
}

async function getArticlesForPeriod(
  profileId: number,
  periodType: PeriodType,
  periodStart: Date
): Promise<ArticleRow[]> {
  let periodEnd: Date;
  if (periodType === "daily") {
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 1);
  } else if (periodType === "weekly") {
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 7);
  } else {
    periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const result = await pool.query(
    `SELECT title, url, source, published_at, content, cvss_score, is_cisa_kev,
            (profile_relevance->>$1)::int as relevance
     FROM articles
     WHERE published_at >= $2 AND published_at < $3
       AND (profile_relevance->>$1)::int > 0
     ORDER BY (profile_relevance->>$1)::int DESC, cvss_score DESC NULLS LAST
     LIMIT 100`,
    [profileId.toString(), periodStart, periodEnd]
  );

  return result.rows as ArticleRow[];
}

function formatArticlesForPrompt(articles: ArticleRow[]): string {
  if (articles.length === 0) return "Aucun article pertinent trouvé pour cette période.";

  return articles
    .slice(0, 50)
    .map((a, i) => {
      const cvss = a.cvss_score ? ` [CVSS: ${a.cvss_score}]` : "";
      const kev = a.is_cisa_kev ? " [CISA KEV]" : "";
      const content = a.content ? `\n  ${a.content.slice(0, 300)}` : "";
      return `${i + 1}. ${a.title}${cvss}${kev}\n   Source: ${a.source} | ${a.url}${content}`;
    })
    .join("\n\n");
}

function buildPrompt(
  profileName: string,
  profileConfig: { monitoredApps: string[]; keywords: string[] },
  periodType: PeriodType,
  periodStart: Date,
  articles: ArticleRow[],
  lang: Lang
): string {
  const periodLabelFr =
    periodType === "daily"
      ? `Journalier (${periodStart.toLocaleDateString("fr-FR")})`
      : periodType === "weekly"
      ? `Hebdomadaire (semaine du ${periodStart.toLocaleDateString("fr-FR")})`
      : `Mensuel (${periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })})`;

  const periodLabelEn =
    periodType === "daily"
      ? `Daily (${periodStart.toDateString()})`
      : periodType === "weekly"
      ? `Weekly (week of ${periodStart.toDateString()})`
      : `Monthly (${periodStart.toLocaleString("en-US", { month: "long", year: "numeric" })})`;

  const articleText = formatArticlesForPrompt(articles);
  const monitoredApps = profileConfig.monitoredApps.join(", ");

  if (lang === "fr") {
    return `Tu es un analyste cybersécurité générant un briefing de sécurité ${periodType === "daily" ? "journalier" : periodType === "weekly" ? "hebdomadaire" : "mensuel"} pour le profil "${profileName}".

Focus profil : CVE, vulnérabilités 0-day, problèmes de sécurité exploitables
Applications surveillées : ${monitoredApps || "Général"}
Période : ${periodLabelFr}

Articles à analyser :
${articleText}

Génère le briefing en Markdown avec cette structure :

# Briefing Sécurité ${periodType === "daily" ? "du Jour" : periodType === "weekly" ? "Hebdomadaire" : "Mensuel"} — ${profileName}

## 🚨 Alertes Critiques (CVSS ≥ 9.0 ou CISA KEV)
Vulnérabilités critiques avec détails techniques concis.

## 🔴 Sévérité Haute (CVSS 7.0-8.9)
Principaux problèmes haute sévérité.

## 📊 Points Clés
Actualités sécurité importantes et tendances pour les applications surveillées.

## 🛡️ Actions Recommandées
Actions concrètes pour chaque item critique/haute sévérité.

## 📝 Résumé
2-3 phrases de synthèse sur le paysage des menaces.

---
*Généré automatiquement par SecurityNews AI.*

Reste technique, concis et orienté action. **Réponds entièrement en français.**`;
  }

  // lang === "en"
  return `You are a cybersecurity analyst generating a ${periodType} security briefing for the "${profileName}" profile.

Profile focus: CVE, 0-day vulnerabilities, exploitable security issues
Monitored applications: ${monitoredApps || "General"}
Period: ${periodLabelEn}

Articles to analyze:
${articleText}

Generate the briefing in Markdown with this structure:

# ${periodType === "daily" ? "Daily" : periodType === "weekly" ? "Weekly" : "Monthly"} Security Briefing — ${profileName}

## 🚨 Critical Alerts (CVSS ≥ 9.0 or CISA KEV)
Critical vulnerabilities with concise technical details.

## 🔴 High Severity (CVSS 7.0-8.9)
Key high-severity findings.

## 📊 Key Findings
Important security news and trends for monitored applications.

## 🛡️ Recommended Actions
Concrete actions for each critical/high severity item.

## 📝 Summary
2-3 sentence executive summary of the period's threat landscape.

---
*Automatically generated by SecurityNews AI.*

Keep it technical, concise, and actionable. **Respond entirely in English.**`;
}

// Generate summary for a specific language
async function generateSummaryForLang(
  profileId: number,
  periodType: PeriodType,
  periodStart: Date,
  lang: Lang,
  articles: ArticleRow[],
  profileName: string,
  profileConfig: { monitoredApps: string[]; keywords: string[] }
): Promise<void> {
  // Check if summary already exists for this lang
  const existing = await pool.query(
    `SELECT id FROM summaries WHERE profile_id = $1 AND period_type = $2 AND period_start = $3 AND lang = $4`,
    [profileId, periodType, periodStart, lang]
  );

  if (existing.rows.length > 0) {
    console.log(`[AI] Summary (${lang}) already exists for profile ${profileId}, skipping.`);
    return;
  }

  const prompt = buildPrompt(profileName, profileConfig, periodType, periodStart, articles, lang);
  const model = "claude-haiku-4-5";

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: periodType === "monthly" ? 4096 : 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type");

    await pool.query(
      `INSERT INTO summaries (profile_id, period_type, period_start, content_md, lang)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [profileId, periodType, periodStart, content.text, lang]
    );

    console.log(`[AI] Summary (${lang}) stored (${content.text.length} chars).`);
  } catch (err) {
    console.error(`[AI] Failed to generate summary (${lang}): ${String(err)}`);
    throw err;
  }
}

// Generate both FR + EN for a profile/period
export async function generateSummary(
  profileId: number,
  periodType: PeriodType,
  periodStart: Date
): Promise<void> {
  console.log(`[AI] Generating ${periodType} summary for profile ${profileId} (${periodStart.toISOString()})`);

  const profileResult = await pool.query(
    "SELECT name, config FROM profiles WHERE id = $1",
    [profileId]
  );
  if (profileResult.rows.length === 0) {
    console.error(`[AI] Profile ${profileId} not found`);
    return;
  }
  const profile = profileResult.rows[0] as { name: string; config: { monitoredApps: string[]; keywords: string[] } };

  const articles = await getArticlesForPeriod(profileId, periodType, periodStart);
  console.log(`[AI] Found ${articles.length} relevant articles.`);

  // Generate FR first, then EN
  await generateSummaryForLang(profileId, periodType, periodStart, "fr", articles, profile.name, profile.config);
  await generateSummaryForLang(profileId, periodType, periodStart, "en", articles, profile.name, profile.config);
}

export async function generateAllSummaries(
  periodType: PeriodType,
  periodStart: Date
): Promise<void> {
  const profilesResult = await pool.query("SELECT id FROM profiles");
  for (const p of profilesResult.rows as { id: number }[]) {
    await generateSummary(p.id, periodType, periodStart);
  }
}
