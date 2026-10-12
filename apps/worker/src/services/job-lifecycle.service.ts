import {
  calculateBackoffMs,
  generateId,
  NotFoundError,
  sleep,
} from "@job-platform/shared-utils";
import { JOB_EVENT_TYPES } from "@job-platform/shared-events";
import { TOPICS } from "@job-platform/shared-kafka";
import { Prisma, prisma } from "../infrastructure/prisma.js";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { enqueueJob } from "../infrastructure/bullmq.js";

export class JobLifecycleService {
  async claim(jobId: string) {
    const leaseExpiresAt = new Date(Date.now() + config.LEASE_MS);
    const eventId = generateId();

    const claimed = await prisma.$transaction(async (tx) => {
      // Optimistic: only one worker can win QUEUED|RETRYING → RUNNING
      const result = await tx.job.updateMany({
        where: {
          id: jobId,
          status: { in: ["QUEUED", "RETRYING"] },
        },
        data: {
          status: "RUNNING",
          attempts: { increment: 1 },
          leaseOwner: config.WORKER_ID,
          leaseExpiresAt,
          // First claim wins startedAt; retries keep original if already set.
          // Prisma updateMany can't do COALESCE easily — set only when we know
          // it's the first attempt by reading after update, or always set:
          startedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return null;
      }

      const job = await tx.job.findUniqueOrThrow({ where: { id: jobId } });

      // Optional: if you want startedAt only on first claim, fix it here:
      // if (job.attempts > 1 && job.startedAt was overwritten) { ... }
      // For learning, overwriting startedAt on retry is acceptable.

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
              attempt: job.attempts,
              leaseExpiresAt: leaseExpiresAt.toISOString(),
            },
          },
        },
      });

