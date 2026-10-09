import { config } from "./config/index.js";
import { logger } from "./config/logger.js";

logger.info(
  {
    pollIntervalMs: config.REAPER_POLL_INTERVAL_MS,
    leaseGraceMs: config.LEASE_GRACE_MS,
    env: config.NODE_ENV,
  },
  "Reaper starting (Phase 0 – skeleton)",
);

logger.info("Reaper idle. Implement lease recovery in Phase 3.");

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down reaper…");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));