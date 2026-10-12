import { Router } from "express";
import { validateBody, validateQuery } from "../../middlewares/validate.middleware.js";
import { createJobBodySchema, listJobsQuerySchema } from "./job.schema.js";
import { create, getById, list, cancel, retry } from "./job.controller.js";
import {maybeCreateJobRateLimiter } from "../../middlewares/rate-limit.middleware.js";

const router = Router();

router.post("/", maybeCreateJobRateLimiter,validateBody(createJobBodySchema), create);
router.get("/", validateQuery(listJobsQuerySchema), list);
router.get("/:id", getById);
router.post("/:id/cancel", cancel);
router.post("/:id/retry", retry);

export default router;