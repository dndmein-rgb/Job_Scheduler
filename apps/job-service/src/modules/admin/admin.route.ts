import { Router } from "express";
import { validateBody, validateQuery } from "../../middlewares/validate.middleware.js";
import {
  cancelDeadBodySchema,
  listDeadJobsQuerySchema,
} from "./admin.schema.js";
import {
  cancelDeadJob,
  getOutboxStats,
  getQueueStats,
  getStats,
  listDeadJobs,
  retryDeadJob,
} from "./admin.controller.js";
import { adminAuth } from "../../middlewares/admin-auth.middleware.js";

const router = Router();

router.use(adminAuth);

/** List DEAD jobs (DLQ view) */
router.get("/dead-jobs", validateQuery(listDeadJobsQuerySchema), listDeadJobs);

/** Retry a DEAD job → QUEUED + enqueue */
router.post("/dead-jobs/:id/retry", retryDeadJob);

/** Permanently cancel a DEAD job → CANCELLED */
router.post(
  "/dead-jobs/:id/cancel",
  validateBody(cancelDeadBodySchema),
  cancelDeadJob,
);

/** Aggregate job counts by status */
router.get("/stats", getStats);


// unlock “everything” for the frontend
router.get("/queues", getQueueStats);
router.get("/outbox-stats", getOutboxStats);
export default router;