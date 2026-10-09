import { JobRepository } from "./job.repository.js";
import { JobService } from "./job.service.js";

const jobRepository = new JobRepository()
export const jobService=new JobService(jobRepository) 