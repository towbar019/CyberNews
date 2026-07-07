import { pool } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// PROFILES
//
// Chaque profil embarque ses instructions de traitement complètes (promptInstructions)
// consommées par ai-summary.ts. Le but : un modèle léger (Haiku) reçoit des
// instructions ultra-précises → pas de dérive d'alignement.
// Voir worker/RESEARCH.md pour la documentation complète du module de recherche.
//
// sourceScope :
//   - "include" : SEULES les sources listées (préfixe) alimentent ce profil
//   - "exclude" : toutes les sources SAUF celles listées
// ─────────────────────────────────────────────────────────────────────────────

const NEMEA_CONFIG = {
  description:
    "SOC/CERT operations — strict tracking of exploitable vulnerabilities, 0-days and CVEs on a defined application perimeter.",
  format: "Technical, concise, keywords + short sentences",
  monitoredApps: [
    "Proxmox", "Teleport", "Wazuh", "Elasticsearch", "Kibana",
    "Keycloak", "CISO Assistant", "Grafana", "Iris", "Mailcow",
    "OpenProject", "Portainer", "Shuffle SOAR", "Velociraptor",
    "Hermes", "Unifi", "Windows", "Linux", "Debian", "Arch Linux",
  ],
  keywords: [
    "CVE", "0day", "zero-day", "exploit", "vulnerability", "RCE",
    "SQLi", "XSS", "SSRF", "LFI", "RFI", "CISA", "KEV",
    "critical", "patch", "security update", "breach", "incident",
  ],
  highlightCisaKev: true,
  showCveChart: true,
  // Sources réservées à Nemea : releases GitHub des apps + flux CVE techniques
  sourceScope: {
    mode: "exclude" as const,
    sources: ["Google News —"], // la veille généraliste ne pollue pas Nemea
  },
  promptInstructions: `PÉRIMÈTRE STRICT : filtre l'actualité UNIQUEMENT pour les applications suivantes : Proxmox, Teleport, Wazuh, Elasticsearch, Kibana, Keycloak, CISO Assistant, Grafana, Iris, Mailcow, OpenProject, Portainer, Shuffle SOAR, Velociraptor, Hermes, Unifi, Windows, Linux (Debian / Arch Linux).

IGNORER LE BRUIT : toute vulnérabilité concernant une application hors de cette liste doit être ignorée (y compris les vulnérabilités majeures grand public, réservées à d'autres profils).

CRITÈRES D'ALERTE :
- Critique : présence au catalogue CISA KEV OU score CVSS ≥ 9.0
- Haute : score CVSS entre 7.0 et 8.9

FORMAT DE SORTIE : paragraphes courts et textuels. Conserve EXACTEMENT la structure Markdown suivante :

## 🚨 Alertes Critiques (CVSS ≥ 9.0 ou CISA KEV)
[Texte ou "Aucune vulnérabilité critique sur le périmètre pour cette période."]

## 🔴 Sévérité Haute (CVSS 7.0-8.9)
[Texte ou "Aucune vulnérabilité de sévérité haute sur le périmètre pour cette période."]

## 📊 Points Clés
[Observations sur l'écosystème surveillé]

## 🛡️ Actions Recommandées
[Liste d'actions correctives, ex : "Mettre à jour Teleport vers vX.X"]

## 📝 Résumé
[Synthèse en 3 lignes de l'état de la menace sur le périmètre]`,
};

