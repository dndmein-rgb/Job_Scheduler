/**
 * Admin / DLQ operations.
 * DEAD jobs are still rows in `jobs` with status = DEAD.
 * We do not introduce a separate DLQ table.
 */

import { JobStatus } from "@job-platform/shared-types";
import { JobInterface } from "../job/job.interface.js";
import { JobStats, ListDeadJobsFilter, ListDeadJobsResult } from "./admin.types.js";
import { Job, Prisma } from "../../infrastructure/prisma.js";
import { ConflictError, generateId, NotFoundError } from "@job-platform/shared-utils";
import { JOB_EVENT_TYPES } from "@job-platform/shared-events";
import { TOPICS } from "@job-platform/shared-kafka";
import { logger } from "../../config/logger.js";
import { enqueueJob } from "../../infrastructure/bullmq.js";

export class AdminService {
  constructor(private readonly jobRepo: JobInterface) {
    
  }

  /**
     * List only DEAD jobs (paginated + optional type/tenant filters).
     */

  async listDeadJobs(filter: ListDeadJobsFilter): Promise<ListDeadJobsResult> {
    return this.jobRepo.list({
      tenantId: filter.tenantId,
      status: JobStatus.DEAD,
      type: filter.type,
      page: filter.page,
      limit: filter.limit
    })
  }

  /**
     * Admin retry of a DEAD job → QUEUED + enqueue.
     * Same semantics as JobService.retry, but restricted to DEAD.
     */
  async retryDead(id: string): Promise<Job> {
    const existing = await this.jobRepo.findById(id);
    if (!existing) throw new NotFoundError("Job", id);
    if (existing.status !== JobStatus.DEAD) {
      throw new ConflictError(
        `Admin dead-retry only allowed for DEAD jobs (current: ${existing.status})`,
        { status: existing.status },
      );
    }
    const eventId = generateId();
    const events = [
      {
        eventId,
        eventType: JOB_EVENT_TYPES.QUEUED,
        topic: TOPICS.JOB_EVENTS,
        payload: {
          eventId,
          eventType: JOB_EVENT_TYPES.QUEUED,
          occurredAt: new Date().toISOString(),
          jobId: id,
          jobType: existing.type,
          tenantId: existing.tenantId,
          payload: {
            status: JobStatus.QUEUED,
            priority: existing.priority,
            adminRetry: true,
            fromDead: true,
          },
        } as Prisma.InputJsonValue,
      },
    ];
    const retried = await this.jobRepo.updateStatusConditionalWithOutbox(id, [JobStatus.DEAD], {
      status: JobStatus.QUEUED,
      error: null,
      attempts: 0,
      leaseOwner: null,
      leaseExpiresAt: null,
      completedAt: null,
      cancelRequested: false,
    }, events)
    if (!retried) {
      throw new ConflictError(`Cannot retry job in status ${existing.status}`, {
        status: existing.status,
      });
    }

    try {
      await enqueueJob(id,existing.priority);
    } catch (err) {
      logger.error("Admin dead-retry: DB is QUEUED but enqueue failed", {
        jobId: id,
        err,
      });
    }
    
    logger.info("Dead job admin-retried", { jobId: id });
    return retried;
  }
  /**
     * Permanently close a DEAD job → CANCELLED.
     * Requires DEAD → CANCELLED in the state machine.
     */

  async cancelDead(id: string, reason?: string | null): Promise<Job> {
    const existing = await this.jobRepo.findById(id);
    if (!existing) throw new NotFoundError("Job", id);
    
    if (existing.status !== JobStatus.DEAD) {
      throw new ConflictError(
        `Admin dead-cancel only allowed for DEAD jobs (current: ${existing.status})`,
        { status: existing.status },
      );
    }
    
    const eventId = generateId();
    const events = [
      {
        eventId,
        eventType: JOB_EVENT_TYPES.CANCELLED,
        topic: TOPICS.JOB_EVENTS,
        payload: {
          eventId,
          eventType: JOB_EVENT_TYPES.CANCELLED,
          occurredAt: new Date().toISOString(),
          jobId: id,
          jobType: existing.type,
          tenantId: existing.tenantId,
          payload: {
            reason: reason ?? "admin_dead_cancel",
            fromDead: true,
          },
        } as Prisma.InputJsonValue,
      },
    ];
    
    const cancelled = await this.jobRepo.updateStatusConditionalWithOutbox(
      id,
      [JobStatus.DEAD],
      {
        status: JobStatus.CANCELLED,
        cancelRequested: true,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
      events,
    );
    
    if (!cancelled) {
      throw new ConflictError(
        `Cannot cancel dead job in status ${existing.status}`,
        { status: existing.status },
      );
    }
    
    logger.info("Dead job cancelled by admin", {
      jobId: id,
      reason: reason ?? null,
    });
    return cancelled;
  }
  


  /**
     * Simple aggregate counts by status (source of truth = Postgres).
     */

  async getStats(): Promise<JobStats>{
    const byStatus = await this.jobRepo.countByStatus();
    
        const get = (s: string) => byStatus[s] ?? 0;
        const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
    
        return {
          byStatus,
          total,
          dead: get(JobStatus.DEAD),
          running: get(JobStatus.RUNNING),
          queued: get(JobStatus.QUEUED),
          failed: get(JobStatus.FAILED),
          scheduled: get(JobStatus.SCHEDULED),
          completed: get(JobStatus.COMPLETED),
          cancelled: get(JobStatus.CANCELLED),
          retrying: get(JobStatus.RETRYING),
        };
      }
  
}