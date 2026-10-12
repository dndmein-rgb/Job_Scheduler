import { Job } from "../../infrastructure/prisma.js";

export type ListDeadJobsFilter = {
  type?: string;
  tenantId?: string;
  page: number;
  limit:number
}

export type ListDeadJobsResult = {
  items: Job[];
  total:number
  page: number;
  limit: number;
  totalPages:number
}

export type JobStats = {
  byStatus: Record<string, number>;
    total: number;
    dead: number;
    running: number;
    queued: number;
    failed: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    retrying: number;
}