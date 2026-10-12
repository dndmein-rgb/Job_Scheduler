import { generateId } from "@job-platform/shared-utils";
import { prisma } from "../infrastructure/prisma.js";
import { config } from "../config/index.js";
import { WORKER_EVENT_TYPES } from "@job-platform/shared-events";
import { TOPICS } from "@job-platform/shared-kafka";
import { logger } from "../config/logger.js";

/**
 * Registers this process in Postgres and keeps lastHeartbeatAt fresh.
 * Why DB? Same source of truth as jobs; ops can query without Redis-only state.
 */
export class WorkerRegistryService {
  private timer: ReturnType<typeof setInterval> | null = null;

  async register(): Promise<void> {
    const now = new Date();
    const eventId = generateId();
    await prisma.$transaction(async (tx) => {
      await tx.worker.upsert({
        where: { id: config.WORKER_ID },
        create: {
          id: config.WORKER_ID,
          capabilities: [...config.WORKER_CAPABILITIES],
          registeredAt: now,
          lastHeartbeatAt: now,
          status: "ONLINE",
        },
        update: {
          capabilities: [...config.WORKER_CAPABILITIES],
          status: "ONLINE",
          lastHeartbeatAt: now,
        },
      });
      await tx.outbox.create({
        data: {
          id: generateId(),
          eventId,
          eventType: WORKER_EVENT_TYPES.REGISTERED,
          topic: TOPICS.WORKER_EVENTS,
          payload: {
            eventId,
            eventType: WORKER_EVENT_TYPES.REGISTERED,
            occurredAt: now.toISOString(),
            workerId: config.WORKER_ID,
            payload: {
              capabilities: config.WORKER_CAPABILITIES,
            },
          },
        },
      });
    });
    logger.info("Worker registered", {
      workerId: config.WORKER_ID,
      capabilities: config.WORKER_CAPABILITIES,
    });
  }

  startHeartbeat(intervalMs = config.WORKER_HEARTBEAT_MS): void {
      if (this.timer) return;
  
      this.timer = setInterval(() => {
        void this.beat();
      }, intervalMs);
  
      logger.info("Worker heartbeat started", { intervalMs });
    }
  
    stopHeartbeat(): void {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
    private async beat(): Promise<void> {
        try {
          const now = new Date();
          await prisma.worker.updateMany({
            where: { id: config.WORKER_ID },
            data: {
              status: "ONLINE",
              lastHeartbeatAt: now,
            },
          });
          // Optional: outbox HEARTBEAT every N beats to avoid noise — skip for Phase 6
        } catch (err) {
          logger.warn("Worker heartbeat failed", { err });
        }
    }
    async markOffline(reason?: string): Promise<void> {
        this.stopHeartbeat();
        const eventId = generateId();
        const now = new Date();
    
        try {
          await prisma.$transaction(async (tx) => {
            await tx.worker.updateMany({
              where: { id: config.WORKER_ID },
              data: { status: "OFFLINE", lastHeartbeatAt: now },
            });
    
            await tx.outbox.create({
              data: {
                id: generateId(),
                eventId,
                eventType: WORKER_EVENT_TYPES.OFFLINE,
                topic: TOPICS.WORKER_EVENTS,
                payload: {
                  eventId,
                  eventType: WORKER_EVENT_TYPES.OFFLINE,
                  occurredAt: now.toISOString(),
                  workerId: config.WORKER_ID,
                  payload: { reason: reason ?? "shutdown" },
                },
              },
            });
          });
          logger.info("Worker marked offline", { workerId: config.WORKER_ID });
        } catch (err) {
          logger.warn("Failed to mark worker offline", { err });
        }
    }
    canProcess(jobType: string): boolean {
        return config.WORKER_CAPABILITIES.includes(jobType);
      }
}
export const workerRegistry = new WorkerRegistryService();
