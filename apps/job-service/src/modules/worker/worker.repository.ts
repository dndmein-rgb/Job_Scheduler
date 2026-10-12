import { Worker } from "@job-platform/database";
import { prisma } from "../../infrastructure/prisma.js";
import { WorkerInterface } from "./worker.interface.js";
import { ListWorkersFilter, ListWorkersResult } from "./worker.types.js";

export class WorkerRepository implements WorkerInterface{
  async list(filter: ListWorkersFilter): Promise<ListWorkersResult> {
    const page = filter.page ?? 1;
      const limit = filter.limit ?? 20;
      const skip = (page - 1) * limit;
    
      const where = filter.status ? { status: filter.status as any } : {};
    const [items, total] = await Promise.all([
      prisma.worker.findMany({
        where,
        orderBy: { lastHeartbeatAt: "desc" },
        skip,
        take:filter.limit
      }),
      prisma.worker.count({ where }),
    ])

    return {
      items,
      total,
      limit: filter.limit,
      page: filter.page,
      totalPages:Math.ceil(total/filter.limit)||1
    }
  }
  async findById(id: string): Promise<Worker | null> {
      return prisma.worker.findUnique({ where: { id } });
    }
}