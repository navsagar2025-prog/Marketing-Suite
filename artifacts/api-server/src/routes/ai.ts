import { Router, type IRouter } from "express";
import {
  SuggestKeywordsBody,
  SuggestKeywordsResponse,
  GenerateSocialPostBody,
  GenerateSocialPostResponse,
  GenerateMetaTagsBody,
  GenerateMetaTagsResponse,
  GenerateCampaignCopyBody,
  GenerateCampaignCopyResponse,
  GenerateSeoBriefBody,
  GenerateSeoBriefResponse,
  GenerateAiImageBody,
  GenerateAiVideoBody,
  ClusterKeywordsBody,
  ClusterKeywordsResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { mediaAssetsTable } from "@workspace/db/schema";
import { getSetting } from "./settings.js";
import { callAI, getDbSetting, FAL_IMAGE_MODELS, FAL_VIDEO_MODELS } from "../lib/ai-provider.js";
import { checkAndIncrementUsage } from "../lib/ai-usage.js";

const router: IRouter = Router();

const DEFAULT_FAL_IMAGE_MODEL = FAL_IMAGE_MODELS[0].value;
const DEFAULT_FAL_VIDEO_MODEL = FAL_VIDEO_MODELS[0].value;

async function getFalImageModel(): Promise<string> {
  const saved = await getDbSetting("fal_image_model");
  if (saved && FAL_IMAGE_MODELS.some(m => m.value === saved)) return saved;
  return DEFAULT_FAL_IMAGE_MODEL;
}

async function getFalVideoModel(): Promise<string> {
  const saved = await getDbSetting("fal_video_model");
  if (saved && FAL_VIDEO_MODELS.some(m => m.value === saved)) return saved;
  return DEFAULT_FAL_VIDEO_MODEL;
}

function toFalImageSize(aspectRatio?: string | null): string {
  switch (aspectRatio) {
    case "16:9": return "landscape_16_9";
    case "9:16": return "portrait_16_9";
    case "4:3": return "landscape_4_3";
    case "3:4": return "portrait_4_3";
    default: return "square_hd";
  }
}

async function callFalQueue(model: string, apiKey: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const submitRes = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`Fal.ai submit failed: ${submitRes.status} ${text}`);
  }

  const { request_id } = (await submitRes.json()) as { request_id: string };

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`https://queue.fal.run/${model}/requests/${request_id}/status`, {
      headers: { "Authorization": `Key ${apiKey}` },
    });
    if (!statusRes.ok) continue;
    const status = (await statusRes.json()) as { status: string };
    if (status.status === "COMPLETED") {
      const resultRes = await fetch(`https://queue.fal.run/${model}/requests/${request_id}`, {
        headers: { "Authorization": `Key ${apiKey}` },
      });
      return (await resultRes.json()) as Record<string, unknown>;
    }
    if (status.status === "FAILED") {
      throw new Error("Fal.ai generation failed");
    }
  }
  throw new Error("Fal.ai generation timed out");
}

router.post("/ai/fix-issue", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const usageCheck = await checkAndIncrementUsage(userId, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit, type: "text" });
    return;
  }

  const { issueTitle, issueDescription, recommendation, websiteUrl, websiteName, currentValue } = req.body as {
    issueTitle?: string;
    issueDescription?: string;
    recommendation?: string;
    websiteUrl?: string;
    websiteName?: string;
    currentValue?: string;
  };

  if (!issueTitle || !issueDescription || !recommendation || !websiteUrl) {
    res.status(400).json({ error: "issueTitle, issueDescription, recommendation, and websiteUrl are required" });
    return;
  }

  const prompt = `You are an expert SEO specialist. Generate the exact corrected content to fix this SEO issue on a website.

Website: ${websiteName ?? websiteUrl}
URL: ${websiteUrl}
Issue: ${issueTitle}
Problem: ${issueDescription}
Recommended Fix: ${recommendation}
${currentValue ? `Current Value: ${currentValue}` : ""}

Provide the EXACT text the user should use to fix this issue. Be specific and actionable. For example:
- For a missing meta description: write the optimized meta description text
- For a missing title tag: write the optimized title tag text
- For missing alt text: suggest descriptive alt text for images
- For thin content: provide a content outline or example paragraph

Return ONLY the fixed content — no explanation, no labels, just the ready-to-use text.`;

  try {
    const fix = await callAI(prompt, { maxTokens: 1024 });
    res.json({ fix });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(503).json({ error: message });
  }
});

