import { JobRepository } from "../job/job.repository.js";
import { AdminService } from "./admin.service.js";

const jobRepository = new JobRepository();
export const adminService=new AdminService(jobRepository)