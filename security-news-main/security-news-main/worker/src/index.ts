import { runMigrations, pool } from "./db/client";
import { seedProfiles, seedRssSources } from "./db/seeds";
import { startScheduler, stopScheduler } from "./jobs/scheduler";
import { closeRedis } from "./services/redis";

async function main(): Promise<void> {
  console.log("[main] SecurityNews Worker starting...");

  // Run migrations
  await runMigrations();

  // Seed initial data
  await seedProfiles();
  await seedRssSources();

  // Start pg-boss scheduler
  await startScheduler();

  console.log("[main] Worker running. Press Ctrl+C to stop.");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[main] Shutting down...");
    await stopScheduler();
    await closeRedis();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[main] Fatal error:", err);
  process.exit(1);
});
