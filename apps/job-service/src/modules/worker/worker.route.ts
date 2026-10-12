import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.middleware.js";
import { listWorkersQuerySchema } from "./worker.schema.js";
import { list, getById } from "./worker.controller.js";

const router = Router();

router.get("/", validateQuery(listWorkersQuerySchema), list);
router.get("/:id", getById);

export default router;