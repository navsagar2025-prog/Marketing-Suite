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
import mediaAssetsRouter from "./media-assets";
import settingsRouter from "./settings";
import authRouter from "./auth";
import adminRouter from "./admin";
import publicAuditRouter from "./public-audit";
import publicContactRouter from "./public-contact";
import usageRouter from "./usage";
import emailWebhooksRouter from "./email-webhooks";
import conversationsRouter from "./conversations";
import sequencesRouter from "./sequences";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);

router.use(authRouter);

router.use(publicAuditRouter);
router.use(publicContactRouter);
router.use(emailWebhooksRouter);

router.use(requireAuth);

router.use(websitesRouter);
router.use(keywordsRouter);
router.use(socialPostsRouter);
router.use(campaignsRouter);
router.use(backlinksRouter);
router.use(leadsRouter);
router.use(analyticsRouter);
router.use(aiRouter);
router.use(mediaAssetsRouter);
router.use(settingsRouter);
router.use(adminRouter);
router.use(usageRouter);
router.use(conversationsRouter);
router.use(sequencesRouter);

export default router;
