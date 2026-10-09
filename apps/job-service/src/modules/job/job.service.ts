import { generateId, NotFoundError } from "@job-platform/shared-utils";
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
}