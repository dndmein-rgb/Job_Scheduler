import { Redis } from "ioredis";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

class RedisClient {
  private static instance: Redis | null = null;
  private static connected = false;

  private constructor() {}

  static getInstance(): Redis {
    if (RedisClient.instance) {
      return RedisClient.instance;
    }

    const client = new Redis(config.REDIS_URL, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 500, 5000);

        logger.warn(
          { attempt: times, delayMs: delay },
          "Redis reconnect attempt",
        );

        return delay;
      },
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    RedisClient.instance = client;
    RedisClient.setupEventListeners(client);

    return client;
  }

  private static setupEventListeners(client: Redis): void {
    client.on("connect", () => {
      logger.info("Redis TCP connection established");
    });

    client.on("ready", () => {
      RedisClient.connected = true;
      logger.info("Redis client is ready");
    });

    client.on("error", (error: Error) => {
      RedisClient.connected = false;
      logger.error({ err: error }, "Redis connection error");
    });

    client.on("close", () => {
      RedisClient.connected = false;
      logger.warn("Redis connection closed");
    });

    client.on("reconnecting", () => {
      RedisClient.connected = false;
      logger.warn("Reconnecting to Redis");
    });

    client.on("end", () => {
      RedisClient.connected = false;
      logger.warn("Redis connection ended");
    });
  }

  static isReady(): boolean {
    return RedisClient.connected;
  }

  static async testConnection(): Promise<boolean> {
    try {
      const response = await RedisClient.getInstance().ping();

      if (response === "PONG") {
        logger.info("Redis ping successful");
        return true;
      }

      return false;
    } catch (error) {
      logger.error({ err: error }, "Redis connection test failed");
      return false;
    }
  }

  static async closeConnection(): Promise<void> {
    const client = RedisClient.instance;

    if (!client) {
      return;
    }

    try {
      await client.quit();
      logger.info("Redis connection closed gracefully");
    } catch (error) {
      logger.error({ err: error }, "Error closing Redis connection");
      client.disconnect();
    } finally {
      RedisClient.instance = null;
      RedisClient.connected = false;
    }
  }
}

export const redis = RedisClient.getInstance();

export default RedisClient;