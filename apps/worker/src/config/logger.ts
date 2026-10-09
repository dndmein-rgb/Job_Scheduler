import pino from "pino";
import { config } from "./index.js";

const baseLogger = pino({
  level: config.NODE_ENV === "development" ? "debug" : "info",
  ...(config.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
  base: {
    service: config.SERVICE_NAME,
  },
});

type LogMeta = Record<string, unknown> | Error | unknown;

type LogFn = {
  (msg: string, meta?: LogMeta): void;
  (meta: LogMeta, msg?: string): void;
};

const toMergingObject = (meta?: LogMeta): Record<string, unknown> => {
  if (meta === undefined || meta === null) {
    return {};
  }

  if (meta instanceof Error) {
    return {
      err: {
        message: meta.message,
        name: meta.name,
        stack: meta.stack,
      },
    };
  }

  if (typeof meta === "object") {
    return meta as Record<string, unknown>;
  }

  // primitive (string/number/boolean) – wrap it
  return { value: meta };
};

const createLogFn = (level: "info" | "error" | "warn" | "debug"): LogFn => {
  return (msgOrMeta: string | LogMeta, maybeMetaOrMsg?: string | LogMeta) => {
    // Preferred: message first
    // logger.error("Error during graceful shutdown", error)
    // logger.info("Member added", { roomId })
    if (typeof msgOrMeta === "string") {
      const msg = msgOrMeta;
      const obj = toMergingObject(maybeMetaOrMsg);
      baseLogger[level](obj, msg);
      return;
    }

    // Also support: object/error first
    // logger.error(error, "Error during graceful shutdown")
    // logger.info({ roomId }, "Member added")
    const obj = toMergingObject(msgOrMeta);
    const msg = typeof maybeMetaOrMsg === "string" ? maybeMetaOrMsg : undefined;

    if (msg) {
      baseLogger[level](obj, msg);
    } else {
      baseLogger[level](obj);
    }
  };
};

export const logger = {
  info: createLogFn("info"),
  error: createLogFn("error"),
  warn: createLogFn("warn"),
  debug: createLogFn("debug"),
  child: baseLogger.child.bind(baseLogger),
};