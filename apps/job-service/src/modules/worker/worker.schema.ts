import { z } from "zod"

export const listWorkersQuerySchema = z.object({
  status: z.enum(["ONLINE", "OFFLINE", "DRAINING"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit:z.coerce.number().int().min(1).max(100).default(20)
})

export type ListWorkersQuery = z.infer<typeof listWorkersQuerySchema>;