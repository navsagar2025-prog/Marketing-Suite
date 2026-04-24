import app from "./app";
import { logger } from "./lib/logger";
import { db, staffUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

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

seedAdminUser()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to seed admin user");
    process.exit(1);
  });
