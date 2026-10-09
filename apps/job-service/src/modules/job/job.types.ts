import type { Job, JobPriority, JobStatus, Prisma } from "../../infrastructure/prisma.js";

export type CreateJobWriteData = {
  id: string;
  type: string;
  status: JobStatus;
  priority: JobPriority;
  payload: Prisma.InputJsonValue;
  maxAttempts: number;
  scheduledAt: Date | null;
  idempotencyKey: string | null;
  tenantId: string | null;
};
export type ListJobsFilter = {
  status?: JobStatus;
  type?: string
  tenantId?: string;
    page?: number;
    limit?: number;
}

export type ListJobsResult = {
  items: Job[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type OutboxEventInput = {
  eventId: string;
  eventType: string;
  topic: string;
  payload: Prisma.InputJsonValue;
};