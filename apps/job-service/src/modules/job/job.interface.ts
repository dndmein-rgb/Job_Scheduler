import { Job, type Prisma } from "../../infrastructure/prisma.js";
import { CreateJobWriteData, ListJobsFilter, ListJobsResult, OutboxEventInput } from "./job.types.js";

export type JobStatusCounts = Record<string, number>;

export interface JobInterface {
  findById(id: string): Promise<Job | null>;
  findByIdempotencyKey(key: string): Promise<Job | null>;
  createWithOutbox(
    data: CreateJobWriteData,
    events: OutboxEventInput[],
  ): Promise<Job>;

  list(filter: ListJobsFilter): Promise<ListJobsResult>
   updateStatusWithOutbox(
      id: string,
      data: Prisma.JobUpdateInput,
      events: OutboxEventInput[],
   ): Promise<Job>

  updateStatusConditionalWithOutbox(id: string, fromStatuses: string[], data: Prisma.JobUpdateInput, events: OutboxEventInput[]): Promise<Job | null>
  countByStatus(): Promise<JobStatusCounts>;
}
