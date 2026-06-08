import { pool } from "./client";

export async function seedProfiles(): Promise<void> {
  // ── Profil Nemea ──────────────────────────────────────────────────────────
  const nemeaExists = await pool.query("SELECT id FROM profiles WHERE name = 'Nemea'");
  if (nemeaExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO profiles (name, config) VALUES ('Nemea', $1) ON CONFLICT (name) DO NOTHING`,
      [JSON.stringify({
        description: "CVE, 0day, vulnérabilités exploitables — focus applications surveillées",
        format: "Technique, concis, keywords + courtes phrases",
        monitoredApps: [
          "Proxmox", "Teleport", "Wazuh", "Elasticsearch", "Kibana",
          "Keycloak", "CISO Assistant", "Grafana", "Iris", "Mailcow",
          "OpenProject", "Portainer", "Shuffle SOAR", "Velociraptor",
          "Hermes", "Unifi", "Windows", "Linux", "Debian", "Arch Linux"
        ],
        keywords: [
          "CVE", "0day", "zero-day", "exploit", "vulnerability", "RCE",
          "SQLi", "XSS", "SSRF", "LFI", "RFI", "CISA", "KEV",
          "critical", "patch", "security update", "breach", "incident"
        ],
        highlightCisaKev: true,
        showCveChart: true,
      })]
    );
    console.log("Seeded Nemea profile.");
  }

  // ── Profil Axel ───────────────────────────────────────────────────────────
  const axelExists = await pool.query("SELECT id FROM profiles WHERE name = 'Axel'");
  if (axelExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO profiles (name, config) VALUES ('Axel', $1) ON CONFLICT (name) DO NOTHING`,
      [JSON.stringify({
        description: "Vision macro — risques émergents, tendances CISO/RSSI, CVE critiques grand public",
        format: "Synthétique, haut niveau, orienté décision",
        monitoredApps: [],
        keywords: [
          "risk", "threat", "CISO", "RSSI", "breach", "ransomware", "APT",
          "supply chain", "critical", "CVE", "vulnerability", "campaign",
          "espionage", "data leak", "zero-day", "nation-state", "regulation",
          "NIS2", "DORA", "GDPR", "cyber attack", "incident"
        ],
        highlightCisaKev: true,
        showCveChart: false,
      })]
    );
    console.log("Seeded Axel profile.");
  }
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
    { name: "Zero Day Initiative",    url: "https://www.zerodayinitiative.com/blog?format=rss" },
    { name: "Exploit-DB",             url: "https://www.exploit-db.com/rss.xml" },
    { name: "TLDR Security",          url: "https://tldr.tech/rss/cybersecurity" },

    // ── Médias cyber francophones ─────────────────────────────────────────
    { name: "CERT-FR",                url: "https://www.cert.ssi.gouv.fr/feed/" },
    { name: "ANSSI Alertes",          url: "https://www.cert.ssi.gouv.fr/alerte/feed/" },
    { name: "ANSSI Avis",             url: "https://www.cert.ssi.gouv.fr/avis/feed/" },
    { name: "Zataz",                  url: "https://www.zataz.com/feed/" },
    { name: "Next.ink",               url: "https://next.ink/feed/" },

    // ── CISA Alerts (en plus du KEV JSON) ────────────────────────────────
    { name: "CISA Advisories",        url: "https://www.cisa.gov/cybersecurity-advisories/all.xml" },

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
  console.log(`Seeded ${sources.length} RSS sources.`);
}
