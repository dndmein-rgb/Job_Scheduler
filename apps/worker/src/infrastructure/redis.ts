import { Redis } from "ioredis";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: true,
});

redis.on("connect", () => logger.info("Redis TCP connection established"));
redis.on("ready", () => logger.info("Redis client is ready"));
redis.on("error", (err) => logger.error("Redis connection error", { err }));

export { redis };