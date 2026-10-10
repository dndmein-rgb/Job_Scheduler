import { generateId } from "@job-platform/shared-utils";
import { JOB_EVENT_TYPES } from "@job-platform/shared-events";
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
  async tick(): Promise<number> {
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
}

export const reaperService = new ReaperService();
