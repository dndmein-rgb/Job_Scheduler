/**
 * Renews leaseExpiresAt while a job is still being processed.
 * Why? If the worker dies, the reaper can reclaim after leaseExpiresAt.
 * We renew at ~1/3 of LEASE_MS so a few missed ticks still leave a valid lease.
 */

import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { prisma } from "../infrastructure/prisma.js";

export function startLeaseHeartbeat(jobId: string): () => void {
  const intervalMs = Math.max(1_000, Math.floor(config.LEASE_MS / 3));
  const timer = setInterval(async () => {
    try {
      const nextExpiry = new Date(Date.now() + config.LEASE_MS);
      const result = await prisma.job.updateMany({
        where: { id: jobId, status: "RUNNING", leaseOwner: config.WORKER_ID },
        data: {
          leaseExpiresAt: nextExpiry,
        },
      });
      if (result.count === 0) {
        // Job was completed/failed/reaped — stop renewing.
        logger.debug("Lease heartbeat: job no longer owned, stopping", {
          jobId,
        });
        clearInterval(timer);
        return;
      }

      logger.debug("Lease renewed", {
        jobId,
        leaseExpiresAt: nextExpiry.toISOString(),
      });
    } catch (err) {
      logger.warn("Lease heartbeat failed", { jobId, err });
      // Don't clear the timer — transient DB blips shouldn't stop renewal.
    }
  }, intervalMs);
  // Return stop function so the caller can clean up when the job finishes.
  return () => clearInterval(timer);
}
