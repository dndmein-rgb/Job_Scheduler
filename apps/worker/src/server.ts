import { config } from "./config/index.js";
import { logger } from "./config/logger.js";

logger.info(
  {
    workerId: config.WORKER_ID,
    capabilities: config.WORKER_CAPABILITIES,
    env: config.NODE_ENV,
  },
  "Worker starting (Phase 0 – skeleton, no processors yet)",
);

logger.info("Worker idle. Implement processors in Phase 2.");

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down worker…");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));