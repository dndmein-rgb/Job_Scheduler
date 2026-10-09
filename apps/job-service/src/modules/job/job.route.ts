import { Router } from "express";
import { validateBody, validateQuery } from "../../middlewares/validate.middleware.js";
import { createJobBodySchema, listJobsQuerySchema } from "./job.schema.js";
import { create, getById, list } from "./job.controller.js";

  const router = Router();

  router.post(
    "/",
    validateBody(createJobBodySchema),
    create,
  );

  router.get(
    "/",
    validateQuery(listJobsQuerySchema),
    list,
  );

  router.get(
    "/:id",
    getById,
  );

  export default router