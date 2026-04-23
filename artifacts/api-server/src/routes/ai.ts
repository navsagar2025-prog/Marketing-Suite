import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
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
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/ai/suggest-keywords", async (req, res): Promise<void> => {
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

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  const content = response.choices[0]?.message?.content ?? '{"keywords":[]}';
  let parsed2;
  try {
    parsed2 = JSON.parse(content);
  } catch {
    parsed2 = { keywords: [] };
  }
  res.json(SuggestKeywordsResponse.parse(parsed2));
});

router.post("/ai/generate-post", async (req, res): Promise<void> => {
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

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });
  res.json(GenerateSocialPostResponse.parse({ content: response.choices[0]?.message?.content ?? "" }));
});

router.post("/ai/generate-meta", async (req, res): Promise<void> => {
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

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });
  let result = { title: "", description: "" };
  try {
    result = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  } catch {
    // fallback
  }
  res.json(GenerateMetaTagsResponse.parse(result));
});

router.post("/ai/generate-campaign-copy", async (req, res): Promise<void> => {
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

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  res.json(GenerateCampaignCopyResponse.parse({ content: response.choices[0]?.message?.content ?? "" }));
});

router.post("/ai/generate-seo-brief", async (req, res): Promise<void> => {
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

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  res.json(GenerateSeoBriefResponse.parse({ content: response.choices[0]?.message?.content ?? "" }));
});

export default router;
