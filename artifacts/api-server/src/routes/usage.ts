import { Router, type IRouter } from "express";
import { requireAdmin } from "../lib/auth.js";
import {
  getUserUsageSummary,
  getAllUsageSummary,
  setLimit,
  getAllLimits,
  resetUsage,
  AI_USAGE_TYPES,
  type AiUsageType,
} from "../lib/ai-usage.js";

const router: IRouter = Router();

router.get("/usage/me", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const summary = await getUserUsageSummary(userId);
  res.json({ userId, summary });
});

router.get("/admin/usage", requireAdmin, async (_req, res): Promise<void> => {
  const [all, limits] = await Promise.all([getAllUsageSummary(), getAllLimits()]);
  res.json({ users: all, limits });
});

router.patch("/admin/usage/limits", requireAdmin, async (req, res): Promise<void> => {
  const { text, image, video } = req.body as { text?: unknown; image?: unknown; video?: unknown };
  const errors: string[] = [];

  for (const [key, val] of [["text", text], ["image", image], ["video", video]] as [AiUsageType, unknown][]) {
    if (val === undefined) continue;
    const n = Number(val);
    if (!Number.isInteger(n) || n < 0) {
      errors.push(`${key} must be a non-negative integer`);
    } else {
      await setLimit(key, n);
    }
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join("; ") });
    return;
  }

  const limits = await getAllLimits();
  res.json({ limits });
});

router.post("/admin/usage/reset", requireAdmin, async (req, res): Promise<void> => {
  const { userId, type } = req.body as { userId?: unknown; type?: unknown };

  const userIdNum = Number(userId);
  if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    res.status(400).json({ error: "userId must be a positive integer" });
    return;
  }

  if (typeof type !== "string" || !AI_USAGE_TYPES.includes(type as AiUsageType)) {
    res.status(400).json({ error: `type must be one of: ${AI_USAGE_TYPES.join(", ")}` });
    return;
  }

  await resetUsage(userIdNum, type as AiUsageType);
  const summary = await getUserUsageSummary(userIdNum);
  res.json({ userId: userIdNum, type, summary });
});

export default router;
