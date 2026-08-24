import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import cullsRouter from "./culls.js";
import stalkersRouter from "./stalkers.js";
import sessionsRouter from "./sessions.js";
import assessmentsRouter from "./assessments.js";
import { requireAuth } from "../middlewares/session.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stalkersRouter);
router.use(requireAuth, cullsRouter);
router.use(sessionsRouter);
router.use(assessmentsRouter);

export default router;
