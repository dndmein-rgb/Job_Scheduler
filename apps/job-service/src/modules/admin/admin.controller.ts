import type { Request, Response } from "express";
import { asyncHandler } from "@job-platform/shared-utils";
import { adminService } from "./admin.container.js";
import type { ListDeadJobsQuery } from "./admin.schema.js";

export const listDeadJobs = asyncHandler(async (req: Request, res: Response) => {
  const query =
    (req as Request & { validatedQuery?: ListDeadJobsQuery }).validatedQuery ??
    (req.query as unknown as ListDeadJobsQuery);

  const result = await adminService.listDeadJobs({
    type: query.type,
    tenantId: query.tenantId,
    page: query.page,
    limit: query.limit,
  });

  res.status(200).json({
    success: true,
    data: result.items,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    },
  });
});

export const retryDeadJob = asyncHandler(async (req: Request, res: Response) => {
  const job = await adminService.retryDead(req.params.id as string);
  res.status(200).json({ success: true, data: job });
});

export const cancelDeadJob = asyncHandler(async (req: Request, res: Response) => {
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason : undefined;
  const job = await adminService.cancelDead(req.params.id as string, reason);
  res.status(200).json({ success: true, data: job });
});

export const getStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getStats();
  res.status(200).json({ success: true, data: stats });
});