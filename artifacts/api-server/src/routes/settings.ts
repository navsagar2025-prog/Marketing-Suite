import { Router, type IRouter } from "express";
import { getAiConfig, setDbSetting, callAI, getDbSetting, PROVIDER_MODELS, FAL_IMAGE_MODELS, FAL_VIDEO_MODELS, type AiProvider } from "../lib/ai-provider.js";
import { getEmailProviderConfig, testEmailConnection, setSecretSetting, type EmailProvider } from "../lib/email-sender.js";
import { getPaymentSettings, savePaymentSettings, testPaymentConnection } from "../lib/payment.js";
import { requireAdmin } from "../lib/auth.js";
import { getOnboardingSteps } from "./admin.js";

const router: IRouter = Router();

export function getSetting(key: string): string | null {
  if (key === "fal_api_key") {
    return process.env.FAL_KEY ?? process.env.FAL_AI_API_KEY ?? null;
  }
  return null;
}

function dismissedTipsKey(userId: number): string {
  return `ui_dismissed_tips_user_${userId}`;
}

async function getDismissedTips(userId: number): Promise<string[]> {
  const raw = await getDbSetting(dismissedTipsKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setDismissedTips(userId: number, tips: string[]): Promise<void> {
  await setDbSetting(dismissedTipsKey(userId), JSON.stringify(tips));
}

router.get("/settings", async (req, res): Promise<void> => {
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
  const dismissedTips = req.user ? await getDismissedTips(req.user.id) : [];
  res.json({
    falApiKeyConfigured: falConfigured,
    falImageModel,
    falVideoModel,
    aiProvider: aiConfig.provider,
    aiModel: aiConfig.model,
    aiEnabled: aiConfig.enabled,
    aiApiKeyConfigured: aiConfig.apiKeyConfigured,
    dismissedTips,
  });
});

router.patch("/settings", async (req, res): Promise<void> => {
  const { falApiKey, falImageModel, falVideoModel, aiProvider, aiModel, aiEnabled, aiApiKey, dismissedTips } = req.body ?? {};

  if (falApiKey !== undefined) {
    if (falApiKey === null || falApiKey === "") {
      delete process.env.FAL_KEY;
    } else if (typeof falApiKey === "string" && falApiKey.trim()) {
      process.env.FAL_KEY = falApiKey.trim();
    }
  }

  if (falImageModel !== undefined) {
    if (typeof falImageModel !== "string" || !FAL_IMAGE_MODELS.some(m => m.value === falImageModel)) {
      res.status(400).json({ error: `Invalid falImageModel. Valid values: ${FAL_IMAGE_MODELS.map(m => m.value).join(", ")}` });
      return;
    }
    await setDbSetting("fal_image_model", falImageModel);
  }

  if (falVideoModel !== undefined) {
    if (typeof falVideoModel !== "string" || !FAL_VIDEO_MODELS.some(m => m.value === falVideoModel)) {
      res.status(400).json({ error: `Invalid falVideoModel. Valid values: ${FAL_VIDEO_MODELS.map(m => m.value).join(", ")}` });
      return;
    }
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

  if (req.user && Array.isArray(dismissedTips) && dismissedTips.every((t: unknown) => typeof t === "string")) {
    const existing = await getDismissedTips(req.user.id);
    const merged = Array.from(new Set([...existing, ...dismissedTips]));
    await setDismissedTips(req.user.id, merged);
  }

  const falConfigured = !!(process.env.FAL_KEY ?? process.env.FAL_AI_API_KEY);
  const aiConfig = await getAiConfig();
  const savedImageModel = await getDbSetting("fal_image_model");
  const savedVideoModel = await getDbSetting("fal_video_model");
  const resolvedImageModel = (savedImageModel && FAL_IMAGE_MODELS.some(m => m.value === savedImageModel))
    ? savedImageModel : FAL_IMAGE_MODELS[0].value;
  const resolvedVideoModel = (savedVideoModel && FAL_VIDEO_MODELS.some(m => m.value === savedVideoModel))
    ? savedVideoModel : FAL_VIDEO_MODELS[0].value;
  const resolvedDismissedTips = req.user ? await getDismissedTips(req.user.id) : [];
  res.json({
    falApiKeyConfigured: falConfigured,
    falImageModel: resolvedImageModel,
    falVideoModel: resolvedVideoModel,
    aiProvider: aiConfig.provider,
    aiModel: aiConfig.model,
    aiEnabled: aiConfig.enabled,
    aiApiKeyConfigured: aiConfig.apiKeyConfigured,
    dismissedTips: resolvedDismissedTips,
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

const VALID_EMAIL_PROVIDERS: EmailProvider[] = ["smtp", "sendgrid", "mailgun", "resend", "mailchimp"];

router.get("/settings/email-provider", async (_req, res): Promise<void> => {
  const provider = (await getDbSetting("email_provider")) as EmailProvider | null;
  const fromAddress = await getDbSetting("email_from_address") ?? "";
  const fromName = await getDbSetting("email_from_name") ?? "";
  const smtpHost = await getDbSetting("email_smtp_host") ?? "";
  const smtpPort = await getDbSetting("email_smtp_port") ?? "587";
  const smtpUser = await getDbSetting("email_smtp_user") ?? "";
  const apiKeyConfigured = !!(await getDbSetting("email_api_key"));
  const smtpPassConfigured = !!(await getDbSetting("email_smtp_pass"));
  const audienceId = await getDbSetting("email_mailchimp_audience_id") ?? "";
  const mailchimpSendMode = (await getDbSetting("email_mailchimp_send_mode") ?? "direct") as "direct" | "sync_and_send" | "sync_only";
  res.json({ provider, fromAddress, fromName, smtpHost, smtpPort: parseInt(smtpPort, 10), smtpUser, apiKeyConfigured, smtpPassConfigured, audienceId, mailchimpSendMode });
});

router.patch("/settings/email-provider", async (req, res): Promise<void> => {
  const { provider, apiKey, fromAddress, fromName, smtpHost, smtpPort, smtpUser, smtpPass, audienceId, mailchimpSendMode } = req.body ?? {};

  if (provider !== undefined) {
    if (!VALID_EMAIL_PROVIDERS.includes(provider)) {
      res.status(400).json({ error: `Invalid provider. Valid: ${VALID_EMAIL_PROVIDERS.join(", ")}` });
      return;
    }
    await setDbSetting("email_provider", provider);
  }
  if (fromAddress !== undefined && typeof fromAddress === "string") await setDbSetting("email_from_address", fromAddress);
  if (fromName !== undefined && typeof fromName === "string") await setDbSetting("email_from_name", fromName);
  if (apiKey !== undefined && typeof apiKey === "string" && apiKey.trim()) await setSecretSetting("email_api_key", apiKey.trim());
  if (smtpHost !== undefined && typeof smtpHost === "string") await setDbSetting("email_smtp_host", smtpHost);
  if (smtpPort !== undefined) await setDbSetting("email_smtp_port", String(smtpPort));
  if (smtpUser !== undefined && typeof smtpUser === "string") await setDbSetting("email_smtp_user", smtpUser);
  if (smtpPass !== undefined && typeof smtpPass === "string" && smtpPass.trim()) await setSecretSetting("email_smtp_pass", smtpPass.trim());
  if (audienceId !== undefined && typeof audienceId === "string") await setDbSetting("email_mailchimp_audience_id", audienceId.trim());
  const validModes = ["direct", "sync_and_send", "sync_only"];
  if (mailchimpSendMode !== undefined && typeof mailchimpSendMode === "string" && validModes.includes(mailchimpSendMode)) {
    await setDbSetting("email_mailchimp_send_mode", mailchimpSendMode);
  }

  const savedProvider = (await getDbSetting("email_provider")) as EmailProvider | null;
  const savedFromAddress = await getDbSetting("email_from_address") ?? "";
  const savedFromName = await getDbSetting("email_from_name") ?? "";
  const savedSmtpHost = await getDbSetting("email_smtp_host") ?? "";
  const savedSmtpPort = await getDbSetting("email_smtp_port") ?? "587";
  const savedSmtpUser = await getDbSetting("email_smtp_user") ?? "";
  const apiKeyConfigured = !!(await getDbSetting("email_api_key"));
  const smtpPassConfigured = !!(await getDbSetting("email_smtp_pass"));
  const savedAudienceId = await getDbSetting("email_mailchimp_audience_id") ?? "";
  const savedMailchimpSendMode = (await getDbSetting("email_mailchimp_send_mode") ?? "direct") as "direct" | "sync_and_send" | "sync_only";
  res.json({ provider: savedProvider, fromAddress: savedFromAddress, fromName: savedFromName, smtpHost: savedSmtpHost, smtpPort: parseInt(savedSmtpPort, 10), smtpUser: savedSmtpUser, apiKeyConfigured, smtpPassConfigured, audienceId: savedAudienceId, mailchimpSendMode: savedMailchimpSendMode });
});

router.post("/settings/test-email", async (req, res): Promise<void> => {
  const { testTo } = req.body ?? {};
  if (!testTo || typeof testTo !== "string") {
    res.status(400).json({ error: "testTo email address is required" });
    return;
  }
  const config = await getEmailProviderConfig();
  if (!config) {
    res.json({ success: false, message: "No email provider configured. Please set up an email provider first." });
    return;
  }
  try {
    await testEmailConnection(config, testTo);
    res.json({ success: true, message: `Test email sent to ${testTo} via ${config.provider}.` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    res.json({ success: false, message });
  }
});

router.get("/settings/payment", requireAdmin, async (_req, res): Promise<void> => {
  const settings = await getPaymentSettings();
  res.json(settings);
});

router.post("/settings/payment", requireAdmin, async (req, res): Promise<void> => {
  const body = req.body ?? {};
  try {
    const settings = await savePaymentSettings(body);
    res.json(settings);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save payment settings";
    res.status(400).json({ error: message });
  }
});

router.post("/settings/payment/test", requireAdmin, async (_req, res): Promise<void> => {
  const result = await testPaymentConnection();
  res.json(result);
});

router.get("/settings/onboarding-steps", async (_req, res): Promise<void> => {
  const steps = await getOnboardingSteps();
  res.json(steps);
});

router.get("/settings/notifications", requireAdmin, async (_req, res): Promise<void> => {
  const rankAlertsEnabled = await getDbSetting("rank_alerts_email_enabled");
  const rankAlertsEmailTo = await getDbSetting("rank_alerts_email_to");
  res.json({
    rankAlertsEnabled: rankAlertsEnabled === "true",
    rankAlertsEmailTo: rankAlertsEmailTo ?? "",
  });
});

router.patch("/settings/notifications", requireAdmin, async (req, res): Promise<void> => {
  const { rankAlertsEnabled, rankAlertsEmailTo } = req.body ?? {};
  if (typeof rankAlertsEnabled === "boolean") {
    await setDbSetting("rank_alerts_email_enabled", rankAlertsEnabled ? "true" : "false");
  }
  if (typeof rankAlertsEmailTo === "string") {
    await setDbSetting("rank_alerts_email_to", rankAlertsEmailTo.trim());
  }
  const enabled = await getDbSetting("rank_alerts_email_enabled");
  const emailTo = await getDbSetting("rank_alerts_email_to");
  res.json({
    rankAlertsEnabled: enabled === "true",
    rankAlertsEmailTo: emailTo ?? "",
  });
});

export default router;
