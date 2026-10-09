import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      service: "job-service",
      timestamp: new Date().toISOString(),
    },
  });
});

router.get("/ready", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ready",
      checks: {
        postgres: "not_checked_yet",
        redis: "not_checked_yet",
        kafka: "not_checked_yet",
      },
    },
  });
});

export default router;