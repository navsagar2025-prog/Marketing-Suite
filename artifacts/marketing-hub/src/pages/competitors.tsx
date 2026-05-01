import { useState, useEffect } from "react";
import { useRunCompetitorAnalysis, useGetCompetitorHistory, useListWebsites, useCreateKeyword } from "@workspace/api-client-react";
import type { CompetitorAnalysisResult, CompetitorGapOpportunity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Globe, Search, TrendingUp, BookOpen, Target, Sparkles, Clock, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetSettings } from "@workspace/api-client-react";

const INTENT_COLORS: Record<string, string> = {
  informational: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  commercial: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  navigational: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  transactional: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

function DifficultyBar({ value }: { value: number }) {
  const color = value <= 30 ? "bg-green-500" : value <= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{value}</span>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
        <Sparkles className="h-4 w-4" />
        <span>Analysing domain with AI…</span>
      </div>
      {[1, 2, 3, 4].map(i => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map(j => (
              <div key={j} className="flex gap-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AiEstimateBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 font-medium">
      <Sparkles className="h-2.5 w-2.5" />
      AI Estimate
    </span>
  );
}

export default function CompetitorsPage() {
  const { toast } = useToast();
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<CompetitorAnalysisResult | null>(null);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>("");
  const [trackedKeywords, setTrackedKeywords] = useState<Set<string>>(new Set());

  const { data: settings } = useGetSettings();
  const aiEnabled = settings?.aiEnabled ?? true;

  const { data: websites } = useListWebsites();
  const { data: history, refetch: refetchHistory } = useGetCompetitorHistory();
  const analyseMutation = useRunCompetitorAnalysis();
  const createKeyword = useCreateKeyword();

  useEffect(() => {
    if (websites && websites.length === 1 && !selectedWebsiteId) {
      setSelectedWebsiteId(String(websites[0].id));
    }
  }, [websites, selectedWebsiteId]);

  function handleAnalyse() {
    if (!domain.trim()) return;
    analyseMutation.mutate(
      { data: { domain: domain.trim() } },
      {
        onSuccess: (data) => {
          setResult(data);
          setTrackedKeywords(new Set());
          refetchHistory();
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Analysis failed";
          toast({ title: "Analysis failed", description: msg, variant: "destructive" });
        },
      }
    );
  }

  function handleLoadHistory(item: NonNullable<typeof history>[number]) {
    setResult({
      sessionId: item.id,
      domain: item.domain,
      fromCache: true,
      domainOverview: item.domainOverview,
      keywordThemes: item.keywordThemes,
      contentTopics: item.contentTopics,
      gapOpportunities: item.gapOpportunities,
      createdAt: item.createdAt,
    });
    setDomain(item.domain);
    setTrackedKeywords(new Set());
  }

  function handleTrack(kw: CompetitorGapOpportunity) {
    const websiteId = selectedWebsiteId ? parseInt(selectedWebsiteId) : undefined;
    createKeyword.mutate(
      { data: { keyword: kw.keyword, websiteId } },
      {
        onSuccess: () => {
          setTrackedKeywords(prev => new Set([...prev, kw.keyword]));
          toast({ title: "Keyword tracked", description: `"${kw.keyword}" added to your keywords.` });
        },
        onError: () => {
          toast({ title: "Failed to track keyword", variant: "destructive" });
        },
      }
    );
  }

  function handleTrackAll() {
    if (!result) return;
    const untracked = result.gapOpportunities.filter(g => !trackedKeywords.has(g.keyword));
    if (untracked.length === 0) return;
    let done = 0;
    const websiteId = selectedWebsiteId ? parseInt(selectedWebsiteId) : undefined;
    untracked.forEach(kw => {
      createKeyword.mutate(
        { data: { keyword: kw.keyword, websiteId } },
        {
          onSuccess: () => {
            setTrackedKeywords(prev => new Set([...prev, kw.keyword]));
            done++;
            if (done === untracked.length) {
              toast({ title: `${done} keywords added to tracking` });
            }
          },
        }
      );
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Competitor Analysis</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Enter any domain to get an AI-powered breakdown of their keyword strategy.
        </p>
      </div>

      {/* Search form */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="semrush.com"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAnalyse()}
                className="pl-9"
              />
            </div>
            <Button
              onClick={handleAnalyse}
              disabled={!domain.trim() || analyseMutation.isPending || !aiEnabled}
            >
              {analyseMutation.isPending ? (
                <><Sparkles className="h-4 w-4 mr-2 animate-pulse" />Analysing…</>
              ) : (
                <><Search className="h-4 w-4 mr-2" />Analyse</>
              )}
            </Button>
          </div>

          {!aiEnabled && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              AI is disabled. Enable it in <a href="/settings" className="underline">Settings</a> to run analyses.
            </p>
          )}

          {/* History chips */}
          {history && history.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Recent:
              </span>
              {history.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleLoadHistory(item)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-accent transition-colors"
                >
                  {item.domain}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {analyseMutation.isPending && <AnalysisSkeleton />}

      {/* Results */}
      {result && !analyseMutation.isPending && (
        <div className="space-y-5">
          {/* Cache notice */}
          {result.fromCache && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
              <Clock className="h-3.5 w-3.5" />
              Showing cached analysis from {new Date(result.createdAt).toLocaleDateString()} — valid for 24 hours.
            </div>
          )}

          {/* Domain Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Domain Overview — {result.domain}
                <AiEstimateBadge />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{result.domainOverview.authority}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Domain Authority</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-lg font-bold">{result.domainOverview.trafficBand}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Monthly Traffic</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center col-span-1">
                  <div className="text-sm font-semibold truncate">{result.domainOverview.niche}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Niche</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center col-span-1">
                  <div className="text-sm font-semibold truncate">{result.domainOverview.industry}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Industry</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.domainOverview.summary}</p>
            </CardContent>
          </Card>

          {/* Keyword Themes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Top Keyword Themes
                <AiEstimateBadge />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {result.keywordThemes.map((theme, i) => (
                  <div key={i} className="flex items-start gap-3 px-6 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{theme.theme}</span>
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", INTENT_COLORS[theme.intent])}>
                          {theme.intent}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{theme.volumeBand}/mo</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{theme.description}</p>
                    </div>
                    <DifficultyBar value={theme.difficulty} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content Topics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Top Content Topics
                <AiEstimateBadge />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {result.contentTopics.map((topic, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/20 p-3">
                    <div className="font-medium text-sm">{topic.topic}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{topic.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Gap Opportunities */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Keyword Gap Opportunities
                  <AiEstimateBadge />
                </CardTitle>
                <div className="flex items-center gap-2">
                  {websites && websites.length > 1 && (
                    <Select value={selectedWebsiteId} onValueChange={setSelectedWebsiteId}>
                      <SelectTrigger className="h-8 text-xs w-40">
                        <SelectValue placeholder="Select website" />
                      </SelectTrigger>
                      <SelectContent>
                        {websites.map(w => (
                          <SelectItem key={w.id} value={String(w.id)}>{w.domain}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTrackAll}
                    disabled={result.gapOpportunities.every(g => trackedKeywords.has(g.keyword))}
                  >
                    Add all to tracking
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {result.gapOpportunities.map((gap, i) => {
                  const isTracked = trackedKeywords.has(gap.keyword);
                  return (
                    <div key={i} className="flex items-center gap-3 px-6 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{gap.keyword}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", INTENT_COLORS[gap.intent])}>
                            {gap.intent}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{gap.volumeBand}/mo</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{gap.rationale}</p>
                      </div>
                      <DifficultyBar value={gap.difficulty} />
                      <Button
                        size="sm"
                        variant={isTracked ? "ghost" : "outline"}
                        className={cn("shrink-0 h-7 text-xs", isTracked && "text-green-600 dark:text-green-400")}
                        onClick={() => !isTracked && handleTrack(gap)}
                        disabled={isTracked}
                      >
                        {isTracked ? (
                          <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Tracked</>
                        ) : (
                          "Track"
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
