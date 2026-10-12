import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@job-platform/database";
import { config } from "../config/index.js";
import pg from "pg";
import { logger } from "../config/logger.js";

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: config.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (config.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

prisma.$on("query" as never, (e: { query: string; duration: number }) => {
  if (config.LOG_LEVEL === "debug") {
    logger.debug("prisma query", { query: e.query, durationMs: e.duration });
  }
});

export type {
  Job,
  Outbox,
  JobStatus,
  JobPriority,
  Prisma,
  Worker,
  WorkerStatus,
} from "@job-platform/database";
