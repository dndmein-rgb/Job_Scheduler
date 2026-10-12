import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { reaperService } from "./services/reaper.service.js";

logger.info("Reaper starting", {
  pollIntervalMs: config.REAPER_POLL_INTERVAL_MS,
  leaseGraceMs: config.LEASE_GRACE_MS,
  env: config.NODE_ENV,
});

let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

async function tick() {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const result = await reaperService.tick();
    if (result.jobsRecovered > 0 || result.workersMarkedOffline > 0) {
      logger.info("Reaper tick", result);
    }
  } catch (err) {
    logger.error("Reaper tick failed", { err });
  } finally {
    tickInFlight = false;
  }
}

timer = setInterval(() => void tick(), config.REAPER_POLL_INTERVAL_MS);
// Run once immediately so we don't wait a full interval after boot.
void tick();

async function shutdown(signal: string) {
  logger.info("Shutting down reaper…", { signal });
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));