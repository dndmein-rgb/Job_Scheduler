export * from "./errors.js";
export { asyncHandler } from "./asyncHandler.js";

import { v4 as uuidv4 } from "uuid";
import type { Uuid } from "@job-platform/shared-types";

export function generateId(): Uuid {
  return uuidv4() as Uuid;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateBackoffMs(
  attempt: number,
  baseMs = 1000,
  capMs = 60_000,
): number {
  const exp = Math.min(capMs, baseMs * Math.pow(2, attempt));
  return Math.floor(Math.random() * exp);
}