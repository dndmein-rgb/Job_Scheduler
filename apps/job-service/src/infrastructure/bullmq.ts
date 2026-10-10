import { Queue } from "bullmq";
import { redis } from "./redis.js";
import { logger } from "../config/logger.js";

export const JOB_QUEUE_NAME = "jobs";
export const JOB_PROCESS_NAME = "process";

export type QueueJobData = {
  jobId: string;
};

export const jobQueue = new Queue<QueueJobData>(JOB_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 1,
  },
});

jobQueue.on("error", (err) => {
  logger.error("BullMQ queue error", { err });
});

export async function enqueueJob(jobId: string): Promise<void> {
  await jobQueue.add(
    JOB_PROCESS_NAME,
    { jobId },
    {
      // stable id → at-most-once enqueue for same jobId (BullMQ dedupe by jobId)
      jobId,
    },
  );
  logger.info("Enqueued job to BullMQ", { jobId });
}

export async function closeJobQueue(): Promise<void> {
  await jobQueue.close();
  logger.info("BullMQ job queue closed");
}
