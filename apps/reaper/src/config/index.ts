import "dotenv/config"
import { z } from "zod";

  const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    LOG_LEVEL: z.string().default("info"),
    REAPER_POLL_INTERVAL_MS: z.coerce.number().default(5000),
    LEASE_GRACE_MS: z.coerce.number().default(2000),
    DATABASE_URL: z.string().min(1),
    KAFKA_BROKER: z.string().default("localhost:9096"),
    KAFKA_CLIENT_ID: z.string().default("reaper"),
  
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  SERVICE_NAME: "reaper",
} as const;