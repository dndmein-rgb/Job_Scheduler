import { Queue } from "bullmq";
import { redis } from "./redis.js";
import { logger } from "../config/logger.js";
import { DomainPriority, mapPriorityToBullmq } from "@job-platform/shared-utils";

export const JOB_QUEUE_NAME = "jobs";
export const JOB_PROCESS_NAME = "process"
export type QueueJobData = { jobId: string }

const jobQueue = new Queue<QueueJobData>(JOB_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 1,
  }
})

export async function enqueueJob(
  jobId: string,
  priority?: DomainPriority,
): Promise<void> {
  const bullPriority = mapPriorityToBullmq(priority);
  await jobQueue.add(
    JOB_PROCESS_NAME,
    { jobId },
    {
      // stable id → at-most-once enqueue for same jobId (BullMQ dedupe by jobId)
      jobId,
      priority: bullPriority,
    },
  );
  logger.info("Worker enqueued job retry", {
    jobId,
    priority: priority ?? "MEDIUM",
    bullPriority,
  });
}