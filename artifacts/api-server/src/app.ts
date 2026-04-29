import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { eq, sql } from "drizzle-orm";
import { db, utmLinksTable } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      if (
        req.url?.startsWith("/api/webhooks/email/") ||
        req.url?.startsWith("/api/webhooks/stripe") ||
        req.url?.startsWith("/api/webhooks/razorpay")
      ) {
        (req as typeof req & { rawBody: Buffer }).rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// Public UTM redirect — at root /r/:id so the tracked URL is short and clean
app.get("/r/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).send("Invalid link ID");
    return;
  }
  let link;
  try {
    const [row] = await db.update(utmLinksTable)
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
    link = row;
  } catch {
    res.status(500).send("Internal error");
    return;
  }
  if (!link) {
    res.status(404).send("Link not found");
    return;
  }
  // Enforce http/https only (schema validates at creation; double-check at redirect time)
  if (!/^https?:\/\//i.test(link.destinationUrl)) {
    res.status(400).send("Invalid redirect target");
    return;
  }
  try {
    const url = new URL(link.destinationUrl);
    url.searchParams.set("utm_source", link.source);
    url.searchParams.set("utm_medium", link.medium);
    url.searchParams.set("utm_campaign", link.campaign);
    if (link.term) url.searchParams.set("utm_term", link.term);
    if (link.content) url.searchParams.set("utm_content", link.content);
    res.redirect(302, url.toString());
  } catch {
    res.status(500).send("Could not build redirect URL");
  }
});

app.use("/api", router);

export default app;
