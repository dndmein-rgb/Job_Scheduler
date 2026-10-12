import { Router } from "express";
import type { Request, Response } from "express";
import { runReadinessChecks } from "../../infrastructure/readiness.js";
import { getMetrics, inc } from "../../infrastructure/metrics.js";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  inc("http_requests_total");
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      service: "job-service",
      timestamp: new Date().toISOString(),
    },
  });
});

router.get("/ready", async (_req: Request, res: Response) => {
  inc("http_requests_total");
  const result = await runReadinessChecks();

  const statusCode = result.ready ? 200 : 503;
  res.status(statusCode).json({
    success: result.ready,
    data: {
      status: result.ready ? "ready" : "not_ready",
      checks: result.checks,
      timestamp: new Date().toISOString(),
    },
  });
});

router.get("/metrics", (_req: Request, res: Response) => {
  inc("http_requests_total");
  res.status(200).json({
    success: true,
    data: getMetrics(),
  });
});

export default router;