import { Router, type IRouter } from "express";
import healthRouter from "./health";
import websitesRouter from "./websites";
import keywordsRouter from "./keywords";
import socialPostsRouter from "./social-posts";
import campaignsRouter from "./campaigns";
import backlinksRouter from "./backlinks";
import leadsRouter from "./leads";
import analyticsRouter from "./analytics";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(websitesRouter);
router.use(keywordsRouter);
router.use(socialPostsRouter);
router.use(campaignsRouter);
router.use(backlinksRouter);
router.use(leadsRouter);
router.use(analyticsRouter);
router.use(aiRouter);

export default router;
