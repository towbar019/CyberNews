import PgBoss, { Job } from "pg-boss";
import { fetchAllFeeds } from "../services/rss-fetcher";
import { generateAllSummaries } from "../services/ai-summary";

let boss: PgBoss | null = null;

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function startScheduler(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  boss = new PgBoss(DATABASE_URL);

  boss.on("error", (err) => console.error("[pg-boss] error:", err));

  await boss.start();
  console.log("[scheduler] pg-boss started");

  // === Create queues first ===
  await boss.createQueue("fetch-rss-feeds");
  await boss.createQueue("generate-daily-summary");
  await boss.createQueue("generate-weekly-summary");
  await boss.createQueue("generate-monthly-summary");

  // === Job handlers ===

  // RSS fetch job
  await boss.work("fetch-rss-feeds", async () => {
    console.log("[job] fetch-rss-feeds starting...");
    await fetchAllFeeds();
  });

  type SummaryJobData = { periodStart?: string };

  // Daily summary job
  await boss.work<SummaryJobData>(
    "generate-daily-summary",
    async (jobs: Job<SummaryJobData>[]) => {
      for (const job of jobs) {
        const periodStart = job.data.periodStart
          ? new Date(job.data.periodStart)
          : getStartOfDay(new Date());
        console.log(`[job] generate-daily-summary for ${periodStart.toISOString()}`);
        await generateAllSummaries("daily", periodStart);
      }
    }
  );

  // Weekly summary job
  await boss.work<SummaryJobData>(
    "generate-weekly-summary",
    async (jobs: Job<SummaryJobData>[]) => {
      for (const job of jobs) {
        const periodStart = job.data.periodStart
          ? new Date(job.data.periodStart)
          : getStartOfWeek(new Date());
        console.log(`[job] generate-weekly-summary for ${periodStart.toISOString()}`);
        await generateAllSummaries("weekly", periodStart);
      }
    }
  );

  // Monthly summary job
  await boss.work<SummaryJobData>(
    "generate-monthly-summary",
    async (jobs: Job<SummaryJobData>[]) => {
      for (const job of jobs) {
        const periodStart = job.data.periodStart
          ? new Date(job.data.periodStart)
          : getStartOfMonth(new Date());
        console.log(`[job] generate-monthly-summary for ${periodStart.toISOString()}`);
        await generateAllSummaries("monthly", periodStart);
      }
    }
  );

  // === Schedules (cron) ===

  // Every 2 hours: fetch RSS feeds
  await boss.schedule("fetch-rss-feeds", "0 */2 * * *", {}, {
    tz: "UTC",
  });

  // 06:00 daily: daily summary
  await boss.schedule("generate-daily-summary", "0 6 * * *", {}, {
    tz: "UTC",
  });

  // Monday 07:00: weekly summary
  await boss.schedule("generate-weekly-summary", "0 7 * * 1", {}, {
    tz: "UTC",
  });

  // 1st of month 07:00: monthly summary
  await boss.schedule("generate-monthly-summary", "0 7 1 * *", {}, {
    tz: "UTC",
  });

  // NOTE: Big news scan (every 2-3h) is DISABLED by default
  // To enable: boss.schedule('scan-big-news', '0 */3 * * *', {}, { tz: 'UTC' });

  console.log("[scheduler] All cron schedules registered.");

  // Trigger initial RSS fetch immediately
  await boss.send("fetch-rss-feeds", {});
  console.log("[scheduler] Triggered initial RSS feed fetch.");
}

export async function stopScheduler(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}
