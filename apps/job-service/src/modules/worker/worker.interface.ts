import { Worker } from "@job-platform/database";
import { ListWorkersFilter, ListWorkersResult } from "./worker.types.js";

export interface WorkerInterface{
  list(filter: ListWorkersFilter): Promise<ListWorkersResult>
  findById(is:string):Promise<Worker|null>
}
