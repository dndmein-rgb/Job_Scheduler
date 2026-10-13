import { Router } from "express";
import type { Request, Response } from "express";
import { runReadinessChecks } from "../../infrastructure/readiness.js";
import { getMetrics, inc, metricsText } from "../../infrastructure/metrics.js";

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

// GET /metrics → Prometheus text (scrapers)
router.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.status(200).send(await metricsText());
});

// Optional: keep JSON for humans
router.get("/metrics.json", (_req, res) => {
  res.status(200).json({ success: true, data: getMetrics() });
});

export default router;