import { db, aiUsageTable, staffUsersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export type AiUsageType = "text" | "image" | "video";

export const AI_USAGE_TYPES: AiUsageType[] = ["text", "image", "video"];

const DEFAULT_LIMITS: Record<AiUsageType, number> = {
  text: 500,
  image: 50,
  video: 10,
};

const LIMIT_KEYS: Record<AiUsageType, string> = {
  text: "ai_usage_limit_text",
  image: "ai_usage_limit_image",
  video: "ai_usage_limit_video",
};

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

import { appSettingsTable } from "@workspace/db";

async function getLimit(type: AiUsageType): Promise<number> {
  const key = LIMIT_KEYS[type];
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  if (row?.value) {
    const n = parseInt(row.value, 10);
    if (!isNaN(n) && n >= 0) return n;
  }
  return DEFAULT_LIMITS[type];
}

export async function getAllLimits(): Promise<Record<AiUsageType, number>> {
  const results = await db.select().from(appSettingsTable).where(
    sql`${appSettingsTable.key} IN (${sql.join(Object.values(LIMIT_KEYS).map(k => sql`${k}`), sql`, `)})`
  );
  const map: Record<string, number> = {};
  for (const row of results) {
    const n = parseInt(row.value ?? "", 10);
    if (!isNaN(n) && n >= 0) map[row.key] = n;
  }
  return {
    text: map[LIMIT_KEYS.text] ?? DEFAULT_LIMITS.text,
    image: map[LIMIT_KEYS.image] ?? DEFAULT_LIMITS.image,
    video: map[LIMIT_KEYS.video] ?? DEFAULT_LIMITS.video,
  };
}

export async function setLimit(type: AiUsageType, limit: number): Promise<void> {
  const key = LIMIT_KEYS[type];
  await db.insert(appSettingsTable)
    .values({ key, value: String(limit) })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(limit), updatedAt: new Date() } });
}

export async function getUsage(userId: number, type: AiUsageType, yearMonth?: string): Promise<number> {
  const month = yearMonth ?? currentYearMonth();
  const [row] = await db.select()
    .from(aiUsageTable)
    .where(and(
      eq(aiUsageTable.userId, userId),
      eq(aiUsageTable.type, type),
      eq(aiUsageTable.yearMonth, month),
    ));
  return row?.count ?? 0;
}

export async function getUserUsageSummary(userId: number): Promise<{ type: AiUsageType; used: number; limit: number; yearMonth: string }[]> {
  const month = currentYearMonth();
  const limits = await getAllLimits();
  const rows = await db.select()
    .from(aiUsageTable)
    .where(and(eq(aiUsageTable.userId, userId), eq(aiUsageTable.yearMonth, month)));
  const countMap: Record<string, number> = {};
  for (const r of rows) countMap[r.type] = r.count;
  return AI_USAGE_TYPES.map(type => ({
    type,
    used: countMap[type] ?? 0,
    limit: limits[type],
    yearMonth: month,
  }));
}

export async function getAllUsageSummary(): Promise<{
  userId: number;
  username: string;
  role: string;
  usage: { type: AiUsageType; used: number; limit: number }[];
}[]> {
  const month = currentYearMonth();
  const limits = await getAllLimits();
  const users = await db.select({
    id: staffUsersTable.id,
    username: staffUsersTable.username,
    role: staffUsersTable.role,
  }).from(staffUsersTable);

  const usageRows = await db.select()
    .from(aiUsageTable)
    .where(eq(aiUsageTable.yearMonth, month));

  const usageMap: Record<string, number> = {};
  for (const r of usageRows) usageMap[`${r.userId}:${r.type}`] = r.count;

  return users.map(user => ({
    userId: user.id,
    username: user.username,
    role: user.role,
    usage: AI_USAGE_TYPES.map(type => ({
      type,
      used: usageMap[`${user.id}:${type}`] ?? 0,
      limit: limits[type],
    })),
  }));
}

export async function checkAndIncrementUsage(userId: number, type: AiUsageType): Promise<{ allowed: boolean; used: number; limit: number }> {
  const month = currentYearMonth();
  const limit = await getLimit(type);
  const used = await getUsage(userId, type, month);

  if (used >= limit) {
    return { allowed: false, used, limit };
  }

  await db.insert(aiUsageTable)
    .values({ userId, type, yearMonth: month, count: 1, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [aiUsageTable.userId, aiUsageTable.type, aiUsageTable.yearMonth],
      set: {
        count: sql`${aiUsageTable.count} + 1`,
        updatedAt: new Date(),
      },
    });

  return { allowed: true, used: used + 1, limit };
}

export async function resetUsage(userId: number, type: AiUsageType, yearMonth?: string): Promise<void> {
  const month = yearMonth ?? currentYearMonth();
  await db.delete(aiUsageTable).where(and(
    eq(aiUsageTable.userId, userId),
    eq(aiUsageTable.type, type),
    eq(aiUsageTable.yearMonth, month),
  ));
}