const AXEL_CONFIG = {
  description:
    "Macro CISO/RSSI vision — executive synthesis of emerging risks, high-level cyber trends, and strategic watch on AI, SecOps and Cloud ecosystems.",
  format: "Executive, governance & risk oriented, two-part report",
  monitoredApps: [],
  keywords: [
    "risk", "threat", "CISO", "RSSI", "breach", "ransomware", "APT",
    "supply chain", "critical", "campaign", "espionage", "data leak",
    "nation-state", "regulation", "NIS2", "DORA", "GDPR", "cyber attack",
    "incident", "AI security", "LLM", "SIEM", "EDR", "SOAR", "SOC",
    "cloud", "sovereignty", "AWS", "Azure", "Splunk", "SentinelOne",
    "open weights", "open source model", "benchmark", "Claude", "GPT",
    "Gemini", "Mistral", "frontier model", "outperforms",
  ],
  highlightCisaKev: true,
  showCveChart: false,
  // Axel = macro : on exclut le bruit technique par-app (GitHub releases, Exploit-DB)
  sourceScope: {
    mode: "exclude" as const,
    sources: ["GitHub —", "Exploit-DB", "NVD CVEs"],
  },
  promptInstructions: `PÉRIMÈTRE MACRO (PARTIE 1) : ne liste PAS les CVE individuelles (c'est le rôle du profil Nemea). Concentre-toi sur : campagnes de ransomwares majeures, fuites de données critiques, nouvelles réglementations (NIS2, DORA et autres normes internationales), changements de tactiques des acteurs de la menace (APT).

VEILLE TECHNOLOGIQUE (PARTIE 2) : isole les nouveautés, évolutions et risques spécifiques à trois domaines, indépendamment de la partie 1 :
- Intelligence Artificielle — PRIORITÉ HAUTE sur les avancées des modèles :
  * Tout nouveau modèle ou version qui prétend dépasser/rivaliser avec l'état de l'art (ex : un modèle qui bat Claude Opus, GPT, Gemini...) doit être remonté, avec le benchmark/la source de la claim.
  * Pour CHAQUE modèle cité, précise SYSTÉMATIQUEMENT la souveraineté : quelle entreprise/pays le développe, où il est hébergé/géré, et s'il est open source / open weights / téléchargeable localement (et sous quelle licence) ou API propriétaire uniquement.
  * Surveille aussi les projets communautaires GitHub marquants qui répliquent/clonent des outils IA propriétaires (ex : réimplémentations open source de Claude Code, agents, etc.) — nom du repo, ce qu'il fait, sa traction.
  * Ensuite : nouvelles features des outils IA (Hermes, Claude...), avancées LLM, risques/sécurité liés à l'IA.
- SecOps (SOC, SIEM, EDR, NSM/IDS, SOAR) : nouveautés éditeurs (Splunk, SentinelOne, ELK, etc.), features d'automatisation, limites technologiques (ex : un APT qui bypass un EDR)
- Cloud & Souveraineté : évolutions AWS/Azure, lois sur la souveraineté des données, features Cloud majeures

SÉLECTION STRICTE : pour les menaces, isole uniquement le Top (1 à 5 maximum) des événements les plus importants de la période. Pour un rendu monthly, le top peut être plus grand (libre).

TON ET STYLE : langage orienté "Gouvernance et Risque", termes techniques autorisés.

LIBERTÉ DE RÉDACTION : si un sujet nécessite plus de contexte, tu peux ajouter des paragraphes supplémentaires sous les sections concernées.

FORMAT DE SORTIE : structure Markdown STRICTE en deux parties :

# PARTIE 1 : ÉTAT DE LA MENACE & GOUVERNANCE

## 🌐 Le Climat Cyber (Synthèse Narrative)
[Un ou plusieurs paragraphes résumant la tendance générale de la période. CONCRET obligatoirement : chaque phrase doit citer des acteurs, entreprises, chiffres ou événements NOMMÉS tirés des articles. Pas de généralités abstraites ("convergence des vecteurs", "paysage en évolution") — feedback Axel 2026-07-03.]

## 🔥 Top [X] des Menaces Stratégiques
[X entre 1 et 5 maximum. Format : **1. [Nom de la menace]** : explication de l'impact business, technique et stratégique]

## 💡 Priorité Gouvernance
[Une action stratégique recommandée pour le RSSI]

## 📝 Éclairage Complémentaire (Optionnel)
[Paragraphes libres si une menace, une loi ou une situation complexe nécessite une explication approfondie]

# PARTIE 2 : VEILLE ÉCOSYSTÈME & TECHNOLOGIES

## 🤖 Intelligence Artificielle (Évolutions & Sécurité)
[D'abord les avancées de modèles : nouveaux modèles/versions et claims vs état de l'art (avec source), en précisant pour chacun : développeur + pays, hébergement/gestion, open source-open weights-téléchargeable ou API propriétaire, licence. Puis projets communautaires GitHub notables (clones/réimplémentations d'outils IA). Puis features et risques sécurité IA de la période.]

## 🛡️ SecOps & Cyberdéfense (SOC, SIEM, EDR, SOAR)
[Actualités des acteurs clés, capacités d'automatisation, contournements/bypass]

## ☁️ Cloud & Souveraineté
[Actualités AWS/Azure, lois de souveraineté, évolutions architectures cloud]

(Si aucune information pertinente pour une sous-section de la Partie 2, écris simplement "Pas d'évolution majeure signalée sur cette période.")`,
};

export async function seedProfiles(): Promise<void> {
  // Upsert : les instructions évoluent → on met à jour la config des profils existants
  for (const [name, config] of [
    ["Nemea", NEMEA_CONFIG],
    ["Axel", AXEL_CONFIG],
  ] as const) {
    await pool.query(
      `INSERT INTO profiles (name, config) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET config = EXCLUDED.config`,
      [name, JSON.stringify(config)]
    );
  }
  console.log("Seeded/updated profiles (Nemea, Axel).");
}

