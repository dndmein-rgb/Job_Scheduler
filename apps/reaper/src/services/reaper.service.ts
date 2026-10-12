import { generateId } from "@job-platform/shared-utils";
import { JOB_EVENT_TYPES, WORKER_EVENT_TYPES } from "@job-platform/shared-events";
import { TOPICS } from "@job-platform/shared-kafka";
import { prisma } from "../infrastructure/prisma.js";
import { enqueueJob } from "../infrastructure/bullmq.js";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

/**
 * Recover jobs whose lease has expired.
 *
 * Why a grace period?
 * A worker may be mid-renewal under DB/network pressure. We wait a little
 * past leaseExpiresAt so we don't steal a live job.
 *
 * Transition: RUNNING → QUEUED (allowed only for reaper path).
 * We clear the lease and re-enqueue so another worker can claim it.
 */
export class ReaperService {

  async tick(): Promise<{ jobsRecovered: number; workersMarkedOffline: number }> {
      const jobsRecovered = await this.reapExpiredLeases();
      const workersMarkedOffline = await this.markStaleWorkersOffline();
      return { jobsRecovered, workersMarkedOffline };
    }
  private async reapExpiredLeases(): Promise<number> {
    const cutoff = new Date(Date.now() - config.LEASE_GRACE_MS);

    const expired = await prisma.job.findMany({
      where: {
        status: "RUNNING",
        leaseExpiresAt: { lt: cutoff },
      },
      take: 50,
      orderBy: { leaseExpiresAt: "asc" },
    });

    if (expired.length === 0) return 0;

    let recovered = 0;

    for (const job of expired) {
      try {
        const eventId = generateId();
        const previousWorkerId = job.leaseOwner ?? "unknown";
        const leaseExpiredAt =
          job.leaseExpiresAt?.toISOString() ?? new Date().toISOString();
        // Returns true only when we actually won the race and wrote the outbox row.
        const didRecover = await prisma.$transaction(async (tx) => {
          // Optimistic: only recover if still RUNNING with the same expired lease.
          const updated = await tx.job.updateMany({
            where: {
              id: job.id,
              status: "RUNNING",
              leaseExpiresAt: { lt: cutoff },
            },
            data: {
              status: "QUEUED",
              leaseOwner: null,
              leaseExpiresAt: null,
            },
          });

          if (updated.count === 0) {
            // Lost the race (worker finished or another reaper instance).
            return false;
          }

          await tx.outbox.create({
            data: {
              id: generateId(),
              eventId,
              eventType: JOB_EVENT_TYPES.LEASE_EXPIRED,
              topic: TOPICS.JOB_EVENTS,
              payload: {
                eventId,
                eventType: JOB_EVENT_TYPES.LEASE_EXPIRED,
                occurredAt: new Date().toISOString(),
                jobId: job.id,
                jobType: job.type,
                tenantId: job.tenantId,
                payload: {
                  previousWorkerId,
                  leaseExpiredAt,
                },
              },
            },
          });
          return true;
        });
        if (!didRecover) {
          // Someone else finished/reaped it — do not enqueue or count.
          continue;
        }
        // Re-enqueue after the DB commit (same pattern as job-service create).
        try {
          await enqueueJob(job.id);
        } catch (err) {
          logger.error(
            "Reaper: DB recovered but enqueue failed (job is QUEUED)",
            {
              jobId: job.id,
              err,
            },
          );
        }

        recovered += 1;
        logger.warn("Lease expired – job requeued", {
          jobId: job.id,
          previousWorkerId,
          leaseExpiredAt,
        });
      } catch (err) {
        logger.error("Reaper failed to recover job", { jobId: job.id, err });
      }
    }

    return recovered;
  }
  /**
     * ONLINE workers whose heartbeat is older than WORKER_STALE_MS → OFFLINE.
     * Why? Crash / kill -9 never runs markOffline(); the table would lie forever.
     */
    private async markStaleWorkersOffline(): Promise<number> {
      const cutoff = new Date(Date.now() - config.WORKER_STALE_MS);
  
      const stale = await prisma.worker.findMany({
        where: {
          status: "ONLINE",
          lastHeartbeatAt: { lt: cutoff },
        },
        take: 50,
        orderBy: { lastHeartbeatAt: "asc" },
      });
  
      if (stale.length === 0) return 0;
  
      let marked = 0;
  
      for (const w of stale) {
        try {
          const eventId = generateId();
          const didMark = await prisma.$transaction(async (tx) => {
            const updated = await tx.worker.updateMany({
              where: {
                id: w.id,
                status: "ONLINE",
                lastHeartbeatAt: { lt: cutoff },
              },
              data: {
                status: "OFFLINE",
              },
            });
  
            if (updated.count === 0) return false;
  
            await tx.outbox.create({
              data: {
                id: generateId(),
                eventId,
                eventType: WORKER_EVENT_TYPES.OFFLINE,
                topic: TOPICS.WORKER_EVENTS,
                payload: {
                  eventId,
                  eventType: WORKER_EVENT_TYPES.OFFLINE,
                  occurredAt: new Date().toISOString(),
                  workerId: w.id,
                  payload: {
                    reason: "stale_heartbeat",
                    lastHeartbeatAt: w.lastHeartbeatAt.toISOString(),
                  },
                },
              },
            });
  
            return true;
          });
  
          if (didMark) {
            marked += 1;
            logger.warn("Worker marked offline (stale heartbeat)", {
              workerId: w.id,
              lastHeartbeatAt: w.lastHeartbeatAt.toISOString(),
            });
          }
        } catch (err) {
          logger.error("Failed to mark stale worker offline", {
            workerId: w.id,
            err,
          });
        }
      }
  
      return marked;
    }
}


export const reaperService = new ReaperService();
