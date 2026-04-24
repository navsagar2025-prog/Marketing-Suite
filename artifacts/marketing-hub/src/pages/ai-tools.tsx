import { useState } from "react";
import { Sparkles, Search, Share2, Globe, Megaphone, FileText, AlertCircle, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  useSuggestKeywords,
  useGenerateSocialPost,
  useGenerateMetaTags,
  useGenerateCampaignCopy,
  useGenerateSeoBrief,
  useGetSettings,
} from "@workspace/api-client-react";

const PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "Twitter/X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
];

function ResultBox({ content, label }: { content: string; label?: string }) {
  return (
    <div className="mt-3 p-3 rounded-md bg-muted border text-sm whitespace-pre-wrap" data-testid="text-ai-result">
      {label && <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">{label}</p>}
      {content}
    </div>
  );
}

export default function AiTools() {
  const { toast } = useToast();
  const { data: settings } = useGetSettings();
  const aiDisabled = settings !== undefined && settings.aiEnabled === false;

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
            <p className="font-medium text-sm">AI features are disabled</p>
            <p className="text-xs mt-0.5 opacity-80">Enable AI in Settings to use content generation tools.</p>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="shrink-0 border-amber-300 dark:border-amber-700">
              <Settings className="h-3.5 w-3.5 mr-1" />
              Settings
            </Button>
          </Link>
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
            {postResult && <ResultBox content={postResult} label="Generated Post" />}
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
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Title Tag</p>
                  <p className="text-sm font-medium" data-testid="text-meta-title">{metaResult.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{metaResult.title.length} characters</p>
                </div>
                <div className="p-2.5 border rounded-md bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Meta Description</p>
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
            {copyResult && <ResultBox content={copyResult} label="Campaign Copy" />}
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
            <Button data-testid="button-generate-brief" onClick={handleGenerateBrief} disabled={briefMutation.isPending || !briefKeyword.trim()} className="w-full md:w-auto">
              {briefMutation.isPending ? "Generating..." : "Generate SEO Brief"}
            </Button>
            {briefResult && (
              <div className="p-4 border rounded-md bg-muted/30 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto" data-testid="text-seo-brief">{briefResult}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