export async function seedRssSources(): Promise<void> {
  const sources = [
    // ── Médias cyber internationaux ──────────────────────────────────────
    { name: "Krebs on Security",      url: "https://krebsonsecurity.com/feed/" },
    { name: "The Hacker News",        url: "https://feeds.feedburner.com/TheHackersNews" },
    { name: "BleepingComputer",       url: "https://www.bleepingcomputer.com/feed/" },
    { name: "SecurityWeek",           url: "https://feeds.feedburner.com/securityweek" },
    { name: "CyberScoop",             url: "https://cyberscoop.com/feed/" },
    { name: "The Record (Recorded Future)", url: "https://therecord.media/feed/" },
    { name: "Mandiant / Google Security",   url: "https://cloud.google.com/blog/products/identity-security/rss" },
    { name: "Google Security Blog",   url: "https://security.googleblog.com/feeds/posts/default" },
    { name: "Zero Day Initiative",    url: "https://www.zerodayinitiative.com/blog?format=rss" },
    { name: "Exploit-DB",             url: "https://www.exploit-db.com/rss.xml" },
    { name: "TLDR Security",          url: "https://tldr.tech/rss/cybersecurity" },
    { name: "Dark Reading",           url: "https://www.darkreading.com/rss.xml" },

    // ── Médias cyber francophones ─────────────────────────────────────────
    { name: "CERT-FR",                url: "https://www.cert.ssi.gouv.fr/feed/" },
    { name: "ANSSI Alertes",          url: "https://www.cert.ssi.gouv.fr/alerte/feed/" },
    { name: "ANSSI Avis",             url: "https://www.cert.ssi.gouv.fr/avis/feed/" },
    { name: "Zataz",                  url: "https://www.zataz.com/feed/" },
    { name: "Next.ink",               url: "https://next.ink/feed/" },

    // ── CISA Alerts (en plus du KEV JSON) ────────────────────────────────
    { name: "CISA Advisories",        url: "https://www.cisa.gov/cybersecurity-advisories/all.xml" },

    // ── Veille généraliste (équivalent Google Alerts, sans compte) ───────
    // Google News RSS par mots-clés — infos générales acteurs/entreprises,
    // événements CERT globaux. Destiné au profil Axel (exclu de Nemea).
    { name: "Google News — Cybersécurité",   url: "https://news.google.com/rss/search?q=cybers%C3%A9curit%C3%A9&hl=fr&gl=FR&ceid=FR:fr" },
    { name: "Google News — Cyberattack",     url: "https://news.google.com/rss/search?q=cyberattack%20OR%20%22data%20breach%22&hl=en-US&gl=US&ceid=US:en" },
    { name: "Google News — CERT Advisory",   url: "https://news.google.com/rss/search?q=CERT%20advisory%20OR%20ANSSI%20OR%20ENISA&hl=en-US&gl=US&ceid=US:en" },
    { name: "Google News — AI Security",     url: "https://news.google.com/rss/search?q=%22AI%20security%22%20OR%20%22LLM%20vulnerability%22&hl=en-US&gl=US&ceid=US:en" },
    { name: "Google News — AI Models",       url: "https://news.google.com/rss/search?q=%22new%20AI%20model%22%20OR%20%22open%20weights%22%20OR%20%22outperforms%20GPT%22%20OR%20%22beats%20Claude%22%20OR%20%22open%20source%20LLM%22&hl=en-US&gl=US&ceid=US:en" },
    { name: "Google News — Ransomware",      url: "https://news.google.com/rss/search?q=ransomware%20campaign&hl=en-US&gl=US&ceid=US:en" },

    // ── GitHub Releases — apps surveillées Nemea ──────────────────────────
    { name: "GitHub — Proxmox",       url: "https://github.com/proxmox/pve-manager/releases.atom" },
    { name: "GitHub — Teleport",      url: "https://github.com/gravitational/teleport/releases.atom" },
    { name: "GitHub — Wazuh",         url: "https://github.com/wazuh/wazuh/releases.atom" },
    { name: "GitHub — Keycloak",      url: "https://github.com/keycloak/keycloak/releases.atom" },
    { name: "GitHub — Grafana",       url: "https://github.com/grafana/grafana/releases.atom" },
    { name: "GitHub — Portainer",     url: "https://github.com/portainer/portainer/releases.atom" },
    { name: "GitHub — Shuffle SOAR",  url: "https://github.com/Shuffle/Shuffle/releases.atom" },
    { name: "GitHub — Velociraptor",  url: "https://github.com/Velocidex/velociraptor/releases.atom" },
    { name: "GitHub — Iris",          url: "https://github.com/dfir-iris/iris-web/releases.atom" },
    { name: "GitHub — Mailcow",       url: "https://github.com/mailcow/mailcow-dockerized/releases.atom" },
    { name: "GitHub — OpenProject",   url: "https://github.com/opf/openproject/releases.atom" },
    { name: "GitHub — Elasticsearch", url: "https://github.com/elastic/elasticsearch/releases.atom" },
  ];

  for (const source of sources) {
    await pool.query(
      `INSERT INTO rss_sources (name, url) VALUES ($1, $2) ON CONFLICT (url) DO NOTHING`,
      [source.name, source.url]
    );
  }

  // Désactive l'ancienne URL Dark Reading (403 permanent sur /rss/all.xml)
  await pool.query(
    `UPDATE rss_sources SET is_active = false WHERE url = 'https://www.darkreading.com/rss/all.xml'`
  );

  console.log(`Seeded ${sources.length} RSS sources.`);
}
