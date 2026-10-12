import { NotFoundError } from "@job-platform/shared-utils";
import type { WorkerInterface } from "./worker.interface.js";
import type { ListWorkersFilter, ListWorkersResult } from "./worker.types.js";
import type { Worker } from "../../infrastructure/prisma.js";

export class WorkerService {
  constructor(private readonly repo: WorkerInterface) {}

  async list(filter: ListWorkersFilter): Promise<ListWorkersResult> {
    return this.repo.list(filter);
  }

  async getById(id: string): Promise<Worker> {
    const worker = await this.repo.findById(id);
    if (!worker) throw new NotFoundError("Worker", id);
    return worker;
  }
}