router.post("/ai/suggest-keywords", async (req, res): Promise<void> => {
  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit, type: "text" });
    return;
  }
  const parsed = SuggestKeywordsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { niche, websiteUrl, seedKeyword } = parsed.data;
  const prompt = `You are an SEO expert. Suggest 10 valuable keywords for a website in the "${niche}" niche.${websiteUrl ? ` Website: ${websiteUrl}` : ""}${seedKeyword ? ` Seed keyword: ${seedKeyword}` : ""}

Return a JSON object with a "keywords" array where each item has:
- keyword: the keyword phrase
- intent: search intent (informational, navigational, transactional, commercial)
- estimatedDifficulty: low, medium, or high
- notes: brief note on why this keyword is valuable

Return ONLY valid JSON, no markdown.`;

  try {
    const content = await callAI(prompt, { maxTokens: 2048 });
    let parsedResult;
    try {
      parsedResult = JSON.parse(content);
    } catch {
      parsedResult = { keywords: [] };
    }
    res.json(SuggestKeywordsResponse.parse(parsedResult));
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(503).json({ error: message });
  }
});

router.post("/ai/cluster-keywords", async (req, res): Promise<void> => {
  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit, type: "text" });
    return;
  }
  const parsed = ClusterKeywordsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { keywords } = parsed.data;
  if (keywords.length === 0) {
    res.json(ClusterKeywordsResponse.parse({ clusters: [] }));
    return;
  }

  const prompt = `You are an SEO expert. Group the following keywords into named topic clusters. For each cluster, assign a search intent label.

Keywords to cluster:
${keywords.map((k, i) => `${i + 1}. ${k}`).join("\n")}

Rules:
- Group semantically related keywords together
- Cluster names should be short and descriptive (2-5 words max)
- Intent must be one of: informational, commercial, navigational, transactional
- Every keyword must appear in exactly one cluster
- Aim for 2-6 clusters depending on keyword count and diversity

Return ONLY valid JSON in this exact format:
{
  "clusters": [
    {
      "name": "Cluster Name",
      "intent": "informational",
      "keywords": ["keyword one", "keyword two"]
    }
  ]
}`;

  try {
    const content = await callAI(prompt, { maxTokens: 2048 });
    let result: { clusters: Array<{ name: string; intent: string; keywords: string[] }> } = { clusters: [] };
    try {
      result = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { result = JSON.parse(jsonMatch[0]); } catch { /* fallback */ }
      }
    }
    res.json(ClusterKeywordsResponse.parse(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(503).json({ error: message });
  }
});

router.post("/ai/generate-post", async (req, res): Promise<void> => {
  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit, type: "text" });
    return;
  }
  const parsed = GenerateSocialPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { platform, topic, niche, tone } = parsed.data;
  const platformGuide: Record<string, string> = {
    twitter: "Keep it under 280 characters. Be punchy and direct.",
    instagram: "2-3 sentences with relevant hashtags at the end.",
    facebook: "2-4 sentences, conversational and engaging.",
    linkedin: "Professional tone, 3-5 sentences with a call to action.",
    youtube: "Write a compelling video description with keywords.",
  };
  const guide = platformGuide[platform] ?? "2-3 engaging sentences.";
  const prompt = `Write a social media post for ${platform} about: "${topic}"${niche ? ` in the ${niche} niche` : ""}. Tone: ${tone ?? "engaging"}. ${guide} Return ONLY the post text, no extra commentary.`;

  try {
    const content = await callAI(prompt, { maxTokens: 512 });
    res.json(GenerateSocialPostResponse.parse({ content }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(503).json({ error: message });
  }
});

router.post("/ai/generate-meta", async (req, res): Promise<void> => {
  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit, type: "text" });
    return;
  }
  const parsed = GenerateMetaTagsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { pageUrl, pageTitle, targetKeyword, niche } = parsed.data;
  const prompt = `Write an SEO-optimized meta title and meta description for this page:
URL: ${pageUrl}${pageTitle ? `\nPage Title: ${pageTitle}` : ""}${targetKeyword ? `\nTarget Keyword: ${targetKeyword}` : ""}${niche ? `\nNiche: ${niche}` : ""}

Rules:
- Meta title: 50-60 characters, include the keyword naturally
- Meta description: 150-160 characters, compelling, with a call to action

Return ONLY valid JSON with "title" and "description" fields.`;

  try {
    const content = await callAI(prompt, { maxTokens: 512 });
    let result = { title: "", description: "" };
    try {
      result = JSON.parse(content);
    } catch {
      // fallback
    }
    res.json(GenerateMetaTagsResponse.parse(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(503).json({ error: message });
  }
});

