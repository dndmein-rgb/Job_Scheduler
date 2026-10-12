import "dotenv/config"
import { z } from "zod";


const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3010),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://:jobplatform@localhost:6381"),
  KAFKA_BROKER: z.string().default("localhost:9096"),
  KAFKA_CLIENT_ID: z.string().default("job-service"),
  CLIENT_ORIGINS: z
        .string()
        .min(1)
        .transform((value) => value.split(",").map((origin) => origin.trim())),
  RATE_LIMIT_ENABLED: z.string().default("true").transform((v) => v === "true" || v === "1"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_GLOBAL: z.coerce.number().default(120),
  RATE_LIMIT_MAX_TENANT: z.coerce.number().default(30),
  RATE_LIMIT_MAX_IP: z.coerce.number().default(60),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  SERVICE_NAME: "job-service",
} as const;