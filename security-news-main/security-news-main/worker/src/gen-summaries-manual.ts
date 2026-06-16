/**
 * Manual summary generation script — run with: npx ts-node gen-summaries-manual.ts
 * Generates daily (today), weekly (last Monday), monthly (last month) for all profiles
 * Forces regeneration by deleting existing summaries for those periods.
 */

import { pool } from "./db/client";
import { generateAllSummaries } from "./services/ai-summary";

async function main() {
  const now = new Date();

  // Daily = today (June 8 2026)
  const dailyStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Weekly = last Monday (June 2 2026, simulating "this morning Monday")
  const dayOfWeek = dailyStart.getUTCDay(); // 0=Sun, 1=Mon...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weeklyStart = new Date(dailyStart);
  weeklyStart.setUTCDate(dailyStart.getUTCDate() - daysToMonday);

  // Monthly = last month (May 2026)
  const monthlyStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  console.log(`[manual] Daily  : ${dailyStart.toISOString()}`);
  console.log(`[manual] Weekly : ${weeklyStart.toISOString()}`);
  console.log(`[manual] Monthly: ${monthlyStart.toISOString()}`);

  // Force re-gen: delete existing for these exact periods
  await pool.query(
    `DELETE FROM summaries WHERE (period_type = 'daily' AND period_start = $1)
       OR (period_type = 'weekly' AND period_start = $2)
       OR (period_type = 'monthly' AND period_start = $3)`,
    [dailyStart, weeklyStart, monthlyStart]
  );
  console.log("[manual] Cleared old summaries for these periods.");

  console.log("\n=== Generating DAILY summary ===");
  await generateAllSummaries("daily", dailyStart);

  console.log("\n=== Generating WEEKLY summary ===");
  await generateAllSummaries("weekly", weeklyStart);

  console.log("\n=== Generating MONTHLY summary ===");
  await generateAllSummaries("monthly", monthlyStart);

  console.log("\n✅ All summaries generated.");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