router.post("/ai/generate-campaign-copy", async (req, res): Promise<void> => {
  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit, type: "text" });
    return;
  }
  const parsed = GenerateCampaignCopyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { campaignGoal, product, targetAudience, tone, platform } = parsed.data;
  const prompt = `Write compelling marketing copy for a campaign:
Goal: ${campaignGoal}
Product/Service: ${product}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ""}${tone ? `\nTone: ${tone}` : ""}${platform ? `\nPlatform: ${platform}` : ""}

Write a headline, subheadline, and main copy (3-4 sentences) + a call to action. Return ONLY the copy text, formatted clearly.`;

  try {
    const content = await callAI(prompt, { maxTokens: 1024 });
    res.json(GenerateCampaignCopyResponse.parse({ content }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(503).json({ error: message });
  }
});

router.post("/ai/generate-seo-brief", async (req, res): Promise<void> => {
  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit, type: "text" });
    return;
  }
  const parsed = GenerateSeoBriefBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { keyword, niche, websiteUrl } = parsed.data;
  const prompt = `Create a detailed SEO content brief for the keyword: "${keyword}"${niche ? ` in the ${niche} niche` : ""}${websiteUrl ? ` for ${websiteUrl}` : ""}.

Include:
1. Target keyword and secondary keywords (3-5)
2. Search intent analysis
3. Recommended article structure (H1, H2, H3 outline)
4. Key points to cover
5. Word count recommendation
6. Internal/external linking suggestions
7. On-page SEO checklist

Format it clearly with sections.`;

  try {
    const content = await callAI(prompt, { maxTokens: 2048 });
    res.json(GenerateSeoBriefResponse.parse({ content }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(503).json({ error: message });
  }
});

router.post("/ai/generate-image", async (req, res): Promise<void> => {
  const usageCheck = await checkAndIncrementUsage(req.user!.id, "image");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly image generation limit reached", used: usageCheck.used, limit: usageCheck.limit, type: "image" });
    return;
  }

  const parsed = GenerateAiImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const apiKey = await getSetting("fal_api_key");
  if (!apiKey) {
    res.status(503).json({ error: "Fal.ai API key not configured. Please add it in Settings." });
    return;
  }

  const { prompt, aspectRatio, websiteId, campaignId } = parsed.data;
  const imageSize = toFalImageSize(aspectRatio);

  try {
    const imageModel = await getFalImageModel();
    const result = await callFalQueue(imageModel, apiKey, {
      prompt,
      image_size: imageSize,
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    });

    const images = result.images as Array<{ url: string }>;
    const url = images?.[0]?.url;
    if (!url) throw new Error("No image URL in response");

    const [asset] = await db.insert(mediaAssetsTable).values({
      url,
      type: "image",
      prompt,
      aspectRatio: aspectRatio ?? null,
      websiteId: websiteId ?? null,
      campaignId: campaignId ?? null,
    }).returning();

    res.json(asset);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    res.status(500).json({ error: message });
  }
});

router.post("/ai/generate-video", async (req, res): Promise<void> => {
  const usageCheck = await checkAndIncrementUsage(req.user!.id, "video");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly video generation limit reached", used: usageCheck.used, limit: usageCheck.limit, type: "video" });
    return;
  }

  const parsed = GenerateAiVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const apiKey = await getSetting("fal_api_key");
  if (!apiKey) {
    res.status(503).json({ error: "Fal.ai API key not configured. Please add it in Settings." });
    return;
  }

  const { prompt, aspectRatio, durationSeconds, websiteId, campaignId } = parsed.data;
  const aspect = aspectRatio === "9:16" ? "9:16" : "16:9";
  const duration = durationSeconds && [5, 10].includes(durationSeconds) ? String(durationSeconds) : "5";

  try {
    const videoModel = await getFalVideoModel();
    const result = await callFalQueue(videoModel, apiKey, {
      prompt,
      aspect_ratio: aspect,
      duration,
    });

    const video = result.video as { url: string };
    const url = video?.url;
    if (!url) throw new Error("No video URL in response");

    const [asset] = await db.insert(mediaAssetsTable).values({
      url,
      type: "video",
      prompt,
      aspectRatio: aspect,
      websiteId: websiteId ?? null,
      campaignId: campaignId ?? null,
    }).returning();

    res.json(asset);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    res.status(500).json({ error: message });
  }
});

export default router;
