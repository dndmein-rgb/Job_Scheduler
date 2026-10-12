import { asyncHandler } from "@job-platform/shared-utils";
import type{Request,Response} from 'express'
import { CreateJobInput, ListJobsQuery } from "./job.schema.js";
import { jobService } from "./job.container.js";

export const create = asyncHandler(async (req:Request,res:Response) => {
  const body = req.body as CreateJobInput;
  const job = await jobService.create(body)
  res.status(201).json({ success: true, data: job });
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const job = await jobService.getById(req.params.id as string)
  res.status(200).json({ success: true, data: job });
})

export const list = asyncHandler(async (req: Request, res: Response) => { 
  const query =
        (req as Request & { validatedQuery?: ListJobsQuery }).validatedQuery ??
        (req.query as unknown as ListJobsQuery);

  const result=await jobService.list({status: query.status,
        type: query.type,
        tenantId: query.tenantId,
        page: query.page,
        limit: query.limit})
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
  
})

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason : undefined;
  const job = await jobService.cancel(req.params.id as string, reason);
  res.status(200).json({ success: true, data: job });
});

export const retry = asyncHandler(async (req: Request, res: Response) => {
  const job = await jobService.retry(req.params.id as string);
  res.status(200).json({ success: true, data: job });
});