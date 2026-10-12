import type { Request, Response, NextFunction } from "express";
import { AppError, RateLimitError } from "@job-platform/shared-utils";
import { logger } from "../config/logger.js";

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {

  if (err instanceof RateLimitError) {
      logger.warn(
        { err, code: err.code, retryAfterSec: err.retryAfterSec },
        err.message,
      );
      if (!res.getHeader("Retry-After")) {
        res.setHeader("Retry-After", String(err.retryAfterSec));
      }
      res.status(429).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          retryAfterSec: err.retryAfterSec,
        },
      });
      return;
    }
  if (err instanceof AppError) {
    logger.warn({ err, code: err.code }, err.message);
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
    },
  });
}