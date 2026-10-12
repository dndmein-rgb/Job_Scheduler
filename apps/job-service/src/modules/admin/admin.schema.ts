import { z } from "zod";

export const listDeadJobsQuerySchema = z.object({
  type: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListDeadJobsQuery = z.infer<typeof listDeadJobsQuerySchema>;

export const cancelDeadBodySchema = z.object({
  reason: z.string().max(512).optional().nullable(),
});

export type CancelDeadBody = z.infer<typeof cancelDeadBodySchema>;
