import express from "express";
import helmet from "helmet";
import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { requestLogger } from "./middlewares/req.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

import healthRoutes from "./modules/health/health.route.js";
import jobRoutes from "./modules/job/job.route.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(corsMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  app.use(healthRoutes);
  app.use("/jobs", jobRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  app.use(errorMiddleware);

  return app;
}