import { useState } from "react";
import { Sparkles, Search, Share2, Globe, Megaphone, FileText, AlertCircle, Settings, HelpCircle, Code2, Copy, Check, Download, PenLine, Save, Zap, X, Network } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  useSuggestKeywords,
  useClusterKeywords,
  useGenerateSocialPost,
  useGenerateMetaTags,
  useGenerateCampaignCopy,
  useGenerateSeoBrief,
  useGenerateFaq,
  useGenerateSchema,
  useGetSettings,
  useGenerateBlogDraft,
  useListWebsites,
  useCreateMediaAsset,
  useGetBillingMe,
  getGetBillingMeQueryKey,
} from "@workspace/api-client-react";

const PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "Twitter/X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
];

const SCHEMA_TYPES = ["FAQ", "Article", "LocalBusiness", "Product"] as const;
type SchemaType = typeof SCHEMA_TYPES[number];

const SCHEMA_FIELDS: Record<SchemaType, Array<{ key: string; label: string; placeholder: string; required?: boolean }>> = {
  FAQ: [
    { key: "topic", label: "Topic", placeholder: "e.g. Online marketing for small businesses", required: true },
    { key: "pageUrl", label: "Page URL", placeholder: "https://example.com/faq" },
  ],
  Article: [
    { key: "name", label: "Article Title", placeholder: "10 SEO Tips for 2024", required: true },
    { key: "description", label: "Description", placeholder: "A short summary of the article" },
    { key: "author", label: "Author Name", placeholder: "Jane Smith" },
    { key: "datePublished", label: "Date Published", placeholder: "2024-01-15" },
    { key: "url", label: "Article URL", placeholder: "https://example.com/seo-tips" },
  ],
  LocalBusiness: [
    { key: "name", label: "Business Name", placeholder: "Acme Digital Agency", required: true },
    { key: "description", label: "Description", placeholder: "We help businesses grow online" },
    { key: "address", label: "Address", placeholder: "123 Main St, New York, NY 10001" },
    { key: "phone", label: "Phone", placeholder: "+1-555-123-4567" },
    { key: "url", label: "Website URL", placeholder: "https://acmedigital.com" },
    { key: "openingHours", label: "Opening Hours", placeholder: "Mon-Fri 9am-5pm" },
  ],
  Product: [
    { key: "name", label: "Product Name", placeholder: "Premium SEO Tool Suite", required: true },
    { key: "description", label: "Description", placeholder: "All-in-one SEO analysis and reporting" },
    { key: "brand", label: "Brand", placeholder: "Acme Inc." },
    { key: "price", label: "Price", placeholder: "49.99" },
    { key: "currency", label: "Currency", placeholder: "USD" },
    { key: "url", label: "Product URL", placeholder: "https://example.com/product" },
  ],
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJsonLd(raw: string): string {
  const scriptTagStart = '<script type="application/ld+json">';
  const scriptTagEnd = '</script>';
  let jsonPart = raw;
  let prefix = "";
  let suffix = "";

  const startIdx = raw.indexOf(scriptTagStart);
  const endIdx = raw.lastIndexOf(scriptTagEnd);
  if (startIdx !== -1 && endIdx !== -1) {
    prefix = raw.slice(0, startIdx + scriptTagStart.length);
    jsonPart = raw.slice(startIdx + scriptTagStart.length, endIdx);
    suffix = raw.slice(endIdx);
  }

  const escapedJson = escapeHtml(jsonPart);

  const highlighted = escapedJson.replace(
    /("(?:[^"\\]|\\.)*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (match.startsWith('"')) {
        if (/"\s*:$/.test(match)) return `<span class="json-key">${match}</span>`;
        return `<span class="json-string">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span class="json-boolean">${match}</span>`;
      if (/null/.test(match)) return `<span class="json-null">${match}</span>`;
      return `<span class="json-number">${match}</span>`;
    }
  );

  return escapeHtml(prefix) + highlighted + escapeHtml(suffix);
}

function JsonLdHighlight({ code }: { code: string }) {
  return (
    <pre
      className="p-4 rounded-md bg-zinc-950 dark:bg-zinc-900 text-zinc-100 text-xs overflow-x-auto max-h-80 overflow-y-auto font-mono leading-relaxed whitespace-pre-wrap border border-zinc-800 [&_.json-key]:text-sky-300 [&_.json-string]:text-emerald-300 [&_.json-boolean]:text-violet-300 [&_.json-null]:text-violet-300 [&_.json-number]:text-amber-300"
      dangerouslySetInnerHTML={{ __html: highlightJsonLd(code) }}
    />
  );
}

function useCopyToClipboard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };
  return { copy, copiedKey };
}

