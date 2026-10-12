import { WorkerRepository } from "./worker.repository.js";
import { WorkerService } from "./worker.service.js";

const repo = new WorkerRepository();
export const workerService = new WorkerService(repo);