import Anthropic from "@anthropic-ai/sdk";
import { pool } from "../db/client";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type PeriodType = "daily" | "weekly" | "monthly";
type Lang = "fr" | "en";
type Mode = "concise" | "detailed";

type ProfileConfig = {
  description?: string;
  monitoredApps: string[];
  keywords: string[];
  promptInstructions?: string;
};

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
  profileConfig: ProfileConfig,
  periodType: PeriodType,
  periodStart: Date,
  articles: ArticleRow[],
  lang: Lang,
  mode: Mode = "concise"
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

  // Instructions par profil (stockées en DB, cf. worker/src/db/seeds.ts et
  // worker/RESEARCH.md). Si absentes → fallback générique.
  const instructions =
    profileConfig.promptInstructions ??
    `Focus profil : CVE, vulnérabilités 0-day, problèmes de sécurité exploitables.
Applications surveillées : ${monitoredApps || "Général"}

Génère le briefing en Markdown avec cette structure :
## 🚨 Alertes Critiques (CVSS ≥ 9.0 ou CISA KEV)
## 🔴 Sévérité Haute (CVSS 7.0-8.9)
## 📊 Points Clés
## 🛡️ Actions Recommandées
## 📝 Résumé`;

  const langDirective =
    lang === "fr"
      ? "**Réponds entièrement en français.**"
      : "**Respond entirely in English. Translate all section headings to English while keeping the exact same structure and emojis.**";

  // Mode détaillé : mêmes sections que le concis, mais paragraphes réécrits et
  // enrichis + sources par paragraphe. Feedback Axel 2026-07-03 : le détaillé ne
  // doit PAS être une liste d'articles bruts — c'est le briefing concis
  // développé (contexte entreprise/acteur, plus-value, impact sécurité).
  const modeDirective =
    mode === "detailed"
      ? `
MODE D'AFFICHAGE : DÉTAILLÉ
- Garde EXACTEMENT la même structure de sections que le format imposé ci-dessus.
- RÉÉCRIS chaque sujet en version développée : pour chaque acteur/entreprise/menace cité, ajoute le contexte (qui ils sont, leur rôle/plus-value dans l'écosystème), l'impact concret pour la sécurité, et pourquoi c'est important pour le lecteur.
- Chaque paragraphe se termine par ses sources au format : *Sources : [Titre court](url), [Titre court](url)* — uniquement des URLs présentes dans les articles fournis.
- Reste CONCRET : acteurs nommés, chiffres, dates, versions. Bannis les généralités abstraites ("paysage de menaces en évolution", "convergence des vecteurs"...). Chaque affirmation doit être rattachée à un fait sourcé.
- Longueur : environ 2 à 3 fois le mode condensé.`
      : `
MODE D'AFFICHAGE : CONDENSÉ
- Paragraphes courts, synthétiques. Va à l'essentiel.
- Reste CONCRET : acteurs nommés, faits, chiffres. Bannis les généralités abstraites — chaque phrase de synthèse doit être ancrée dans un événement réel des articles.`;

  return `Tu es un analyste cybersécurité générant un briefing ${periodType === "daily" ? "journalier" : periodType === "weekly" ? "hebdomadaire" : "mensuel"} pour le profil "${profileName}".

MÉTHODE DE TRAVAIL (important — prends le temps) :
1. Lis TOUS les articles fournis ci-dessous avant de rédiger quoi que ce soit.
2. Applique STRICTEMENT les instructions de traitement du profil — elles définissent le périmètre, le tri et le format. Ne dévie pas.
3. Vérifie chaque affirmation contre les articles sources ; n'invente jamais de CVE, de score ou d'événement.
4. Si aucun article ne correspond au périmètre du profil, dis-le explicitement dans les sections concernées.

INSTRUCTIONS DE TRAITEMENT DU PROFIL "${profileName}" :
${instructions}
${modeDirective}

Période : ${lang === "fr" ? periodLabelFr : periodLabelEn}

Articles à analyser (${articles.length}) :
${articleText}

Commence par le titre : # Briefing ${periodType === "daily" ? "Journalier" : periodType === "weekly" ? "Hebdomadaire" : "Mensuel"} — ${profileName}

Termine par : ---
*Généré automatiquement par SecurityNews AI.*

${langDirective}`;
}

// Generate summary for a specific language + mode
async function generateSummaryForLang(
  profileId: number,
  periodType: PeriodType,
  periodStart: Date,
  lang: Lang,
  articles: ArticleRow[],
  profileName: string,
  profileConfig: ProfileConfig,
  mode: Mode = "concise"
): Promise<void> {
  // Check if summary already exists for this lang+mode
  const existing = await pool.query(
    `SELECT id FROM summaries WHERE profile_id = $1 AND period_type = $2 AND period_start = $3 AND lang = $4 AND mode = $5`,
    [profileId, periodType, periodStart, lang, mode]
  );

  if (existing.rows.length > 0) {
    console.log(`[AI] Summary (${lang}/${mode}) already exists for profile ${profileId}, skipping.`);
    return;
  }

  const prompt = buildPrompt(profileName, profileConfig, periodType, periodStart, articles, lang, mode);
  const model = "claude-haiku-4-5";

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: mode === "detailed" || periodType === "monthly" ? 4096 : 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type");

    await pool.query(
      `INSERT INTO summaries (profile_id, period_type, period_start, content_md, lang, mode)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [profileId, periodType, periodStart, content.text, lang, mode]
    );

    console.log(`[AI] Summary (${lang}/${mode}) stored (${content.text.length} chars).`);
  } catch (err) {
    console.error(`[AI] Failed to generate summary (${lang}/${mode}): ${String(err)}`);
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
  const profile = profileResult.rows[0] as { name: string; config: ProfileConfig };

  const articles = await getArticlesForPeriod(profileId, periodType, periodStart);
  console.log(`[AI] Found ${articles.length} relevant articles.`);

  // FR + EN × concis + détaillé (le "détaillé" est le même briefing réécrit
  // enrichi — feedback Axel 2026-07-03, PAS une liste d'articles bruts)
  await generateSummaryForLang(profileId, periodType, periodStart, "fr", articles, profile.name, profile.config, "concise");
  await generateSummaryForLang(profileId, periodType, periodStart, "en", articles, profile.name, profile.config, "concise");
  await generateSummaryForLang(profileId, periodType, periodStart, "fr", articles, profile.name, profile.config, "detailed");
  await generateSummaryForLang(profileId, periodType, periodStart, "en", articles, profile.name, profile.config, "detailed");
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