function CopyButton({ text, copyKey, label = "Copy" }: { text: string; copyKey: string; label?: string }) {
  const { copy, copiedKey } = useCopyToClipboard();
  const copied = copiedKey === copyKey;
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs gap-1"
      onClick={() => copy(text, copyKey)}
      data-testid={`button-copy-${copyKey}`}
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

function ResultBox({ content, label }: { content: string; label?: string }) {
  return (
    <div className="mt-3 p-3 rounded-md bg-muted border text-sm whitespace-pre-wrap" data-testid="text-ai-result">
      {label && <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">{label}</p>}
      {content}
    </div>
  );
}

function buildFaqJsonLd(faqs: Array<{ question: string; answer: string }>): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

const AI_LIMIT_NUDGE_KEY = "nudge_ai_limit_dismissed";

export default function AiTools() {
  const { toast } = useToast();
  const { data: settings } = useGetSettings();
  const { data: billing } = useGetBillingMe({ query: { queryKey: getGetBillingMeQueryKey() } });
  const [aiNudgeDismissed, setAiNudgeDismissed] = useState(() => localStorage.getItem(AI_LIMIT_NUDGE_KEY) === "true");
  const aiProvider = settings?.aiProvider ?? "replit";
  const aiEnabled = settings?.aiEnabled ?? true;
  const aiKeyMissing = aiProvider !== "replit" && !settings?.aiApiKeyConfigured;
  const aiDisabled = settings !== undefined && (!aiEnabled || aiKeyMissing);

  const isStarterPlan = billing?.plan === "starter";
  const aiUsed = billing?.usage?.aiGenerations ?? 0;
  const aiLimit = billing?.limits?.aiGenerations ?? 50;
  const showAiLimitNudge = isStarterPlan && !aiNudgeDismissed && aiUsed >= 40;

  const dismissAiNudge = () => {
    localStorage.setItem(AI_LIMIT_NUDGE_KEY, "true");
    setAiNudgeDismissed(true);
  };

  // Keyword Suggester state
  const [kwNiche, setKwNiche] = useState("");
  const [kwSeed, setKwSeed] = useState("");
  const [kwResult, setKwResult] = useState<Array<{ keyword: string; intent: string; estimatedDifficulty: string; notes: string }>>([]);
  const suggestMutation = useSuggestKeywords();

  // Post Generator state
  const [postPlatform, setPostPlatform] = useState("instagram");
  const [postTopic, setPostTopic] = useState("");
  const [postTone, setPostTone] = useState("engaging");
  const [postResult, setPostResult] = useState("");
  const generatePostMutation = useGenerateSocialPost();

  // Meta Tag state
  const [metaUrl, setMetaUrl] = useState("");
  const [metaKeyword, setMetaKeyword] = useState("");
  const [metaResult, setMetaResult] = useState<{ title: string; description: string } | null>(null);
  const metaMutation = useGenerateMetaTags();

  // Campaign Copy state
  const [copyGoal, setCopyGoal] = useState("");
  const [copyProduct, setCopyProduct] = useState("");
  const [copyAudience, setCopyAudience] = useState("");
  const [copyResult, setCopyResult] = useState("");
  const copyMutation = useGenerateCampaignCopy();

  // SEO Brief state
  const [briefKeyword, setBriefKeyword] = useState("");
  const [briefNiche, setBriefNiche] = useState("");
  const [briefResult, setBriefResult] = useState("");
  const briefMutation = useGenerateSeoBrief();

  // FAQ Generator state
  const [faqTopic, setFaqTopic] = useState("");
  const [faqUrl, setFaqUrl] = useState("");
  const [faqResult, setFaqResult] = useState<Array<{ question: string; answer: string }>>([]);
  const faqMutation = useGenerateFaq();

  // Schema Markup state
  const [schemaType, setSchemaType] = useState<SchemaType>("FAQ");
  const [schemaFields, setSchemaFields] = useState<Record<string, string>>({});
  const [schemaResult, setSchemaResult] = useState("");
  const schemaMutation = useGenerateSchema();

  // Keyword Cluster state
  const [clusterWebsiteId, setClusterWebsiteId] = useState<string>("");
  const [clusterInput, setClusterInput] = useState("");
  const [clusterResult, setClusterResult] = useState<Array<{ name: string; intent: string; keywords: string[] }>>([]);
  const clusterMutation = useClusterKeywords();

  // Blog / Page Drafter state
  const [blogKeyword, setBlogKeyword] = useState("");
  const [blogContentType, setBlogContentType] = useState("blog_post");
  const [blogWordCount, setBlogWordCount] = useState("1000");
  const [blogTone, setBlogTone] = useState("professional");
  const [blogNotes, setBlogNotes] = useState("");
  const [blogResult, setBlogResult] = useState<{ title: string; content: string } | null>(null);
  const [blogSaveWebsiteId, setBlogSaveWebsiteId] = useState<string>("none");
  const [blogSaved, setBlogSaved] = useState(false);
  const blogDraftMutation = useGenerateBlogDraft();
  const createMediaAssetMutation = useCreateMediaAsset();
  const { data: websitesList } = useListWebsites();

  const handleSuggestKeywords = () => {
    if (!kwNiche.trim()) return;
    suggestMutation.mutate({ data: { niche: kwNiche, seedKeyword: kwSeed || undefined } }, {
      onSuccess: (r) => setKwResult(r.keywords),
      onError: () => toast({ title: "AI error", variant: "destructive" }),
    });
  };

  const handleGeneratePost = () => {
    if (!postTopic.trim()) return;
    generatePostMutation.mutate({ data: { platform: postPlatform, topic: postTopic, tone: postTone } }, {
      onSuccess: (r) => setPostResult(r.content),
      onError: () => toast({ title: "AI error", variant: "destructive" }),
    });
  };

  const handleGenerateMeta = () => {
    if (!metaUrl.trim()) return;
    metaMutation.mutate({ data: { pageUrl: metaUrl, targetKeyword: metaKeyword || undefined } }, {
      onSuccess: (r) => setMetaResult(r),
      onError: () => toast({ title: "AI error", variant: "destructive" }),
    });
  };

  const handleGenerateCopy = () => {
    if (!copyGoal.trim() || !copyProduct.trim()) return;
    copyMutation.mutate({ data: { campaignGoal: copyGoal, product: copyProduct, targetAudience: copyAudience || undefined } }, {
      onSuccess: (r) => setCopyResult(r.content),
      onError: () => toast({ title: "AI error", variant: "destructive" }),
    });
  };

  const handleGenerateBrief = () => {
    if (!briefKeyword.trim()) return;
    briefMutation.mutate({ data: { keyword: briefKeyword, niche: briefNiche || undefined } }, {
      onSuccess: (r) => setBriefResult(r.content),
      onError: () => toast({ title: "AI error", variant: "destructive" }),
    });
  };

  const handleGenerateFaq = () => {
    if (!faqTopic.trim()) return;
    faqMutation.mutate({ data: { topic: faqTopic, url: faqUrl || undefined } }, {
      onSuccess: (r) => setFaqResult(r.faqs),
      onError: () => toast({ title: "AI error", variant: "destructive" }),
    });
  };

  const handleGenerateSchema = () => {
    const hasRequiredField = SCHEMA_FIELDS[schemaType].filter(f => f.required).every(f => schemaFields[f.key]?.trim());
    if (!hasRequiredField) return;
    const nonEmptyFields = Object.fromEntries(Object.entries(schemaFields).filter(([, v]) => v.trim()));
    schemaMutation.mutate({ data: { schemaType, fields: nonEmptyFields } }, {
      onSuccess: (r) => setSchemaResult(r.jsonLd),
      onError: () => toast({ title: "AI error", variant: "destructive" }),
    });
  };

  const faqJsonLd = faqResult.length > 0 ? buildFaqJsonLd(faqResult) : "";

  const handleClusterKeywords = () => {
    const keywords = clusterInput.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    if (keywords.length < 2 || !clusterWebsiteId) return;
    clusterMutation.mutate(
      { data: { websiteId: parseInt(clusterWebsiteId), keywords } },
      {
        onSuccess: (r) => setClusterResult(r.clusters),
        onError: () => toast({ title: "AI error", variant: "destructive" }),
      }
    );
  };

  const handleGenerateBlogDraft = () => {
    if (!blogKeyword.trim()) return;
    setBlogSaved(false);
    blogDraftMutation.mutate({
      data: {
        keyword: blogKeyword,
        contentType: blogContentType as "blog_post" | "landing_page" | "product_page",
        wordCount: parseInt(blogWordCount) as 500 | 1000 | 1500 | 2000,
        tone: blogTone as "professional" | "conversational" | "persuasive",
        notes: blogNotes || undefined,
      },
    }, {
      onSuccess: (r) => setBlogResult(r),
      onError: () => toast({ title: "AI error", description: "Failed to generate draft. Please try again.", variant: "destructive" }),
    });
  };

  const handleSaveBlogDraft = () => {
    if (!blogResult) return;
    createMediaAssetMutation.mutate({
      data: {
        url: blogResult.title,
        type: "text",
        prompt: blogResult.content,
        websiteId: blogSaveWebsiteId !== "none" ? parseInt(blogSaveWebsiteId) : undefined,
      },
    }, {
      onSuccess: () => {
        setBlogSaved(true);
        toast({ title: "Draft saved", description: "Your draft has been saved to the Media Library." });
      },
      onError: () => toast({ title: "Save failed", variant: "destructive" }),
    });
  };

  function estimateWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function stripMarkdown(text: string): string {
    return text
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function renderMarkdownDraft(text: string) {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("## ")) {
        elements.push(<h2 key={i} className="text-base font-bold mt-5 mb-1.5 text-foreground border-b pb-1">{line.slice(3)}</h2>);
      } else if (line.startsWith("# ")) {
        elements.push(<h1 key={i} className="text-lg font-bold mb-2 text-foreground">{line.slice(2)}</h1>);
      } else if (line.startsWith("### ")) {
        elements.push(<h3 key={i} className="text-sm font-semibold mt-3 mb-1 text-foreground">{line.slice(4)}</h3>);
      } else if (line.trim() === "") {
        elements.push(<div key={i} className="h-2" />);
      } else {
        elements.push(<p key={i} className="text-sm text-foreground/90 leading-relaxed">{line.replace(/\*\*(.*?)\*\*/g, "$1")}</p>);
      }
      i++;
    }
    return elements;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2" data-testid="text-page-title">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Content Tools
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">AI-powered content generation for SEO & marketing</p>
      </div>

      {aiDisabled && (
        <div className="flex items-start gap-3 p-4 rounded-md border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" data-testid="banner-ai-disabled">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-sm">
              {!aiEnabled ? "AI features are disabled" : "API key not configured"}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              {!aiEnabled
                ? "Enable AI in Settings to use content generation tools."
                : "Add an API key for the selected provider in Settings to use AI tools."}
            </p>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="shrink-0 border-amber-300 dark:border-amber-700">
              <Settings className="h-3.5 w-3.5 mr-1" />
              Settings
            </Button>
          </Link>
        </div>
      )}

      {/* AI generation limit nudge */}
      {showAiLimitNudge && (
        <div
          data-testid="banner-ai-limit-nudge"
          className="flex items-start gap-3 p-4 rounded-md border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
        >
          <Zap className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="font-medium text-sm">Running low on AI generations</p>
            <p className="text-xs mt-0.5 opacity-80">
              You've used <strong>{aiUsed} of {aiLimit}</strong> AI generations this month on your Starter plan.{" "}
              Upgrade to Growth for 300/month, or Agency for 1,000.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/pricing">
              <Button variant="outline" size="sm" className="border-amber-300 dark:border-amber-700" data-testid="button-ai-nudge-upgrade">
                <Zap className="h-3.5 w-3.5 mr-1" />
                Upgrade
              </Button>
            </Link>
            <button
              data-testid="button-dismiss-ai-limit-nudge"
              onClick={dismissAiNudge}
              className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors"
              aria-label="Dismiss nudge"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${aiDisabled ? "opacity-60 pointer-events-none" : ""}`}>
        {/* 1. Keyword Suggester */}
        <Card data-testid="card-keyword-suggester">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4 text-primary" /> Keyword Suggester</CardTitle>
            <CardDescription className="text-xs">Get AI-powered keyword ideas for any niche</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input data-testid="input-kw-niche" placeholder="Your niche (e.g. health & fitness)" value={kwNiche} onChange={e => setKwNiche(e.target.value)} />
            <Input data-testid="input-kw-seed" placeholder="Seed keyword (optional)" value={kwSeed} onChange={e => setKwSeed(e.target.value)} />
            <Button data-testid="button-suggest-keywords" onClick={handleSuggestKeywords} disabled={suggestMutation.isPending || !kwNiche.trim()} className="w-full">
              {suggestMutation.isPending ? "Generating..." : "Suggest Keywords"}
            </Button>
            {kwResult.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {kwResult.map((kw, i) => (
                  <div key={i} data-testid={`suggestion-${i}`} className="p-2.5 border rounded-md text-sm bg-muted/30">
                    <p className="font-semibold">{kw.keyword}</p>
                    <div className="flex gap-1.5 mt-1">
                      <Badge variant="outline" className="text-xs">{kw.intent}</Badge>
                      <Badge variant="outline" className="text-xs">{kw.estimatedDifficulty}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{kw.notes}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Post Generator */}
        <Card data-testid="card-post-generator">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Share2 className="h-4 w-4 text-primary" /> Social Post Generator</CardTitle>
            <CardDescription className="text-xs">Generate platform-optimized social media posts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={postPlatform} onValueChange={setPostPlatform}>
              <SelectTrigger data-testid="select-post-platform"><SelectValue /></SelectTrigger>
              <SelectContent>{PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input data-testid="input-post-topic" placeholder="Topic (e.g. 5 morning habits)" value={postTopic} onChange={e => setPostTopic(e.target.value)} />
            <Input data-testid="input-post-tone" placeholder="Tone (e.g. engaging, professional)" value={postTone} onChange={e => setPostTone(e.target.value)} />
            <Button data-testid="button-generate-post" onClick={handleGeneratePost} disabled={generatePostMutation.isPending || !postTopic.trim()} className="w-full">
              {generatePostMutation.isPending ? "Generating..." : "Generate Post"}
            </Button>
            {postResult && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Generated Post</p>
                  <CopyButton text={postResult} copyKey="post" />
                </div>
                <div className="p-3 rounded-md bg-muted border text-sm whitespace-pre-wrap" data-testid="text-ai-result">{postResult}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Meta Tag Generator */}
        <Card data-testid="card-meta-generator">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Meta Tag Generator</CardTitle>
            <CardDescription className="text-xs">Generate SEO-optimized title and description tags</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input data-testid="input-meta-url" placeholder="Page URL (e.g. https://example.com/about)" value={metaUrl} onChange={e => setMetaUrl(e.target.value)} />
            <Input data-testid="input-meta-keyword" placeholder="Target keyword (optional)" value={metaKeyword} onChange={e => setMetaKeyword(e.target.value)} />
            <Button data-testid="button-generate-meta" onClick={handleGenerateMeta} disabled={metaMutation.isPending || !metaUrl.trim()} className="w-full">
              {metaMutation.isPending ? "Generating..." : "Generate Meta Tags"}
            </Button>
            {metaResult && (
              <div className="space-y-2 mt-2">
                <div className="p-2.5 border rounded-md bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title Tag</p>
                    <CopyButton text={metaResult.title} copyKey="meta-title" />
                  </div>
                  <p className="text-sm font-medium" data-testid="text-meta-title">{metaResult.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{metaResult.title.length} characters</p>
                </div>
                <div className="p-2.5 border rounded-md bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meta Description</p>
                    <CopyButton text={metaResult.description} copyKey="meta-desc" />
                  </div>
                  <p className="text-sm" data-testid="text-meta-description">{metaResult.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{metaResult.description.length} characters</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Campaign Copy Generator */}
        <Card data-testid="card-campaign-copy">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> Campaign Copy Generator</CardTitle>
            <CardDescription className="text-xs">Generate compelling marketing copy for any campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input data-testid="input-copy-goal" placeholder="Campaign goal (e.g. Drive signups)" value={copyGoal} onChange={e => setCopyGoal(e.target.value)} />
            <Input data-testid="input-copy-product" placeholder="Product/service name" value={copyProduct} onChange={e => setCopyProduct(e.target.value)} />
            <Input data-testid="input-copy-audience" placeholder="Target audience (optional)" value={copyAudience} onChange={e => setCopyAudience(e.target.value)} />
            <Button data-testid="button-generate-copy" onClick={handleGenerateCopy} disabled={copyMutation.isPending || !copyGoal.trim() || !copyProduct.trim()} className="w-full">
              {copyMutation.isPending ? "Generating..." : "Generate Copy"}
            </Button>
            {copyResult && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Campaign Copy</p>
                  <CopyButton text={copyResult} copyKey="campaign-copy" />
                </div>
                <div className="p-3 rounded-md bg-muted border text-sm whitespace-pre-wrap" data-testid="text-ai-result">{copyResult}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. SEO Brief Generator — full width */}
        <Card className="lg:col-span-2" data-testid="card-seo-brief">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> SEO Content Brief</CardTitle>
            <CardDescription className="text-xs">Generate a detailed SEO content brief with structure, keywords, and optimization tips</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input data-testid="input-brief-keyword" placeholder="Target keyword (e.g. best protein powder)" value={briefKeyword} onChange={e => setBriefKeyword(e.target.value)} />
              <Input data-testid="input-brief-niche" placeholder="Niche (optional)" value={briefNiche} onChange={e => setBriefNiche(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Button data-testid="button-generate-brief" onClick={handleGenerateBrief} disabled={briefMutation.isPending || !briefKeyword.trim()} className="w-full md:w-auto">
                {briefMutation.isPending ? "Generating..." : "Generate SEO Brief"}
              </Button>
              {briefResult && <CopyButton text={briefResult} copyKey="seo-brief" label="Copy Brief" />}
            </div>
            {briefResult && (
              <div className="p-4 border rounded-md bg-muted/30 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto" data-testid="text-seo-brief">{briefResult}</div>
            )}
          </CardContent>
        </Card>

        {/* 6. FAQ Generator — full width */}
        <Card className="lg:col-span-2" data-testid="card-faq-generator">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><HelpCircle className="h-4 w-4 text-primary" /> FAQ Generator</CardTitle>
            <CardDescription className="text-xs">Generate 5-8 FAQ question/answer pairs ready for your webpage — export as JSON-LD schema in one click</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Topic *</Label>
                <Input
                  data-testid="input-faq-topic"
                  placeholder="e.g. SEO for small businesses, email marketing basics"
                  value={faqTopic}
                  onChange={e => setFaqTopic(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reference URL (optional)</Label>
                <Input
                  data-testid="input-faq-url"
                  placeholder="https://example.com/page"
                  value={faqUrl}
                  onChange={e => setFaqUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                data-testid="button-generate-faq"
                onClick={handleGenerateFaq}
                disabled={faqMutation.isPending || !faqTopic.trim()}
                className="w-full md:w-auto"
              >
                {faqMutation.isPending ? "Generating..." : "Generate FAQs"}
              </Button>
              {faqResult.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  data-testid="button-export-faq-jsonld"
                  onClick={() => {
                    navigator.clipboard.writeText(faqJsonLd);
                    toast({ title: "FAQ JSON-LD copied to clipboard" });
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export as JSON-LD
                </Button>
              )}
            </div>
            {faqResult.length > 0 && (
              <div className="space-y-2 max-h-[480px] overflow-y-auto" data-testid="container-faq-results">
                {faqResult.map((faq, i) => (
                  <div key={i} data-testid={`faq-item-${i}`} className="p-3 border rounded-md bg-muted/30">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold flex-1">
                        <span className="text-muted-foreground mr-1.5">Q{i + 1}.</span>
                        {faq.question}
                      </p>
                      <CopyButton text={`Q: ${faq.question}\nA: ${faq.answer}`} copyKey={`faq-${i}`} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 ml-5">{faq.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7. Schema Markup Generator — full width */}
        <Card className="lg:col-span-2" data-testid="card-schema-generator">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Code2 className="h-4 w-4 text-primary" /> Schema Markup Generator</CardTitle>
            <CardDescription className="text-xs">Generate ready-to-paste JSON-LD structured data for FAQ, Article, LocalBusiness, or Product pages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Schema Type</Label>
              <Select
                value={schemaType}
                onValueChange={(v) => {
                  setSchemaType(v as SchemaType);
                  setSchemaFields({});
                  setSchemaResult("");
                }}
              >
                <SelectTrigger data-testid="select-schema-type" className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEMA_TYPES.map(t => (
                    <SelectItem key={t} value={t} data-testid={`schema-type-option-${t.toLowerCase()}`}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SCHEMA_FIELDS[schemaType].map(field => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs">
                    {field.label}
                    {field.required && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  <Input
                    data-testid={`input-schema-${field.key}`}
                    placeholder={field.placeholder}
                    value={schemaFields[field.key] ?? ""}
                    onChange={e => setSchemaFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                data-testid="button-generate-schema"
                onClick={handleGenerateSchema}
                disabled={
                  schemaMutation.isPending ||
                  !SCHEMA_FIELDS[schemaType].filter(f => f.required).every(f => schemaFields[f.key]?.trim())
                }
                className="w-full md:w-auto"
              >
                {schemaMutation.isPending ? "Generating..." : "Generate Schema Markup"}
              </Button>
              {schemaResult && <CopyButton text={schemaResult} copyKey="schema-result" label="Copy JSON-LD" />}
            </div>

            {schemaResult && (
              <div className="relative" data-testid="container-schema-result">
                <JsonLdHighlight code={schemaResult} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 9. Keyword Cluster — full width */}
        <Card className="lg:col-span-2" data-testid="card-keyword-cluster">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Network className="h-4 w-4 text-primary" /> Keyword Cluster Tool</CardTitle>
            <CardDescription className="text-xs">Group a list of keywords into topical clusters to plan your content strategy — each cluster maps to a page or content pillar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Website *</Label>
                <Select value={clusterWebsiteId} onValueChange={setClusterWebsiteId}>
                  <SelectTrigger data-testid="select-cluster-website">
                    <SelectValue placeholder="Select a website" />
                  </SelectTrigger>
                  <SelectContent>
                    {(websitesList ?? []).map(w => (
                      <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Keywords * <span className="text-muted-foreground font-normal">(one per line or comma-separated, min. 2)</span></Label>
                <Textarea
                  data-testid="input-cluster-keywords"
                  placeholder={"seo tools\nkeyword research\nbacklink checker\ncontent marketing\nsite audit"}
                  value={clusterInput}
                  onChange={e => setClusterInput(e.target.value)}
                  className="resize-none h-24 text-sm font-mono"
                />
              </div>
            </div>
            <Button
              data-testid="button-cluster-keywords"
              onClick={handleClusterKeywords}
              disabled={
                clusterMutation.isPending ||
                !clusterWebsiteId ||
                clusterInput.split(/[\n,]+/).map(k => k.trim()).filter(Boolean).length < 2
              }
              className="w-full md:w-auto"
            >
              {clusterMutation.isPending ? "Clustering..." : "Cluster Keywords"}
            </Button>
            {clusterResult.length > 0 && (
              <div className="space-y-3" data-testid="container-cluster-results">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{clusterResult.length} clusters found</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clusterResult.map((cluster, i) => {
                    const intentColor: Record<string, string> = {
                      informational: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                      commercial: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                      transactional: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                      navigational: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                    };
                    return (
                      <div
                        key={i}
                        data-testid={`cluster-card-${i}`}
                        className="border rounded-md p-3 space-y-2 bg-muted/20"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight flex-1">{cluster.name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${intentColor[cluster.intent] ?? "bg-muted text-muted-foreground"}`}>
                            {cluster.intent}
                          </span>
                        </div>
                        <ul className="space-y-0.5">
                          {cluster.keywords.map((kw, j) => (
                            <li key={j} className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                              {kw}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 8. Blog / Page Drafter — full width */}
        <Card className="lg:col-span-2" data-testid="card-blog-drafter">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><PenLine className="h-4 w-4 text-primary" /> Blog / Page Drafter</CardTitle>
            <CardDescription className="text-xs">Generate a fully structured long-form blog post, landing page, or product page — ready to paste into your CMS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Target Keyword *</Label>
                <Input
                  data-testid="input-blog-keyword"
                  placeholder="e.g. best CRM software for small business"
                  value={blogKeyword}
                  onChange={e => setBlogKeyword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Content Type</Label>
                <Select value={blogContentType} onValueChange={setBlogContentType}>
                  <SelectTrigger data-testid="select-blog-content-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blog_post">Blog Post</SelectItem>
                    <SelectItem value="landing_page">Landing Page</SelectItem>
                    <SelectItem value="product_page">Product Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Approximate Word Count</Label>
                <Select value={blogWordCount} onValueChange={setBlogWordCount}>
                  <SelectTrigger data-testid="select-blog-word-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="500">~500 words</SelectItem>
                    <SelectItem value="1000">~1,000 words</SelectItem>
                    <SelectItem value="1500">~1,500 words</SelectItem>
                    <SelectItem value="2000">~2,000 words</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tone</Label>
                <Select value={blogTone} onValueChange={setBlogTone}>
                  <SelectTrigger data-testid="select-blog-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="conversational">Conversational</SelectItem>
                    <SelectItem value="persuasive">Persuasive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Additional Notes (optional)</Label>
              <Textarea
                data-testid="input-blog-notes"
                placeholder="e.g. Focus on enterprise buyers, include a comparison table, mention our product..."
                value={blogNotes}
                onChange={e => setBlogNotes(e.target.value)}
                className="resize-none h-16 text-sm"
              />
            </div>
            <Button
              data-testid="button-generate-blog-draft"
              onClick={handleGenerateBlogDraft}
              disabled={blogDraftMutation.isPending || !blogKeyword.trim()}
              className="w-full md:w-auto"
            >
              {blogDraftMutation.isPending ? "Drafting..." : "Generate Draft"}
            </Button>

            {blogResult && (
              <div className="space-y-3" data-testid="container-blog-result">
                {/* Title + word count + copy actions */}
                <div className="flex flex-wrap items-start justify-between gap-2 pt-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Generated Draft</p>
                    <p className="text-base font-bold text-foreground" data-testid="text-blog-title">{blogResult.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ~{estimateWordCount(blogResult.content).toLocaleString()} words &middot; {blogResult.content.length.toLocaleString()} characters
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap shrink-0">
                    <CopyButton text={blogResult.content} copyKey="blog-markdown" label="Copy as Markdown" />
                    <CopyButton text={`${blogResult.title}\n\n${stripMarkdown(blogResult.content)}`} copyKey="blog-plaintext" label="Copy as Plain Text" />
                  </div>
                </div>

                {/* Rendered document view */}
                <div
                  className="border rounded-md p-4 bg-white dark:bg-zinc-950 max-h-[520px] overflow-y-auto"
                  data-testid="container-blog-rendered"
                >
                  {renderMarkdownDraft(blogResult.content)}
                </div>

                {/* Save as asset */}
                <div className="flex flex-wrap items-end gap-3 pt-1 border-t">
                  <div className="space-y-1 flex-1 min-w-[160px]">
                    <Label className="text-xs">Save to website (optional)</Label>
                    <Select value={blogSaveWebsiteId} onValueChange={setBlogSaveWebsiteId}>
                      <SelectTrigger data-testid="select-blog-save-website" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No website</SelectItem>
                        {(websitesList ?? []).map(w => (
                          <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    data-testid="button-save-blog-draft"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveBlogDraft}
                    disabled={createMediaAssetMutation.isPending || blogSaved}
                    className="gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {blogSaved ? "Saved to Media Library" : createMediaAssetMutation.isPending ? "Saving..." : "Save Draft"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
