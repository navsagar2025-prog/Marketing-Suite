import app from "./app";
import { logger } from "./lib/logger";
import { db, staffUsersTable, leadsTable, leadNotesTable } from "@workspace/db";
import { and, eq, isNull, isNotNull, ne, notExists, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import cron from "node-cron";
import { runRankSnapshot } from "./routes/keywords";
import { runSequenceEngine } from "./routes/sequences";
import { sendRankAlertDigest } from "./lib/rank-alert-email.js";
import { runDailyPagespeedScan } from "./lib/pagespeed.js";
import { calculateLeadScore, DEFAULT_SCORING_WEIGHTS, mergeWeights } from "./lib/lead-scoring";
import { getDbSetting } from "./lib/ai-provider";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdminUser(): Promise<void> {
  const [existing] = await db
    .select({ id: staffUsersTable.id })
    .from(staffUsersTable)
    .where(eq(staffUsersTable.role, "admin"));

  if (existing) return;

  const adminPassword = process.env.ADMIN_PASSWORD ?? crypto.randomBytes(12).toString("hex");
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await db.insert(staffUsersTable).values({
    username: "admin",
    passwordHash,
    role: "admin",
  });

  if (!process.env.ADMIN_PASSWORD) {
    logger.info({ adminPassword }, "Created default admin account — save this password!");
  } else {
    logger.info("Created default admin account using ADMIN_PASSWORD env variable.");
  }
}

async function backfillLeadScores(): Promise<void> {
  const rawConfig = await getDbSetting("lead_scoring_config");
  const weights = rawConfig ? mergeWeights(DEFAULT_SCORING_WEIGHTS, JSON.parse(rawConfig)) : DEFAULT_SCORING_WEIGHTS;
  const unscoredLeads = await db.select().from(leadsTable).where(isNull(leadsTable.score));
  if (unscoredLeads.length === 0) return;
  for (const lead of unscoredLeads) {
    const { score, breakdown } = calculateLeadScore(
      { source: lead.source, status: lead.status, value: lead.value, createdAt: lead.createdAt },
      weights
    );
    await db.update(leadsTable).set({ score, scoreBreakdown: breakdown }).where(eq(leadsTable.id, lead.id));
  }
  logger.info({ count: unscoredLeads.length }, "Backfilled lead scores for unscored leads");
}

/**
 * Idempotent migration: for every lead with a legacy non-empty `notes` value that
 * has no existing entry in `lead_notes`, create one initial note attributed to the
 * admin user. Safe to run on every startup — skips leads that already have notes.
 */
async function backfillLeadNotes(): Promise<void> {
  const [adminUser] = await db
    .select({ id: staffUsersTable.id, username: staffUsersTable.username })
    .from(staffUsersTable)
    .where(eq(staffUsersTable.role, "admin"));

  const leadsWithLegacyNotes = await db
    .select({ id: leadsTable.id, notes: leadsTable.notes, createdAt: leadsTable.createdAt })
    .from(leadsTable)
    .where(
      and(
        isNotNull(leadsTable.notes),
        ne(leadsTable.notes, ""),
        notExists(
          db
            .select({ x: sql`1` })
            .from(leadNotesTable)
            .where(eq(leadNotesTable.leadId, leadsTable.id))
        )
      )
    );

  if (leadsWithLegacyNotes.length === 0) return;

  await db.insert(leadNotesTable).values(
    leadsWithLegacyNotes.map(l => ({
      leadId: l.id,
      staffUserId: adminUser?.id ?? null,
      authorName: adminUser?.username ?? "admin",
      body: l.notes!,
      pinned: false,
      createdAt: l.createdAt,
    }))
  );

  logger.info({ count: leadsWithLegacyNotes.length }, "Backfilled legacy lead notes into lead_notes table");
}

seedAdminUser()
  .then(() => backfillLeadScores())
  .then(() => backfillLeadNotes())
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });

    cron.schedule("0 0 * * *", () => {
      logger.info("Running daily keyword rank snapshot");
      runRankSnapshot()
        .then((result) => logger.info(result, "Daily keyword rank snapshot complete"))
        .catch((err) => logger.error({ err }, "Daily keyword rank snapshot failed"));
    }, { timezone: "UTC" });
    logger.info("Daily keyword rank snapshot cron scheduled (00:00 UTC)");

    cron.schedule("0 2 * * *", () => {
      logger.info("Running daily rank alert email digest");
      sendRankAlertDigest()
        .then((result) => logger.info(result, "Rank alert email digest complete"))
        .catch((err) => logger.error({ err }, "Rank alert email digest failed"));
    }, { timezone: "UTC" });
    logger.info("Daily rank alert email digest cron scheduled (02:00 UTC)");

    cron.schedule("0 1 * * *", () => {
      logger.info("Running daily sequence engine");
      runSequenceEngine()
        .then((result) => logger.info(result, "Daily sequence engine complete"))
        .catch((err) => logger.error({ err }, "Daily sequence engine failed"));
    }, { timezone: "UTC" });
    logger.info("Daily sequence engine cron scheduled (01:00 UTC)");

    cron.schedule("0 3 * * *", () => {
      logger.info("Running daily PageSpeed scan");
      runDailyPagespeedScan()
        .then((result) => logger.info(result, "Daily PageSpeed scan complete"))
        .catch((err) => logger.error({ err }, "Daily PageSpeed scan failed"));
    }, { timezone: "UTC" });
    logger.info("Daily PageSpeed scan cron scheduled (03:00 UTC)");
  })
  .catch((err) => {
    logger.error({ err }, "Failed to seed admin user");
    process.exit(1);
  });
