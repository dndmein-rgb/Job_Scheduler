import { ConflictError, generateId, NotFoundError } from "@job-platform/shared-utils";
import { JOB_EVENT_TYPES } from "@job-platform/shared-events";
import { TOPICS } from "@job-platform/shared-kafka";
import type { Job, Prisma } from "../../infrastructure/prisma.js";
import type { JobInterface } from "./job.interface.js";
import type { CreateJobInput } from "./job.schema.js";
import type {
  CreateJobWriteData,
  ListJobsFilter,
  ListJobsResult,
  OutboxEventInput,
} from "./job.types.js";
import { initialStatusForCreate } from "./job.state-machine.js";
import { logger } from "../../config/logger.js";
import { enqueueJob } from "../../infrastructure/bullmq.js";
import { JobStatus } from "@job-platform/shared-types";

export class JobService {
  constructor(private readonly repo: JobInterface) {}

  async create(input: CreateJobInput): Promise<Job> {
    if (input.idempotencyKey) {
      const existing = await this.repo.findByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        logger.info("Idempotent create – returning existing job", {
          jobId: existing.id,
          idempotencyKey: input.idempotencyKey,
        });
        return existing;
      }
    }

    const id = generateId();
    const status = initialStatusForCreate(input.scheduledAt ?? null);
    const priority = input.priority ?? "MEDIUM";
    const maxAttempts = input.maxAttempts ?? 3;
    const eventId = generateId();

    const write: CreateJobWriteData = {
      id,
      type: input.type,
      status,
      priority,
      payload: input.payload as Prisma.InputJsonValue,
      maxAttempts,
      scheduledAt: input.scheduledAt ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      tenantId: input.tenantId ?? null,
    };

    const events: OutboxEventInput[] = [
      {
        eventId,
        eventType: JOB_EVENT_TYPES.CREATED,
        topic: TOPICS.JOB_EVENTS,
        payload: {
          eventId,
          eventType: JOB_EVENT_TYPES.CREATED,
          occurredAt: new Date().toISOString(),
          jobId: id,
          jobType: input.type,
          tenantId: input.tenantId ?? null,
          payload: {
            status,
            priority,
            scheduledAt: input.scheduledAt?.toISOString() ?? null,
            idempotencyKey: input.idempotencyKey ?? null,
            maxAttempts,
          },
        },
      },
    ];

    const job = await this.repo.createWithOutbox(write, events);

    logger.info("Job created", {
      jobId: job.id,
      status: job.status,
      type: job.type,
    });
    if (job.status === "QUEUED") {
      try {
        await enqueueJob(job.id,job.priority)
      } catch (err) {
        // Job is durable in DB; missing queue message is recoverable later
            logger.error("Failed to enqueue job (DB row exists as QUEUED)", {
              jobId: job.id,
              err,
            });
      }
    }

    return job;
  }

  async getById(id: string): Promise<Job> {
    const job = await this.repo.findById(id);
    if (!job) throw new NotFoundError("Job", id);
    return job;
  }

  async list(filter: ListJobsFilter): Promise<ListJobsResult> {
    return this.repo.list(filter);
  }
  /**
   * Cancel a job.
   * Allowed: PENDING | SCHEDULED | QUEUED | RETRYING | RUNNING → CANCELLED
   */
  async cancel(id: string, reason?: string | null): Promise<Job>{
    const fromStatuses: JobStatus[] = [
      JobStatus.PENDING,
      JobStatus.SCHEDULED,
      JobStatus.RETRYING,
      JobStatus.QUEUED,
      JobStatus.RUNNING
    ]
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
            jobType: "", // filled after load if you prefer; or pass from pre-read
            tenantId: null,
            payload: { reason: reason ?? null },
          } as Prisma.InputJsonValue,
        },
      ];
    
      
    // Optional: pre-read for jobType/tenantId in the event
      const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Job", id);

    events[0]!.payload = {
        eventId,
        eventType: JOB_EVENT_TYPES.CANCELLED,
        occurredAt: new Date().toISOString(),
        jobId: id,
        jobType: existing.type,
        tenantId: existing.tenantId,
        payload: { reason: reason ?? null },
      } as Prisma.InputJsonValue;
    const cancelled = await this.repo.updateStatusConditionalWithOutbox(
        id,
        fromStatuses,
        {
          status: JobStatus.CANCELLED,
          cancelRequested: true,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
        events,
      );
    
      if (!cancelled) {
        throw new ConflictError(`Cannot cancel job in status ${existing.status}`, {
          status: existing.status,
        });
      }
    
      logger.info("Job cancelled", { jobId: id, reason: reason ?? null });
      return cancelled;
  }
  async retry(id: string): Promise<Job> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Job", id);
  
    const fromStatuses = [JobStatus.FAILED, JobStatus.DEAD];
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
          },
        } as Prisma.InputJsonValue,
      },
    ];
  
    const retried = await this.repo.updateStatusConditionalWithOutbox(
      id,
      fromStatuses,
      {
        status: JobStatus.QUEUED,
        error: null,
        attempts: 0,
        leaseOwner: null,
        leaseExpiresAt: null,
        completedAt: null,
        cancelRequested: false,
      },
      events,
    );
  
    if (!retried) {
      throw new ConflictError(`Cannot retry job in status ${existing.status}`, {
        status: existing.status,
      });
    }
  
    try {
      await enqueueJob(id,existing.priority);
    } catch (err) {
      logger.error("Admin retry: DB is QUEUED but enqueue failed", { jobId: id, err });
    }
  
    logger.info("Job admin-retried", { jobId: id });
    return retried;
  }
}