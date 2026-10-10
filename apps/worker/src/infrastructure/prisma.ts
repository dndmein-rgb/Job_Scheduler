import { createPrismaClient } from "@job-platform/database";
import { config } from "../config/index.js";

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient({
    connectionString: config.DATABASE_URL,
    log: config.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (config.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { Job, JobStatus, Prisma } from "@job-platform/database";