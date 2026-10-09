import "dotenv/config"
import { z } from "zod";


const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    LOG_LEVEL: z.string().default("info"),
    SCHEDULER_POLL_INTERVAL_MS: z.coerce.number().default(2000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default("redis://:jobplatform@localhost:6381"),
    KAFKA_BROKER: z.string().default("localhost:9096"),
    KAFKA_CLIENT_ID: z.string().default("scheduler"),
  
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  SERVICE_NAME: "scheduler",
} as const;