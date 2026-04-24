import { Router, type IRouter } from "express";
import { getAiConfig, setDbSetting, callAI, getDbSetting, PROVIDER_MODELS, FAL_IMAGE_MODELS, FAL_VIDEO_MODELS, type AiProvider } from "../lib/ai-provider.js";

const router: IRouter = Router();

export function getSetting(key: string): string | null {
  if (key === "fal_api_key") {
    return process.env.FAL_KEY ?? process.env.FAL_AI_API_KEY ?? null;
  }
  return null;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const falConfigured = !!(process.env.FAL_KEY ?? process.env.FAL_AI_API_KEY);
  const aiConfig = await getAiConfig();
  const savedImageModel = await getDbSetting("fal_image_model");
  const savedVideoModel = await getDbSetting("fal_video_model");
  const falImageModel = (savedImageModel && FAL_IMAGE_MODELS.some(m => m.value === savedImageModel))
    ? savedImageModel
    : FAL_IMAGE_MODELS[0].value;
  const falVideoModel = (savedVideoModel && FAL_VIDEO_MODELS.some(m => m.value === savedVideoModel))
    ? savedVideoModel
    : FAL_VIDEO_MODELS[0].value;
  res.json({
    falApiKeyConfigured: falConfigured,
    falImageModel,
    falVideoModel,
    aiProvider: aiConfig.provider,
    aiModel: aiConfig.model,
    aiEnabled: aiConfig.enabled,
    aiApiKeyConfigured: aiConfig.apiKeyConfigured,
  });
});

router.patch("/settings", async (req, res): Promise<void> => {
  const { falApiKey, falImageModel, falVideoModel, aiProvider, aiModel, aiEnabled, aiApiKey } = req.body ?? {};

  if (falApiKey !== undefined) {
    if (falApiKey === null || falApiKey === "") {
      delete process.env.FAL_KEY;
    } else if (typeof falApiKey === "string" && falApiKey.trim()) {
      process.env.FAL_KEY = falApiKey.trim();
    }
  }

  if (typeof falImageModel === "string" && FAL_IMAGE_MODELS.some(m => m.value === falImageModel)) {
    await setDbSetting("fal_image_model", falImageModel);
  }

  if (typeof falVideoModel === "string" && FAL_VIDEO_MODELS.some(m => m.value === falVideoModel)) {
    await setDbSetting("fal_video_model", falVideoModel);
  }

  if (aiProvider !== undefined && typeof aiProvider === "string") {
    const validProviders = Object.keys(PROVIDER_MODELS) as AiProvider[];
    if (validProviders.includes(aiProvider as AiProvider)) {
      await setDbSetting("ai_provider", aiProvider);
      const providerInfo = PROVIDER_MODELS[aiProvider as AiProvider];
      if (aiModel === undefined && providerInfo) {
        await setDbSetting("ai_model", providerInfo.defaultModel);
      }
    }
  }

  if (aiModel !== undefined && typeof aiModel === "string") {
    const currentProviderStr = typeof aiProvider === "string" && (Object.keys(PROVIDER_MODELS) as AiProvider[]).includes(aiProvider as AiProvider)
      ? (aiProvider as AiProvider)
      : (await getAiConfig()).provider;
    const providerModels = PROVIDER_MODELS[currentProviderStr]?.models ?? [];
    if (providerModels.includes(aiModel)) {
      await setDbSetting("ai_model", aiModel);
    }
  }

  if (aiEnabled !== undefined) {
    await setDbSetting("ai_enabled", aiEnabled ? "true" : "false");
  }

  if (aiApiKey !== undefined) {
    if (aiApiKey === null || aiApiKey === "") {
      delete process.env.AI_API_KEY;
    } else if (typeof aiApiKey === "string" && aiApiKey.trim()) {
      process.env.AI_API_KEY = aiApiKey.trim();
    }
  }

  const falConfigured = !!(process.env.FAL_KEY ?? process.env.FAL_AI_API_KEY);
  const aiConfig = await getAiConfig();
  const savedImageModel = await getDbSetting("fal_image_model");
  const savedVideoModel = await getDbSetting("fal_video_model");
  const resolvedImageModel = (savedImageModel && FAL_IMAGE_MODELS.some(m => m.value === savedImageModel))
    ? savedImageModel : FAL_IMAGE_MODELS[0].value;
  const resolvedVideoModel = (savedVideoModel && FAL_VIDEO_MODELS.some(m => m.value === savedVideoModel))
    ? savedVideoModel : FAL_VIDEO_MODELS[0].value;
  res.json({
    falApiKeyConfigured: falConfigured,
    falImageModel: resolvedImageModel,
    falVideoModel: resolvedVideoModel,
    aiProvider: aiConfig.provider,
    aiModel: aiConfig.model,
    aiEnabled: aiConfig.enabled,
    aiApiKeyConfigured: aiConfig.apiKeyConfigured,
  });
});

router.post("/settings/test-ai", async (_req, res): Promise<void> => {
  const aiConfig = await getAiConfig();

  if (!aiConfig.enabled) {
    res.json({ success: false, message: "AI is disabled in settings.", provider: aiConfig.provider, model: aiConfig.model });
    return;
  }

  try {
    const result = await callAI("Say 'AI connection successful' and nothing else.", { maxTokens: 32 });
    const trimmed = result.trim().slice(0, 200);
    res.json({ success: true, message: trimmed || "Connected successfully.", provider: aiConfig.provider, model: aiConfig.model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection test failed";
    res.json({ success: false, message, provider: aiConfig.provider, model: aiConfig.model });
  }
});

export default router;
