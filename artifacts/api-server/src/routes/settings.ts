import { Router, type IRouter } from "express";

const router: IRouter = Router();

export function getSetting(key: string): string | null {
  if (key === "fal_api_key") {
    return process.env.FAL_KEY ?? process.env.FAL_AI_API_KEY ?? null;
  }
  return null;
}

router.get("/settings", (_req, res): void => {
  const configured = !!(process.env.FAL_KEY ?? process.env.FAL_AI_API_KEY);
  res.json({ falApiKeyConfigured: configured });
});

router.patch("/settings", (req, res): void => {
  const { falApiKey } = req.body ?? {};

  if (falApiKey !== undefined) {
    if (falApiKey === null || falApiKey === "") {
      delete process.env.FAL_KEY;
    } else if (typeof falApiKey === "string" && falApiKey.trim()) {
      process.env.FAL_KEY = falApiKey.trim();
    }
  }

  const configured = !!(process.env.FAL_KEY ?? process.env.FAL_AI_API_KEY);
  res.json({ falApiKeyConfigured: configured });
});

export default router;