      return job;
    });

    if (!claimed) {
      // Lost the race or job not claimable
      const current = await prisma.job.findUnique({ where: { id: jobId } });
      if (!current) throw new NotFoundError("Job", jobId);
      logger.warn("Skip job – not claimable (lost race or bad status)", {
        jobId,
        status: current.status,
      });
      throw new Error(`Job not claimable: ${current.status}`);
    }

    return {
      id: claimed.id,
      type: claimed.type,
      payload: claimed.payload,
      attempts: claimed.attempts,
    };
  }
  async complete(
    jobId: string,
    result: Record<string, unknown>,
    attempt: number,
    startedAtMs: number,
  ): Promise<void> {
    const eventId = generateId();
    const durationMs = Date.now() - startedAtMs;
    const resultJson = result as Prisma.InputJsonValue;

    const didComplete = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.updateMany({
        where: {
          id: jobId,
          status: "RUNNING",
          leaseOwner: config.WORKER_ID,
        },
        data: {
          status: "COMPLETED",
          result: resultJson,
          error: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: new Date(),
        },
      });

      if (updated.count === 0) return false;

      const job = await tx.job.findUniqueOrThrow({ where: { id: jobId } });

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

      return true;
    });

    if (!didComplete) {
      logger.warn("Complete skipped – job not RUNNING under this worker", {
        jobId,
      });
      return;
    }

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

  /**
   * Fail the job. If attempts remain → RETRYING → (backoff) → QUEUED + enqueue.
   * If exhausted → DEAD.
   *
   * Concurrency: first transition uses
   *   where: { id, status: "RUNNING", leaseOwner: this worker }
   * so a reaper/other worker cannot be overwritten.
   */
  async fail(jobId: string, error: string, attempt: number): Promise<void> {
    const failedEventId = generateId();

    // 1) RUNNING → FAILED (optimistic)
    const failed = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.updateMany({
        where: {
          id: jobId,
          status: "RUNNING",
          leaseOwner: config.WORKER_ID,
        },
        data: {
          status: "FAILED",
          error,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });

      if (updated.count === 0) {
        return null; // lost race — reaped, completed, or another worker
      }

      const job = await tx.job.findUniqueOrThrow({ where: { id: jobId } });
      const willRetry = attempt < job.maxAttempts;

      await tx.outbox.create({
        data: {
          id: generateId(),
          eventId: failedEventId,
          eventType: JOB_EVENT_TYPES.FAILED,
          topic: TOPICS.JOB_EVENTS,
          payload: {
            eventId: failedEventId,
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

      return { job, willRetry };
    });

    if (!failed) {
      logger.warn("Fail skipped – job not RUNNING under this worker", {
        jobId,
      });
      return;
    }

    const { job, willRetry } = failed;

    logger.warn("Job failed", {
      jobId,
      error,
      willRetry,
      attempt,
      maxAttempts: job.maxAttempts,
    });

    if (!willRetry) {
      await this.markDead(jobId, job.type, job.tenantId, attempt, error);
      return;
    }

    // 2) FAILED → RETRYING
    const backoffMs = calculateBackoffMs(attempt);
    const nextAttemptAt = new Date(Date.now() + backoffMs);
    const retryingEventId = generateId();

    const didRetry = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.updateMany({
        where: {
          id: jobId,
          status: "FAILED",
        },
        data: {
          status: "RETRYING",
        },
      });

      if (updated.count === 0) {
        return false;
      }

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

      return true;
    });

    if (!didRetry) {
      logger.warn("Retry transition skipped – status changed", { jobId });
      return;
    }

    logger.info("Job entering retry", {
      jobId,
      attempt,
      backoffMs,
      nextAttemptAt: nextAttemptAt.toISOString(),
    });

    // 3) Backoff then RETRYING → QUEUED + enqueue
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

    const didMark = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.updateMany({
        where: {
          id: jobId,
          status: "FAILED",
        },
        data: {
          status: "DEAD",
        },
      });

      if (updated.count === 0) return false;

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

      return true;
    });

    if (!didMark) {
      logger.warn("markDead skipped – status changed", { jobId });
      return;
    }

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
    const eventId = generateId();

    const promoted = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.updateMany({
        where: {
          id: jobId,
          status: "RETRYING",
        },
        data: {
          status: "QUEUED",
        },
      });

      if (updated.count === 0) {
        return null;
      }

      const job = await tx.job.findUniqueOrThrow({ where: { id: jobId } });

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

      return job;
    });

    if (!promoted) {
      logger.debug("promoteRetryToQueued skipped – status changed", { jobId });
      return;
    }

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

  /**
   * Worker cannot run this type: put back to QUEUED and re-enqueue.
   * Does not count as a failure / attempt.
   */
  async releaseToQueue(jobId: string, reason: string): Promise<void> {
    const eventId = generateId();
  
    const released = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.updateMany({
        where: {
          id: jobId,
          status: "RUNNING",
          leaseOwner: config.WORKER_ID,
        },
        data: {
          status: "QUEUED",
          leaseOwner: null,
          leaseExpiresAt: null,
          // roll back the attempt increment from claim
          attempts: { decrement: 1 },
        },
      });
  
      if (updated.count === 0) return null;
  
      const job = await tx.job.findUniqueOrThrow({ where: { id: jobId } });
  
      // Clamp attempts at 0
      if (job.attempts < 0) {
        await tx.job.update({
          where: { id: jobId },
          data: { attempts: 0 },
        });
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
            jobId,
            jobType: job.type,
            tenantId: job.tenantId,
            payload: {
              status: "QUEUED",
              priority: job.priority,
              releaseReason: reason,
            },
          },
        },
      });
  
      return job;
    });
  
    if (!released) {
      logger.warn("releaseToQueue skipped – not owned RUNNING", { jobId });
      return;
    }
  
    try {
      await enqueueJob(jobId);
    } catch (err) {
      logger.error("releaseToQueue: DB QUEUED but enqueue failed", { jobId, err });
    }
  
    logger.info("Job released to queue (unsupported type)", { jobId, reason });
  }
}

export const jobLifecycle = new JobLifecycleService();
