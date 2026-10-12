import type { Request, Response } from "express";
import { asyncHandler } from "@job-platform/shared-utils";
import { workerService } from "./worker.container.js";
import type { ListWorkersQuery } from "./worker.schema.js";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListWorkersQuery;
  const result = await workerService.list({
    status: q.status,
    page: Number(q.page) || 1,
        limit: Number(q.limit) || 20,
  });
  res.status(200).json({ success: true, data: result.items, meta: {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  }});
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const worker = await workerService.getById(req.params.id as string);
  res.status(200).json({ success: true, data: worker });
});