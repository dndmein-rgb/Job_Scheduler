import "dotenv/config"
import { z } from "zod";


const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    LOG_LEVEL: z.string().default("info"),
    WORKER_ID: z.string().default(`worker-${process.pid}`),
    WORKER_CAPABILITIES: z.string().default("SEND_EMAIL"),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default("redis://:jobplatform@localhost:6381"),
    KAFKA_BROKER: z.string().default("localhost:9096"),
    KAFKA_CLIENT_ID: z.string().default("worker"),
  
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  WORKER_CAPABILITIES: parsed.data.WORKER_CAPABILITIES.split(",").map((c) => c.trim()),
  SERVICE_NAME: "worker",
} as const;