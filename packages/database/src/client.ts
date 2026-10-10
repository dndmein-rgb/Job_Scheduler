import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import pg from "pg";

export type CreatePrismaOptions = {
  connectionString: string;
  log?: Array<"error" | "warn" | "info" | "query">;
};

/**
 * Factory so each app gets its own pool but the same generated client types.
 */
export function createPrismaClient(options: CreatePrismaOptions): PrismaClient {
  const pool = new pg.Pool({ connectionString: options.connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: options.log ?? ["error"],
  });
}

export { PrismaClient };
export type {
  Job,
  Outbox,
  JobStatus,
  JobPriority,
  Prisma,
} from "./generated/prisma/client.js";