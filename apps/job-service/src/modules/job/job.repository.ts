import { generateId } from "@job-platform/shared-utils";
import { Job, Prisma, prisma } from "../../infrastructure/prisma.js";
import { JobInterface } from "./job.interface.js";
import {
  CreateJobWriteData,
  ListJobsFilter,
  ListJobsResult,
  OutboxEventInput,
} from "./job.types.js";

export class JobRepository implements JobInterface {
  async findById(id: string): Promise<Job | null> {
    return prisma.job.findUnique({
      where: { id },
    });
  }
  async findByIdempotencyKey(key: string): Promise<Job | null> {
    return prisma.job.findUnique({
      where: { idempotencyKey: key },
    });
  }
  /**
   * Create job + outbox row(s) atomically.
   * Why one transaction? Outbox pattern — no dual-write with Kafka.
   */
  async createWithOutbox(
    data: CreateJobWriteData,
    events: OutboxEventInput[],
  ): Promise<Job> {
    
    return prisma.$transaction(async (tx) => {
      const job = await tx.job.create({
        data: {
          id:data.id,
          type: data.type,
          status:data.status,
          priority: data.priority ?? "MEDIUM",
          payload: data.payload,
          maxAttempts: data.maxAttempts??3,
          scheduledAt: data.scheduledAt,
          idempotencyKey: data.idempotencyKey ?? null,
          tenantId: data.tenantId ?? null,
          attempts: 0,
          cancelRequested: false,
        },
      });
      if (events.length > 0) {
        await tx.outbox.createMany({
          data: events.map((e) => ({
            id: generateId(),
            eventId: e.eventId,
            eventType: e.eventType,
            topic: e.topic,
            payload: e.payload,
            publishedAt: null,
          })),
        });
      }
      return job;
    });
  }

  async list(filter: ListJobsFilter): Promise<ListJobsResult> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip = (page - 1) * limit;
    const where: Prisma.JobWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;
    if (filter.tenantId) where.tenantId = filter.tenantId;

    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Status update with optional outbox events (used from Phase 2+).
   * Service must call assertTransition before this.
   */

  async updateStatusWithOutbox(
    id: string,
    data: Prisma.JobUpdateInput,
    events: OutboxEventInput[],
  ): Promise<Job> {
    return prisma.$transaction(async (tx) => {
      const job = await tx.job.update({
        where: { id },
        data,
      });
      if (events.length > 0) {
        await tx.outbox.createMany({
          data: events.map((e) => ({
            id: generateId(),
            eventId: e.eventId,
            eventType: e.eventType,
            topic: e.topic,
            payload: e.payload,
            publishedAt: null,
          })),
        });
      }
      return job;
    });
  }
  /**
   * Optimistic status transition.
   * Returns the updated job, or null if no row matched (lost race / wrong status).
   */
  async updateStatusConditionalWithOutbox(
    id: string,
    fromStatuses: string[],
    data: Prisma.JobUpdateInput,
    events: OutboxEventInput[],
  ): Promise<Job | null> {
    return prisma.$transaction(async (tx) => {
      const result = await tx.job.updateMany({
        where: {
          id,
          status: { in: fromStatuses as any },
        },
        data,
      });
  
      if (result.count === 0) {
        return null;
      }
  
      if (events.length > 0) {
        await tx.outbox.createMany({
          data: events.map((e) => ({
            id: generateId(),
            eventId: e.eventId,
            eventType: e.eventType,
            topic: e.topic,
            payload: e.payload,
            publishedAt: null,
          })),
        });
      }
  
      return tx.job.findUniqueOrThrow({ where: { id } });
    });
  }
}
