import { logger } from "../config/logger.js";
import { kafkaProducer } from "./kafka.js";
import { inc } from "./metrics.js";
import { prisma } from "./prisma.js";
import { redis } from "./redis.js";

export type CheckStatus = "ok" | "fail"


export type ReadinessResult = {
  ready: boolean;
  checks: {
    postgres: CheckStatus;
    redis: CheckStatus;
        kafka: CheckStatus;
  }
}
async function checkPostgres(): Promise<CheckStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch (err) {
    logger.warn("Readiness: postgres check failed", { err });
    return "fail";
  }
}

async function checkRedis(): Promise<CheckStatus> {
  try {
    const pong = await redis.ping();
    return pong === "PONG" ? "ok" : "fail";
  } catch (err) {
    logger.warn("Readiness: redis check failed", { err });
    return "fail";
  }
}

async function checkKafka(): Promise<CheckStatus> {
  try {
    await kafkaProducer.connect();
    return "ok";
  } catch (err) {
    logger.warn("Readiness: kafka check failed", { err });
    return "fail";
  }
}

export async function runReadinessChecks(): Promise<ReadinessResult> {
  inc("readiness_checks_total");

  const [postgres, redisStatus, kafka] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkKafka(),
  ]);

  const checks = { postgres, redis: redisStatus, kafka };
  const ready = postgres === "ok" && redisStatus === "ok" && kafka === "ok";

  if (!ready) {
    inc("readiness_failures_total");
  }

  return { ready, checks };
}