import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { connectKafka, disconnectKafka } from "./infrastructure/kafka.js";
import { outboxPublisher } from "./infrastructure/outbox-publisher.js";

const app = createApp();

async function main() {
  try {
    await connectKafka();
  } catch (err) {
    logger.warn("Kafka connect failed at boot – outbox will retry", { err });
  }

  outboxPublisher.start(1000);

  const server = app.listen(config.PORT, () => {
    logger.info("job-service listening", {
      port: config.PORT,
      env: config.NODE_ENV,
    });
  });

  async function shutdown(signal: string) {
    logger.info("Shutting down job-service…", { signal });
    outboxPublisher.stop();
    server.close(async () => {
      await disconnectKafka().catch(() => undefined);
      logger.info("HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error("Failed to start job-service", err);
  process.exit(1);
});