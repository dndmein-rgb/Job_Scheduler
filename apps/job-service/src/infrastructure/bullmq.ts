import { Queue } from "bullmq";
import { redis } from "./redis.js";
import { logger } from "../config/logger.js";

export const JOB_QUEUE_NAME = "jobs";

export const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 1,
  },
});

jobQueue.on("error", (err) => {
  logger.error("BullMQ queue error",{err})
})

export async function closeJobQueue(): Promise<void> {
  await jobQueue.close();
  logger.info("BullMQ job queue closed");
}