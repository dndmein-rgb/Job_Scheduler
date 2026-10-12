import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { schedulerService } from "./services/scheduler.service.js";

logger.info("Scheduler starting", {
  pollIntervalMs: config.SCHEDULER_POLL_INTERVAL_MS,
  env: config.NODE_ENV,
});

let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

async function tick() {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const promoted = await schedulerService.tick();
    if (promoted > 0) {
      logger.info("Scheduler tick promoted jobs", { promoted });
    }
  } catch (err) {
    logger.error("Scheduler tick failed", { err });
  } finally {
    tickInFlight = false;
  }
}

timer = setInterval(() => void tick(), config.SCHEDULER_POLL_INTERVAL_MS);
// Run once immediately so we don't wait a full interval after boot.
void tick();

async function shutdown(signal: string) {
  logger.info("Shutting down scheduler…", { signal });
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));