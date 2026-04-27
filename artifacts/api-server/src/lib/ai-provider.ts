import { openai as replitOpenai } from "@workspace/integrations-openai-ai-server";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export type AiProvider = "replit" | "openai" | "anthropic" | "perplexity" | "gemini";

export const FAL_IMAGE_MODELS: Array<{ value: string; label: string }> = [
  { value: "fal-ai/flux/schnell", label: "FLUX Schnell (Fast)" },
  { value: "fal-ai/flux/dev", label: "FLUX Dev (Balanced)" },
  { value: "fal-ai/flux-pro", label: "FLUX Pro (Best quality)" },
  { value: "fal-ai/flux-realism", label: "FLUX Realism (Photorealistic)" },
  { value: "fal-ai/stable-diffusion-v35-large", label: "Stable Diffusion 3.5 Large" },
];

export const FAL_VIDEO_MODELS: Array<{ value: string; label: string }> = [
  { value: "fal-ai/kling-video/v2.1/standard/text-to-video", label: "Kling v2.1 Standard" },
  { value: "fal-ai/kling-video/v2.1/pro/text-to-video", label: "Kling v2.1 Pro" },
  { value: "fal-ai/kling-video/v1.6/standard/text-to-video", label: "Kling v1.6 Standard" },
  { value: "fal-ai/minimax/video-01", label: "MiniMax Video-01" },
  { value: "fal-ai/runway-gen4/turbo/text-to-video", label: "Runway Gen4" },
];

export interface AiConfig {
  provider: AiProvider;
  model: string;
  enabled: boolean;
  apiKeyConfigured: boolean;
}

export const PROVIDER_MODELS: Record<AiProvider, { models: string[]; defaultModel: string; label: string }> = {
  replit: {
    label: "Replit Default (Free)",
    models: ["gpt-4.1", "gpt-4.1-mini"],
    defaultModel: "gpt-4.1",
  },
  openai: {
    label: "OpenAI (ChatGPT)",
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o4-mini"],
    defaultModel: "gpt-4.1",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-opus-4-5", "claude-3-haiku-20240307"],
    defaultModel: "claude-3-5-sonnet-20241022",
  },
  perplexity: {
    label: "Perplexity AI",
    models: ["llama-3.1-sonar-large-128k-online", "llama-3.1-sonar-small-128k-online", "llama-3.1-sonar-huge-128k-online"],
    defaultModel: "llama-3.1-sonar-large-128k-online",
  },
  gemini: {
    label: "Google Gemini",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
    defaultModel: "gemini-1.5-pro",
  },
};

export async function getDbSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setDbSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
}

export async function deleteDbSetting(key: string): Promise<void> {
  await db.delete(appSettingsTable).where(eq(appSettingsTable.key, key));
}

export async function getAiConfig(): Promise<AiConfig> {
  const provider = ((await getDbSetting("ai_provider")) ?? "replit") as AiProvider;
  const storedModel = await getDbSetting("ai_model");
  const enabledVal = await getDbSetting("ai_enabled");
  const enabled = enabledVal !== "false";
  const defaultModel = PROVIDER_MODELS[provider]?.defaultModel ?? "gpt-4.1";
  const model = storedModel ?? defaultModel;
  const apiKeyConfigured = provider === "replit" || !!(process.env.AI_API_KEY);
  return { provider, model, enabled, apiKeyConfigured };
}

export interface CallAIOptions {
  systemPrompt?: string;
  maxTokens?: number;
  jsonMode?: boolean;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function callAI(userPrompt: string, options: CallAIOptions = {}): Promise<string> {
  const config = await getAiConfig();
  const { systemPrompt, maxTokens = 2048, jsonMode = false, history = [] } = options;

  if (!config.enabled) {
    throw new Error("AI features are disabled. Enable them in Settings.");
  }

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  for (const h of history) messages.push({ role: h.role, content: h.content });
  messages.push({ role: "user", content: userPrompt });

  switch (config.provider) {
    case "replit": {
      const response = await replitOpenai.chat.completions.create({
        model: config.model,
        max_completion_tokens: maxTokens,
        messages,
        ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      });
      return response.choices[0]?.message?.content ?? "";
    }

    case "openai": {
      const apiKey = process.env.AI_API_KEY;
      if (!apiKey) throw new Error("OpenAI API key not configured. Add it in Settings.");
      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model: config.model,
        max_completion_tokens: maxTokens,
        messages,
        ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      });
      return response.choices[0]?.message?.content ?? "";
    }

    case "perplexity": {
      const apiKey = process.env.AI_API_KEY;
      if (!apiKey) throw new Error("Perplexity API key not configured. Add it in Settings.");
      const client = new OpenAI({ apiKey, baseURL: "https://api.perplexity.ai" });
      const response = await client.chat.completions.create({
        model: config.model,
        max_tokens: maxTokens,
        messages,
      });
      return response.choices[0]?.message?.content ?? "";
    }

    case "anthropic": {
      const apiKey = process.env.AI_API_KEY;
      if (!apiKey) throw new Error("Anthropic API key not configured. Add it in Settings.");
      const body: Record<string, unknown> = {
        model: config.model,
        max_tokens: maxTokens,
        messages: messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content })),
      };
      if (systemPrompt) body.system = systemPrompt;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${err}`);
      }
      const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
      return data.content.find(c => c.type === "text")?.text ?? "";
    }

    case "gemini": {
      const apiKey = process.env.AI_API_KEY;
      if (!apiKey) throw new Error("Google Gemini API key not configured. Add it in Settings.");
      const allText = messages.map(m => m.content).join("\n\n");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: allText }] }],
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        }
      );
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${err}`);
      }
      const data = (await response.json()) as {
        candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
      };
      return data.candidates[0]?.content?.parts[0]?.text ?? "";
    }

    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}
