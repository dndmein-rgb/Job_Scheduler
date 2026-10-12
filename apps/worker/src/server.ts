import { Worker } from "bullmq";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { redis } from "./infrastructure/redis.js";
import { prisma } from "./infrastructure/prisma.js";
import { jobLifecycle } from "./services/job-lifecycle.service.js";
import { getProcessor } from "./processors/index.js";
import { startLeaseHeartbeat } from "./services/lease-heartbeat.js";
import { workerRegistry } from "./services/worker-registry.service.js";

const JOB_QUEUE_NAME = "jobs";

async function main() {
  await workerRegistry.register();
  workerRegistry.startHeartbeat();

  logger.info("Worker starting", {
    workerId: config.WORKER_ID,
    capabilities: config.WORKER_CAPABILITIES,
    leaseMs: config.LEASE_MS,
    env: config.NODE_ENV,
  });

  const worker = new Worker<{ jobId: string }>(
    JOB_QUEUE_NAME,
    async (bullJob) => {
      const jobId = bullJob.data.jobId;
      const t0 = Date.now();

      const claimed = await jobLifecycle.claim(jobId);
      const stopHeartbeat = startLeaseHeartbeat(jobId);

      try {
        const latest = await prisma.job.findUnique({ where: { id: jobId } });
        if (
          !latest ||
          latest.status === "CANCELLED" ||
          latest.cancelRequested
        ) {
          logger.info("Job cancelled – skipping processor", { jobId });
          return;
        }

        if (!workerRegistry.canProcess(claimed.type)) {
          await jobLifecycle.releaseToQueue(
            jobId,
            `worker ${config.WORKER_ID} lacks capability ${claimed.type}`,
          );
          return;
        }

        const processor = getProcessor(claimed.type);
        const result = await processor(claimed.payload);
        await jobLifecycle.complete(jobId, result, claimed.attempts, t0);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await jobLifecycle.fail(jobId, message, claimed.attempts);
      } finally {
        stopHeartbeat();
      }
    },
    { connection: redis, concurrency: 5 },
  );

  worker.on("completed", (job) => {
    logger.info("BullMQ job completed", { bullJobId: job.id });
  });
  worker.on("failed", (job, err) => {
    logger.error("BullMQ job failed", { bullJobId: job?.id, err });
  });

  async function shutdown(signal: string) {
    logger.info("Shutting down worker…", { signal });
    await workerRegistry.markOffline(signal);
    await worker.close();
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error("Failed to start worker", err);
  process.exit(1);
});