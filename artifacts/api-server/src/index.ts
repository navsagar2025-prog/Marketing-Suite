import app from "./app";
import { logger } from "./lib/logger";
import { db, staffUsersTable, leadsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import cron from "node-cron";
import { runRankSnapshot } from "./routes/keywords";
import { runSequenceEngine } from "./routes/sequences";
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

seedAdminUser()
  .then(() => backfillLeadScores())
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

    cron.schedule("0 1 * * *", () => {
      logger.info("Running daily sequence engine");
      runSequenceEngine()
        .then((result) => logger.info(result, "Daily sequence engine complete"))
        .catch((err) => logger.error({ err }, "Daily sequence engine failed"));
    }, { timezone: "UTC" });
    logger.info("Daily sequence engine cron scheduled (01:00 UTC)");
  })
  .catch((err) => {
    logger.error({ err }, "Failed to seed admin user");
    process.exit(1);
  });
