import rateLimit, {
  type Options,
  type ValueDeterminingMiddleware,
} from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { Redis } from "ioredis";
import type { Request, Response, RequestHandler } from "express";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { inc } from "../infrastructure/metrics.js";

/** Dedicated Redis client – do NOT share BullMQ’s connection */
const rateLimitRedis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

rateLimitRedis.on("error", (err) => {
  logger.error("Rate-limit Redis error", { err });
});

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0]!.trim();
  }
  // req.ip is set when "trust proxy" is enabled; fallback to socket
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  prefix: string;
  error: { message: string; code: string };
  /** Must match express-rate-limit: (req, res) => string */
  keyGenerator?: ValueDeterminingMiddleware<string>;
}

export const createRateLimiter = ({
  windowMs,
  limit,
  prefix,
  error,
  keyGenerator,
}: RateLimiterOptions): RequestHandler => {
  const options: Partial<Options> = {
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Redis down → allow traffic (readiness already reports redis fail)
    passOnStoreError: true,
    // Custom keyGenerator: disable IP-fallback validation warning
    validate: {
      keyGeneratorIpFallback: false,
    },
    store: new RedisStore({
      sendCommand: async (...args: string[]) => {
        const [command, ...commandArgs] = args;
        if (!command) {
          throw new Error("Redis command is required");
        }
        return rateLimitRedis.call(
          command,
          ...commandArgs,
        ) as Promise<RedisReply>;
      },
      prefix: `rate-limit:${prefix}:`,
    }),
    keyGenerator:
      keyGenerator ??
      (((req: Request, _res: Response) => {
        return clientIp(req);
      }) satisfies ValueDeterminingMiddleware<string>),
    handler: (_req, res) => {
      inc("jobs_rate_limited_total");
      res.status(429).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    },
  };

  return rateLimit(options);
};

/** Broad API shield (optional) */
export const globalRateLimiter = createRateLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS * 15,
  limit: config.RATE_LIMIT_MAX_GLOBAL * 10,
  prefix: "job-global",
  error: {
    code: "GLOBAL_RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please try again later.",
  },
});

/**
 * POST /jobs – key by tenantId if present, else IP.
 * Note: body is available only after express.json().
 */
const createJobKeyGenerator: ValueDeterminingMiddleware<string> = (
  req: Request,
  _res: Response,
) => {
  const body = req.body as { tenantId?: unknown } | undefined;
  const tenantId =
    body && typeof body.tenantId === "string" && body.tenantId.length > 0
      ? body.tenantId
      : null;

  if (tenantId) {
    return `tenant:${tenantId}`;
  }
  return `ip:${clientIp(req)}`;
};

export const createJobRateLimiter = createRateLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  limit: config.RATE_LIMIT_MAX_TENANT,
  prefix: "jobs-create",
  error: {
    code: "JOB_CREATE_RATE_LIMIT_EXCEEDED",
    message: "Too many jobs created. Please slow down.",
  },
  keyGenerator: createJobKeyGenerator,
});

/** Honor RATE_LIMIT_ENABLED */
export const maybeCreateJobRateLimiter: RequestHandler = (req, res, next) => {
  if (!config.RATE_LIMIT_ENABLED) {
    next();
    return;
  }
  return createJobRateLimiter(req, res, next);
};