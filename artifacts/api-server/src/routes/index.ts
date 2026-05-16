import { Router, type IRouter } from "express";
import healthRouter from "./health";
import kaggleRouter from "./kaggle";
import telegramRouter from "./telegram";

const router: IRouter = Router();

router.use(healthRouter);
router.use(kaggleRouter);
router.use(telegramRouter);

export default router;
