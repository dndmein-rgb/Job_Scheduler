import { generateId } from "@job-platform/shared-utils";
import { JOB_EVENT_TYPES } from "@job-platform/shared-events";
import { TOPICS } from "@job-platform/shared-kafka";
import { prisma } from "../infrastructure/prisma.js";
import { enqueueJob } from "../infrastructure/bullmq.js";
import { logger } from "../config/logger.js";

/**
 * Promote due SCHEDULED jobs → QUEUED + enqueue.
 *
 * Why optimistic update?
 * Multiple scheduler instances (or a concurrent cancel) must not double-promote.
 * We only enqueue when the DB transition actually succeeded.
 */
export class SchedulerService {
  async tick(): Promise<number> {
    const now = new Date();

    const due = await prisma.job.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
      },
      take: 50,
      orderBy: { scheduledAt: "asc" },
    });

    if (due.length === 0) return 0;

    let promoted = 0;

    for (const job of due) {
      try {
        const eventId = generateId();

        const didPromote = await prisma.$transaction(async (tx) => {
          const updated = await tx.job.updateMany({
            where: {
              id: job.id,
              status: "SCHEDULED",
            },
            data: {
              status: "QUEUED",
            },
          });

          if (updated.count === 0) {
            // Lost the race (cancelled, or another scheduler instance).
            return false;
          }

          await tx.outbox.create({
            data: {
              id: generateId(),
              eventId,
              eventType: JOB_EVENT_TYPES.QUEUED,
              topic: TOPICS.JOB_EVENTS,
              payload: {
                eventId,
                eventType: JOB_EVENT_TYPES.QUEUED,
                occurredAt: new Date().toISOString(),
                jobId: job.id,
                jobType: job.type,
                tenantId: job.tenantId,
                payload: {
                  status: "QUEUED",
                  priority: job.priority,
                  scheduledAt: job.scheduledAt?.toISOString() ?? null,
                },
              },
            },
          });

          return true;
        });

        if (!didPromote) {
          continue;
        }

        try {
          await enqueueJob(job.id);
        } catch (err) {
          logger.error(
            "Scheduler: DB promoted but enqueue failed (job is QUEUED)",
            { jobId: job.id, err },
          );
        }

        promoted += 1;
        logger.info("Scheduled job promoted to QUEUED", {
          jobId: job.id,
          scheduledAt: job.scheduledAt?.toISOString(),
        });
      } catch (err) {
        logger.error("Scheduler failed to promote job", { jobId: job.id, err });
      }
    }

    return promoted;
  }
}

export const schedulerService = new SchedulerService();