import { config } from "./config/index.js";
import { logger } from "./config/logger.js";

logger.info(
  { pollIntervalMs: config.SCHEDULER_POLL_INTERVAL_MS, env: config.NODE_ENV },
  "Scheduler starting (Phase 0 – skeleton)",
);

logger.info("Scheduler idle. Implement polling loop in Phase 4.");

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down scheduler…");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));