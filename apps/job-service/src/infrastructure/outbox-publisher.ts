import { prisma } from "./prisma.js";
import { kafkaProducer } from "./kafka.js";
import { logger } from "../config/logger.js";

/**
 * Drains outbox → Kafka.
 * At-least-once: crash after produce but before mark published may re-send.
 * Consumers should key off eventId.
 */
export class OutboxPublisher {
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickInFlight = false;

  start(pollIntervalMs = 1000): void {
    if (this.running) return;
    this.running = true;
    logger.info("OutboxPublisher started", { pollIntervalMs });
    this.timer = setInterval(() => {
      void this.tick();
    }, pollIntervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info("OutboxPublisher stopped");
  }

  private async tick(): Promise<void> {
    if (!this.running || this.tickInFlight) return;
    this.tickInFlight = true;
    try {
      const batch = await prisma.outbox.findMany({
        where: { publishedAt: null },
        orderBy: { createdAt: "asc" },
        take: 50,
      });

      for (const row of batch) {
        try {
          await kafkaProducer.send({
            topic: row.topic,
            messages: [
              {
                key: row.eventId,
                value: JSON.stringify(row.payload),
                headers: {
                  eventType: row.eventType,
                  eventId: row.eventId,
                },
              },
            ],
          });

          await prisma.outbox.update({
            where: { id: row.id },
            data: { publishedAt: new Date() },
          });
        } catch (err) {
          logger.error("Failed to publish outbox row", {
            outboxId: row.id,
            eventType: row.eventType,
            err,
          });
          // stop this batch; retry next tick
          break;
        }
      }
    } catch (err) {
      logger.error("OutboxPublisher tick failed", { err });
    } finally {
      this.tickInFlight = false;
    }
  }
}

export const outboxPublisher = new OutboxPublisher();