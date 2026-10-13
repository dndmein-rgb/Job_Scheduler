import type { Request, Response, NextFunction, RequestHandler } from "express";
import { AppError } from "@job-platform/shared-utils";
import { config } from "../config/index.js";

/**
 * Protect /admin routes with a shared API key.
 * Accepts: X-API-Key: <key>  OR  Authorization: Bearer <key>
 */
export const adminAuth: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const expected = (config as { ADMIN_API_KEY?: string }).ADMIN_API_KEY;

  // Dev escape: if no key configured, allow (log once in real apps)
  if (!expected) {
    next();
    return;
  }

  const headerKey = req.header("x-api-key");
  const auth = req.header("authorization");
  const bearer =
    auth && auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : undefined;

  const provided = headerKey ?? bearer;

  if (!provided || provided !== expected) {
    next(
      new AppError("UNAUTHORIZED", "Invalid or missing admin API key", 401),
    );
    return;
  }

  next();
};