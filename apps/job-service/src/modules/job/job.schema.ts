import { JobPriority, JobStatus } from "@job-platform/shared-types";
import { z } from "zod";

export const createJobBodySchema = z.object({
  type: z.string().min(1).max(128),
  payload: z.record(z.unknown()).default({}),
  priority: z.nativeEnum(JobPriority).optional(),
  maxAttempts: z.number().int().min(1).max(25).optional(),
  scheduledAt: z.coerce.date().optional().nullable(),
  idempotencyKey: z.string().min(1).max(256).optional().nullable(),
  tenantId: z.string().min(1).max(128).optional().nullable(),
});

export type CreateJobInput = z.infer<typeof createJobBodySchema>;

export const listJobsQuerySchema = z.object({
  status: z.nativeEnum(JobStatus).optional(),
  type: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;

export const jobIdParamsSchema = z.object({
  id: z.string().uuid(),
});
