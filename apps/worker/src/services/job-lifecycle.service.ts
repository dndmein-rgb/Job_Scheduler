import { calculateBackoffMs, generateId, NotFoundError, sleep } from "@job-platform/shared-utils";
import { JOB_EVENT_TYPES } from "@job-platform/shared-events";
import { TOPICS } from "@job-platform/shared-kafka";
import { JobStatus } from "@job-platform/shared-types";
import { Prisma, prisma } from "../infrastructure/prisma.js";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { assertTransition } from "./state-machine.js";
import { enqueueJob } from "../infrastructure/bullmq.js";

export class JobLifecycleService {
  async claim(jobId: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundError("Job", jobId);

    if (job.status !== "QUEUED" && job.status !== "RETRYING") {
      logger.warn("Skip job – not claimable", { jobId, status: job.status });
      throw new Error(`Job not claimable: ${job.status}`);
    }

    assertTransition(job.status as JobStatus, JobStatus.RUNNING);

    const attempts = job.attempts + 1;
    const leaseExpiresAt = new Date(Date.now() + config.LEASE_MS);
    const eventId = generateId();

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.job.update({
        where: { id: jobId },
        data: {
          status: "RUNNING",
          attempts,
          leaseOwner: config.WORKER_ID,
          leaseExpiresAt,
          startedAt: job.startedAt ?? new Date(),
        },
      });

      await tx.outbox.create({
        data: {
          id: generateId(),
          eventId,
          eventType: JOB_EVENT_TYPES.STARTED,
          topic: TOPICS.JOB_EVENTS,
          payload: {
            eventId,
            eventType: JOB_EVENT_TYPES.STARTED,
            occurredAt: new Date().toISOString(),
            jobId,
            jobType: job.type,
            tenantId: job.tenantId,
            payload: {
              workerId: config.WORKER_ID,
              attempt: attempts,
              leaseExpiresAt: leaseExpiresAt.toISOString(),
            },
          },
        },
      });

      return u;
    });

    return {
      id: updated.id,
      type: updated.type,
      payload: updated.payload,
      attempts: updated.attempts,
    };
  }

  async complete(
    jobId: string,
    result: Record<string, unknown>,
    attempt: number,
    startedAtMs: number,
  ): Promise<void> {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;

    assertTransition(job.status as JobStatus, JobStatus.COMPLETED);
    const eventId = generateId();
    const durationMs = Date.now() - startedAtMs;
    const resultJson = result as Prisma.InputJsonValue;

    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          result: resultJson,
          error: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: new Date(),
        },
      });

      await tx.outbox.create({
        data: {
          id: generateId(),
          eventId,
          eventType: JOB_EVENT_TYPES.COMPLETED,
          topic: TOPICS.JOB_EVENTS,
          payload: {
            eventId,
            eventType: JOB_EVENT_TYPES.COMPLETED,
            occurredAt: new Date().toISOString(),
            jobId,
            jobType: job.type,
            tenantId: job.tenantId,
            payload: {
              workerId: config.WORKER_ID,
              attempt,
              resultJson,
              durationMs,
            },
          },
        },
      });
    });

    logger.info("Job completed", { jobId, durationMs });
  }
  /**
   * Fail the job. If attempts remain → RETRYING → (backoff) → QUEUED + enqueue.
   * If exhausted → DEAD.
   *
   * Why domain-level retry (not BullMQ attempts)?
   * Postgres is source of truth for attempts/maxAttempts/status.
   * BullMQ is only the execution transport (attempts: 1).
   */
  async fail(jobId: string, error: string, attempt: number): Promise<void> {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;

    assertTransition(job.status as JobStatus, JobStatus.FAILED);
    const eventId = generateId();
    const willRetry = attempt < job.maxAttempts;
    // 1) RUNNING → FAILED (+ outbox job.failed)
    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          error,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });

      await tx.outbox.create({
        data: {
          id: generateId(),
          eventId,
          eventType: JOB_EVENT_TYPES.FAILED,
          topic: TOPICS.JOB_EVENTS,
          payload: {
            eventId,
            eventType: JOB_EVENT_TYPES.FAILED,
            occurredAt: new Date().toISOString(),
            jobId,
            jobType: job.type,
            tenantId: job.tenantId,
            payload: {
              workerId: config.WORKER_ID,
              attempt,
              error,
              willRetry,
            },
          },
        },
      });
    });

    logger.warn("Job failed", {
      jobId,
      error,
      willRetry,
      attempt,
      maxAttempts: job.maxAttempts,
    });
    if (!willRetry) {
      // FAILED → DEAD
      await this.markDead(jobId, job.type, job.tenantId, attempt, error);
      return;
    }
    // FAILED → RETRYING
    const backoffMs = calculateBackoffMs(attempt);
        const nextAttemptAt = new Date(Date.now() + backoffMs);
        const retryingEventId = generateId();
    
        await prisma.$transaction(async (tx) => {
          await tx.job.update({
            where: { id: jobId },
            data: {
              status: "RETRYING",
            },
          });
    
          await tx.outbox.create({
            data: {
              id: generateId(),
              eventId: retryingEventId,
              eventType: JOB_EVENT_TYPES.RETRYING,
              topic: TOPICS.JOB_EVENTS,
              payload: {
                eventId: retryingEventId,
                eventType: JOB_EVENT_TYPES.RETRYING,
                occurredAt: new Date().toISOString(),
                jobId,
                jobType: job.type,
                tenantId: job.tenantId,
                payload: {
                  attempt,
                  nextAttemptAt: nextAttemptAt.toISOString(),
                  error,
                },
              },
            },
          });
        });
    
        logger.info("Job entering retry", {
          jobId,
          attempt,
          backoffMs,
          nextAttemptAt: nextAttemptAt.toISOString(),
        });
    
        // Wait out the backoff, then RETRYING → QUEUED + enqueue.
        // (In production you might use BullMQ delayed jobs or the scheduler instead of sleep.)
        await sleep(backoffMs);
        await this.promoteRetryToQueued(jobId, job.type, job.tenantId);
  }

  private async markDead(
    jobId: string,
    jobType: string,
    tenantId: string | null,
    attempts: number,
    lastError: string,
  ): Promise<void> {
    const eventId = generateId();
    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: {
          status: "DEAD",
        },
      });

      await tx.outbox.create({
        data: {
          id: generateId(),
          eventId,
          eventType: JOB_EVENT_TYPES.DEAD,
          topic: TOPICS.JOB_EVENTS,
          payload: {
            eventId,
            eventType: JOB_EVENT_TYPES.DEAD,
            occurredAt: new Date().toISOString(),
            jobId,
            jobType,
            tenantId,
            payload: {
              attempts,
              lastError,
            },
          },
        },
      });
    });
    logger.error("Job dead – retries exhausted", {
      jobId,
      attempts,
      lastError,
    });
  }
  private async promoteRetryToQueued(
    jobId: string,
    jobType: string,
    tenantId: string | null,
  ): Promise<void> {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== "RETRYING") {
      logger.debug("promoteRetryToQueued skipped – status changed", {
        jobId,
        status: job?.status,
      });
      return;
    }

    assertTransition(JobStatus.RETRYING, JobStatus.QUEUED);
    const eventId = generateId();

    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: { status: "QUEUED" },
      });

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
            jobId,
            jobType,
            tenantId,
            payload: {
              status: "QUEUED",
              priority: job.priority,
            },
          },
        },
      });
    });

    try {
      await enqueueJob(jobId);
    } catch (err) {
      logger.error("Retry promote: DB is QUEUED but enqueue failed", {
        jobId,
        err,
      });
    }

    logger.info("Job requeued after backoff", { jobId });
  }
}

export const jobLifecycle = new JobLifecycleService();
