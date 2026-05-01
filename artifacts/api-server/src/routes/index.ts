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
import publicFormsRouter from "./public-forms";
import usageRouter from "./usage";
import emailWebhooksRouter from "./email-webhooks";
import paymentWebhooksRouter from "./payment-webhooks";
import conversationsRouter from "./conversations";
import sequencesRouter from "./sequences";
import leadFormsRouter from "./lead-forms";
import blogRouter from "./blog";
import kbRouter from "./kb";
import utmLinksRouter from "./utm-links";
import abTestsRouter from "./ab-tests";
import clientReportsRouter from "./client-reports";
import outreachRouter from "./outreach";
import billingRouter from "./billing";
import competitorsRouter from "./competitors";
import { requireAuth, requirePermission, requireAnyPermission } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);

router.use(authRouter);

router.use(publicAuditRouter);
router.use(publicContactRouter);
router.use(publicFormsRouter);
router.use(emailWebhooksRouter);
router.use(paymentWebhooksRouter);

router.use(requireAuth);

// Per-module permission guards (admins always pass; staff with null perms = full access)
router.use("/websites", requirePermission("websites"));
router.use("/keywords", requirePermission("keywords"));
router.use("/social-posts", requireAnyPermission("social", "calendar"));
router.use("/campaigns", requirePermission("campaigns"));
router.use("/sequences", requirePermission("campaigns"));
router.use("/backlinks", requirePermission("backlinks"));
router.use("/leads", requirePermission("leads"));
router.use("/lead-forms", requirePermission("leads"));
router.use("/conversations", requirePermission("conversations"));
router.use("/analytics", requirePermission("analytics"));
router.use("/ai", requirePermission("ai_tools"));
router.use("/media-assets", requirePermission("media"));
router.use("/utm-links", requirePermission("campaigns"));
router.use("/ab-tests", requirePermission("analytics"));
router.use("/reports", requirePermission("analytics"));
router.use("/outreach", requirePermission("backlinks"));
router.use("/competitors", requirePermission("keywords"));

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
router.use(usageRouter);
router.use(conversationsRouter);
router.use(sequencesRouter);
router.use(leadFormsRouter);
router.use("/blog", blogRouter);
router.use("/kb", kbRouter);
router.use(utmLinksRouter);
router.use(abTestsRouter);
router.use(clientReportsRouter);
router.use(outreachRouter);
router.use(billingRouter);
router.use(competitorsRouter);
router.use(adminRouter);

export default router;
