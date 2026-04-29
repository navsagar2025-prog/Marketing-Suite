import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, utmLinksTable } from "@workspace/db";
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
import conversationsRouter from "./conversations";
import sequencesRouter from "./sequences";
import leadFormsRouter from "./lead-forms";
import blogRouter from "./blog";
import kbRouter from "./kb";
import utmLinksRouter from "./utm-links";
import { requireAuth, requirePermission, requireAnyPermission } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);

router.use(authRouter);

router.use(publicAuditRouter);
router.use(publicContactRouter);
router.use(publicFormsRouter);
router.use(emailWebhooksRouter);

// Public UTM redirect: GET /r/:id — increments click count and redirects
router.get("/r/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).send("Invalid link"); return; }
  const [link] = await db.update(utmLinksTable)
    .set({ clicks: sql`${utmLinksTable.clicks} + 1` })
    .where(eq(utmLinksTable.id, id))
    .returning({
      destinationUrl: utmLinksTable.destinationUrl,
      source: utmLinksTable.source,
      medium: utmLinksTable.medium,
      campaign: utmLinksTable.campaign,
      term: utmLinksTable.term,
      content: utmLinksTable.content,
    });
  if (!link) { res.status(404).send("Link not found"); return; }
  const url = new URL(link.destinationUrl);
  url.searchParams.set("utm_source", link.source);
  url.searchParams.set("utm_medium", link.medium);
  url.searchParams.set("utm_campaign", link.campaign);
  if (link.term) url.searchParams.set("utm_term", link.term);
  if (link.content) url.searchParams.set("utm_content", link.content);
  res.redirect(302, url.toString());
});

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
router.use(adminRouter);

export default router;
