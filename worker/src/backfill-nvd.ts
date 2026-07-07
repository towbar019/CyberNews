/**
 * Backfill NVD — importe les CVE historiques (2024 → aujourd'hui) pour les
 * apps du périmètre Nemea, via NVD API v2 keywordSearch.
 * Usage : node dist/backfill-nvd.js   (dans le container worker)
 * Idempotent : ON CONFLICT (url) DO UPDATE.
 *
 * Notes API NVD v2 :
 *  - plage pubStartDate/pubEndDate limitée à 120 jours par requête → fenêtrage
 *  - avec NVD_API_KEY : 50 req/30s ; sans : 5 req/30s → pause entre requêtes
 */
import axios from "axios";
import { pool } from "./db/client";

const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0";

// Apps ciblées (mots-clés NVD précis — on écarte les termes trop génériques
// comme "Windows"/"Linux"/"Iris" qui noieraient la DB ; déjà couverts par les feeds)
const APPS = [
  "Proxmox", "Teleport", "Wazuh", "Elasticsearch", "Kibana",
  "Keycloak", "Grafana", "Mailcow", "OpenProject", "Portainer",
  "Velociraptor", "Ubiquiti", "UniFi", "Shuffle SOAR",
];

const START = new Date(Date.UTC(2024, 0, 1));
const WINDOW_DAYS = 118;

const fmt = (d: Date) => d.toISOString().slice(0, 19) + "+00:00";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWindow(keyword: string, start: Date, end: Date): Promise<any[]> {
  const headers: Record<string, string> = { "User-Agent": UA };
  if (process.env.NVD_API_KEY) headers["apiKey"] = process.env.NVD_API_KEY;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const resp = await axios.get("https://services.nvd.nist.gov/rest/json/cves/2.0", {
        params: {
          keywordSearch: keyword,
          pubStartDate: fmt(start),
          pubEndDate: fmt(end),
          resultsPerPage: 2000,
        },
        timeout: 60000,
        headers,
      });
      return resp.data?.vulnerabilities ?? [];
    } catch (err) {
      if (attempt === 4) {
        console.error(`  [error] ${keyword} ${fmt(start).slice(0, 10)}: ${String(err).slice(0, 100)}`);
        return [];
      }
      await sleep(6000 * attempt);
    }
  }
  return [];
}

async function main(): Promise<void> {
  let totalStored = 0;

  for (const app of APPS) {
    console.log(`\n=== ${app} ===`);
    let cursor = new Date(START);
    const now = new Date();

    while (cursor < now) {
      const windowEnd = new Date(Math.min(cursor.getTime() + WINDOW_DAYS * 86400000, now.getTime()));
      const vulns = await fetchWindow(app, cursor, windowEnd);

      for (const v of vulns) {
        const cve = v.cve;
        if (!cve?.id) continue;
        const desc =
          cve.descriptions?.find((d: any) => d.lang === "en")?.value ||
          cve.descriptions?.[0]?.value || "No description";
        const cvss =
          cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ??
          cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore ??
          cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore ?? null;

        try {
          await pool.query(
            `INSERT INTO articles (source, title, url, published_at, content, cvss_score, is_cisa_kev)
             VALUES ($1, $2, $3, $4, $5, $6, false)
             ON CONFLICT (url) DO UPDATE SET cvss_score = EXCLUDED.cvss_score`,
            [
              "NVD CVEs",
              `${cve.id}: ${desc.slice(0, 160)}`,
              `https://nvd.nist.gov/vuln/detail/${cve.id}`,
              new Date(cve.published),
              desc,
              cvss,
            ]
          );
          totalStored++;
        } catch (e) {
          console.error(`  [store error] ${cve.id}: ${String(e).slice(0, 80)}`);
        }
      }

      console.log(`  ${fmt(cursor).slice(0, 10)} → ${fmt(windowEnd).slice(0, 10)} : ${vulns.length} CVE`);
      cursor = windowEnd;
      await sleep(process.env.NVD_API_KEY ? 1200 : 7000);
    }
  }

  console.log(`\n✅ Backfill terminé — ${totalStored} CVE insérées/mises à jour.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
