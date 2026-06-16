export type Lang = "fr" | "en";

export const translations = {
  nav: {
    home:     { fr: "Home",       en: "Home" },
    news:     { fr: "SecurityNews", en: "SecurityNews" },
    profiles: { fr: "Profils",    en: "Profiles" },
    reporting:{ fr: "Reporting",  en: "Reporting" },
  },
  home: {
    hero_title:   { fr: "SecurityNews",   en: "SecurityNews" },
    hero_sub:     { fr: "Veille cybersécurité personnalisée par profils.\nRésumés AI — Daily, Weekly, Monthly — CVE, 0day, CISA KEV.",
                    en: "Personalized cybersecurity monitoring by profiles.\nAI summaries — Daily, Weekly, Monthly — CVE, 0day, CISA KEV." },
    cta_news:     { fr: "Accéder aux news →",  en: "View news →" },
    cta_profiles: { fr: "Voir les profils",    en: "See profiles" },
    recent:       { fr: "Dernières actualités", en: "Latest news" },
    see_all:      { fr: "Tout voir →",         en: "See all →" },
    loading:      { fr: "Premier fetch RSS en cours…", en: "First RSS fetch in progress…" },
    db_error:     { fr: "Base de données non disponible.", en: "Database unavailable." },
    features:     { fr: "Features",            en: "Features" },
  },
  profiles: {
    title:    { fr: "Profils de veille",          en: "Monitoring profiles" },
    sub:      { fr: "Choisissez un profil pour accéder aux résumés AI personnalisés.", en: "Choose a profile to access personalized AI summaries." },
    view:     { fr: "Voir les news →",            en: "View news →" },
    db_error: { fr: "Base de données non disponible.", en: "Database unavailable." },
    loading:  { fr: "Chargement des profils…",   en: "Loading profiles…" },
  },
  news: {
    breadcrumb: { fr: "SecurityNews", en: "SecurityNews" },
    articles:   { fr: "articles",     en: "articles" },
    alert_label:{ fr: "alerte",       en: "alert" },
    alerts_label:{ fr: "alertes",    en: "alerts" },
    critical:   { fr: "critique",     en: "critical" },
    criticals:  { fr: "critiques",    en: "criticals" },
    daily:      { fr: "Daily",        en: "Daily" },
    weekly:     { fr: "Weekly",       en: "Weekly" },
    monthly:    { fr: "Monthly",      en: "Monthly" },
    summary_today: { fr: "Aujourd'hui", en: "Today" },
    summary_week:  { fr: "Cette semaine", en: "This week" },
    summary_month: { fr: "Ce mois",   en: "This month" },
    generated:  { fr: "Généré le",    en: "Generated on" },
    no_summary: { fr: "Pas encore de résumé", en: "No summary yet" },
    next_daily: { fr: "Prochain : aujourd'hui à 06h00 UTC", en: "Next: today at 06:00 UTC" },
    next_weekly:{ fr: "Prochain : lundi 07h00 UTC", en: "Next: Monday 07:00 UTC" },
    next_monthly:{ fr: "Prochain : 1er du mois 07h00 UTC", en: "Next: 1st of month 07:00 UTC" },
    timeline:   { fr: "Timeline des articles", en: "Articles timeline" },
    cve_chart:  { fr: "CVE par app (6 mois)",  en: "CVE by app (6 months)" },
    monitored:  { fr: "Apps surveillées",       en: "Monitored apps" },
  },
  reporting: {
    title:      { fr: "Reporting",    en: "Reporting" },
    sub:        { fr: "Métriques opérationnelles — feeds, volumes, sources", en: "Operational metrics — feeds, volumes, sources" },
    total_art:  { fr: "Articles totaux",  en: "Total articles" },
    ai_summaries:{ fr: "Résumés AI",     en: "AI summaries" },
    active_src: { fr: "Sources actives", en: "Active sources" },
    art_30d:    { fr: "Articles (30j)",  en: "Articles (30d)" },
    volume_title:{ fr: "Volume articles — 30 derniers jours", en: "Article volume — last 30 days" },
    sources_title:{ fr: "Flux RSS — Sources", en: "RSS Feeds — Sources" },
    source:     { fr: "Source",           en: "Source" },
    articles:   { fr: "Articles",         en: "Articles" },
    last_fetch: { fr: "Dernier fetch",    en: "Last fetch" },
    never:      { fr: "Jamais",           en: "Never" },
    ago_min:    { fr: "Il y a",           en: "" },
    ago_h:      { fr: "h",               en: "h ago" },
    ago_d:      { fr: "j",               en: "d ago" },
  },
  features: [
    { icon: "🔔", labelFr: "Big Alert",      labelEn: "Big Alert",      descFr: "Notification immédiate CVSS ≥ 9.8 ou CISA KEV",          descEn: "Immediate alert CVSS ≥ 9.8 or CISA KEV" },
    { icon: "🤖", labelFr: "AI Summaries",   labelEn: "AI Summaries",   descFr: "Résumés Claude AI — daily, weekly, monthly",             descEn: "Claude AI summaries — daily, weekly, monthly" },
    { icon: "📊", labelFr: "CVE Chart",      labelEn: "CVE Chart",      descFr: "Histogramme CVE par app sur 6 mois glissants",           descEn: "CVE histogram by app over rolling 6 months" },
    { icon: "⏱️", labelFr: "Timeline",       labelEn: "Timeline",       descFr: "Articles filtrés par date, source, criticité",           descEn: "Articles filtered by date, source, severity" },
    { icon: "👁️", labelFr: "Vu / Non vu",   labelEn: "Read / Unread",  descFr: "Marquage local persisté sans compte",                   descEn: "Local read tracking, no account needed" },
    { icon: "📄", labelFr: "Export PDF",     labelEn: "PDF Export",     descFr: "Briefing complet exportable en PDF",                    descEn: "Full briefing exportable as PDF" },
  ],
} as const;

export function t<K extends keyof typeof translations>(
  section: K,
  key: keyof (typeof translations)[K],
  lang: Lang
): string {
  const entry = (translations[section] as any)[key];
  if (!entry) return String(key);
  return entry[lang] ?? entry["fr"] ?? String(key);
}

export function getLang(url: URL): Lang {
  const param = url.searchParams.get("lang");
  return param === "en" ? "en" : "fr";
}
