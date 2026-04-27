import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Globe, Search, Megaphone, Users, Link2, ShieldCheck, AlertTriangle, Info, Loader2, Copy, Check, RefreshCw, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWebsite,
  useGetWebsiteAnalytics,
  useListKeywords,
  useListCampaigns,
  useListLeads,
  useRunSeoAudit,
  useListSeoAudits,
  useFixSeoIssue,
  useGetSettings,
  useListLinkSuggestions,
  useGenerateLinkSuggestions,
  getGetWebsiteQueryKey,
  getGetWebsiteAnalyticsQueryKey,
  getListKeywordsQueryKey,
  getListCampaignsQueryKey,
  getListLeadsQueryKey,
  getListSeoAuditsQueryKey,
  getListLinkSuggestionsQueryKey,
} from "@workspace/api-client-react";
import type { SeoAudit, SeoAuditIssue, LinkSuggestion } from "@workspace/api-client-react";

function severityIcon(severity: string) {
  if (severity === "critical") return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
  return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
}

function severityBadge(severity: string) {
  if (severity === "critical") return <Badge variant="destructive" className="text-xs">Critical</Badge>;
  if (severity === "warning") return <Badge className="text-xs bg-yellow-500 hover:bg-yellow-500">Warning</Badge>;
  return <Badge variant="outline" className="text-xs">Info</Badge>;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function scoreRingColor(score: number) {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#eab308";
  return "#ef4444";
}

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" className="rotate-[-90deg]">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={scoreRingColor(score)} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className={`absolute text-xl font-bold font-display ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}

function FixPanel({ issue, websiteUrl, websiteName }: { issue: SeoAuditIssue; websiteUrl: string; websiteName: string }) {
  const [fix, setFix] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fixMutation = useFixSeoIssue();
  const { data: aiSettings } = useGetSettings();
  const aiProvider = aiSettings?.aiProvider ?? "replit";
  const aiDisabled = aiSettings !== undefined && (!aiSettings.aiEnabled || (aiProvider !== "replit" && !aiSettings.aiApiKeyConfigured));

  const handleFix = () => {
    fixMutation.mutate({
      data: {
        issueTitle: issue.title,
        issueDescription: issue.description,
        recommendation: issue.recommendation,
        websiteUrl,
        websiteName,
        currentValue: issue.currentValue ?? undefined,
      }
    }, {
      onSuccess: (r) => setFix(r.fix),
    });
  };

  const handleCopy = () => {
    if (!fix) return;
    navigator.clipboard.writeText(fix).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-2 space-y-2">
      {!fix ? (
        <Button
          size="sm"
          variant="outline"
          onClick={handleFix}
          disabled={fixMutation.isPending || aiDisabled}
          className="text-xs"
          title={aiDisabled ? "AI is disabled — enable in Settings" : undefined}
        >
          {fixMutation.isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating fix...</> : <><ShieldCheck className="h-3 w-3 mr-1" /> Fix with AI</>}
        </Button>
      ) : (
        <div className="bg-muted/50 rounded-md p-3 text-xs space-y-2">
          <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">AI-Generated Fix</p>
          <p className="whitespace-pre-wrap">{fix}</p>
          <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={handleCopy}>
            {copied ? <><Check className="h-3 w-3 mr-1" /> Copied!</> : <><Copy className="h-3 w-3 mr-1" /> Copy</>}
          </Button>
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue, websiteUrl, websiteName }: { issue: SeoAuditIssue; websiteUrl: string; websiteName: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border rounded-md p-3 space-y-1">
      <div className="flex items-start gap-2 justify-between">
        <div className="flex items-start gap-2 min-w-0">
          {severityIcon(issue.severity)}
          <div className="min-w-0">
            <p className="text-sm font-medium">{issue.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
            {issue.currentValue && (
              <p className="text-xs text-muted-foreground mt-1 italic">Current: {issue.currentValue}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {severityBadge(issue.severity)}
          <Badge variant="outline" className="text-xs hidden sm:block">{issue.category}</Badge>
        </div>
      </div>
      <div className="ml-6">
        <p className="text-xs text-muted-foreground">{issue.recommendation}</p>
        <button
          className="text-xs text-primary hover:underline mt-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide fix" : "Fix with AI →"}
        </button>
        {expanded && (
          <FixPanel issue={issue} websiteUrl={websiteUrl} websiteName={websiteName} />
        )}
      </div>
    </div>
  );
}

function LinkSuggestionCard({ suggestion }: { suggestion: LinkSuggestion }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `Add a link on ${suggestion.sourcePage} to ${suggestion.targetPage} using anchor: "${suggestion.anchorText}"`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border rounded-md p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground truncate max-w-[200px]" title={suggestion.sourcePage}>
              {suggestion.sourcePage}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="text-xs font-medium text-muted-foreground truncate max-w-[200px]" title={suggestion.targetPage}>
              {suggestion.targetPage}
            </span>
          </div>
          <p className="text-sm font-medium">
            Anchor: <span className="text-primary">"{suggestion.anchorText}"</span>
          </p>
          <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
        </div>
        <Button size="sm" variant="ghost" className="text-xs h-7 px-2 shrink-0" onClick={handleCopy}>
          {copied ? <><Check className="h-3 w-3 mr-1" /> Copied!</> : <><Copy className="h-3 w-3 mr-1" /> Copy</>}
        </Button>
      </div>
    </div>
  );
}

function InternalLinksTab({ websiteId, websiteUrl, onSwitchToAudit }: { websiteId: number; websiteUrl: string; onSwitchToAudit: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: audits, isLoading: auditsLoading } = useListSeoAudits(websiteId, {
    query: { queryKey: getListSeoAuditsQueryKey(websiteId) }
  });
  const { data: suggestions, isLoading } = useListLinkSuggestions(websiteId, {
    query: { queryKey: getListLinkSuggestionsQueryKey(websiteId) }
  });
  const generateMutation = useGenerateLinkSuggestions();
  const { data: aiSettings } = useGetSettings();
  const aiProvider = aiSettings?.aiProvider ?? "replit";
  const aiDisabled = aiSettings !== undefined && (!aiSettings.aiEnabled || (aiProvider !== "replit" && !aiSettings.aiApiKeyConfigured));

  const hasAudit = audits && audits.length > 0;

  const handleGenerate = () => {
    generateMutation.mutate({ id: websiteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLinkSuggestionsQueryKey(websiteId) });
        toast({ title: "Link suggestions refreshed" });
      },
      onError: (err) => {
        const msg = (err as { message?: string })?.message ?? "Generation failed";
        toast({ title: "Failed to generate suggestions", description: msg, variant: "destructive" });
      },
    });
  };

  if (auditsLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!hasAudit) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Link2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No audit data yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Run an SEO audit first to enable AI-powered internal link recommendations.
          </p>
          <Button size="sm" variant="outline" onClick={onSwitchToAudit}>
            Go to SEO Audit tab
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">Internal Link Recommendations</h2>
          <p className="text-xs text-muted-foreground">
            AI-suggested links based on your crawled page data
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generateMutation.isPending || aiDisabled}
          title={aiDisabled ? "AI is disabled — enable in Settings" : undefined}
        >
          {generateMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" /> {suggestions && suggestions.length > 0 ? "Refresh" : "Generate"} Recommendations</>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !suggestions || suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Link2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">No recommendations yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Generate Recommendations" to analyze your site's crawl data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <LinkSuggestionCard key={s.id} suggestion={s} />
          ))}
          <p className="text-xs text-muted-foreground text-center pt-2">
            {suggestions.length} recommendation{suggestions.length !== 1 ? "s" : ""} — generated from crawl data for <a href={websiteUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{websiteUrl}</a>
          </p>
        </div>
      )}
    </div>
  );
}

function AuditTab({ websiteId, websiteUrl, websiteName }: { websiteId: number; websiteUrl: string; websiteName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: audits, isLoading: auditsLoading } = useListSeoAudits(websiteId, {
    query: { queryKey: getListSeoAuditsQueryKey(websiteId) }
  });
  const auditMutation = useRunSeoAudit();

  const latestAudit = audits?.[0];
  const minutesAgo = latestAudit ? Math.round((Date.now() - new Date(latestAudit.crawledAt).getTime()) / 60000) : null;

  const handleAudit = () => {
    auditMutation.mutate({ id: websiteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSeoAuditsQueryKey(websiteId) });
        queryClient.invalidateQueries({ queryKey: getGetWebsiteQueryKey(websiteId) });
        queryClient.invalidateQueries({ queryKey: getGetWebsiteAnalyticsQueryKey(websiteId) });
        toast({ title: "Audit complete" });
      },
      onError: (err) => {
        const msg = (err as { message?: string })?.message ?? "Audit failed";
        toast({ title: msg.includes("Crawl failed") ? "Could not reach the website" : "Audit failed", description: msg, variant: "destructive" });
      },
    });
  };

  const criticalIssues = (latestAudit?.issues ?? []).filter((i: SeoAuditIssue) => i.severity === "critical");
  const warningIssues = (latestAudit?.issues ?? []).filter((i: SeoAuditIssue) => i.severity === "warning");
  const infoIssues = (latestAudit?.issues ?? []).filter((i: SeoAuditIssue) => i.severity === "info");

  return (
    <div className="space-y-4">
      {/* Audit header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">SEO Audit</h2>
          {minutesAgo !== null && (
            <p className="text-xs text-muted-foreground">
              Last audited {minutesAgo < 1 ? "just now" : minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.round(minutesAgo / 60)}h ago`}
            </p>
          )}
        </div>
        <Button
          onClick={handleAudit}
          disabled={auditMutation.isPending}
          data-testid="button-run-audit"
          size="sm"
        >
          {auditMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Auditing...</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" /> {latestAudit ? "Re-run Audit" : "Audit Now"}</>
          )}
        </Button>
      </div>

      {auditsLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !latestAudit ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">No audits yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Audit Now" to crawl your website and get a full SEO report.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score card */}
          <Card>
            <CardContent className="pt-6 pb-4">
              <div className="flex items-center gap-6">
                <ScoreRing score={latestAudit.score} />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Overall SEO Score</p>
                  <p className="text-xs text-muted-foreground">
                    {latestAudit.score >= 70 ? "Good — keep up the work!" : latestAudit.score >= 40 ? "Needs improvement" : "Critical issues found"}
                  </p>
                  <div className="flex gap-3 text-xs mt-2">
                    {criticalIssues.length > 0 && <span className="text-red-600 font-medium">{criticalIssues.length} critical</span>}
                    {warningIssues.length > 0 && <span className="text-yellow-600 font-medium">{warningIssues.length} warnings</span>}
                    {infoIssues.length > 0 && <span className="text-blue-600 font-medium">{infoIssues.length} info</span>}
                  </div>
                </div>
                {audits && audits.length > 1 && (
                  <div className="ml-auto text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground mb-1">Score Trend</p>
                    <div className="flex items-end gap-1 h-8 justify-end">
                      {audits.slice(0, 7).reverse().map((a: SeoAudit, i: number) => (
                        <div
                          key={a.id}
                          title={`Score: ${a.score}`}
                          className="w-3 rounded-sm"
                          style={{
                            height: `${Math.max(4, (a.score / 100) * 32)}px`,
                            background: scoreRingColor(a.score),
                            opacity: i === audits.slice(0, 7).length - 1 ? 1 : 0.5,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Issues list */}
          {latestAudit.issues.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No issues found — excellent!</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {criticalIssues.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-2">Critical ({criticalIssues.length})</h3>
                  <div className="space-y-2">
                    {criticalIssues.map((issue: SeoAuditIssue) => (
                      <IssueCard key={issue.id} issue={issue} websiteUrl={websiteUrl} websiteName={websiteName} />
                    ))}
                  </div>
                </div>
              )}
              {warningIssues.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-yellow-600 mb-2">Warnings ({warningIssues.length})</h3>
                  <div className="space-y-2">
                    {warningIssues.map((issue: SeoAuditIssue) => (
                      <IssueCard key={issue.id} issue={issue} websiteUrl={websiteUrl} websiteName={websiteName} />
                    ))}
                  </div>
                </div>
              )}
              {infoIssues.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">Info ({infoIssues.length})</h3>
                  <div className="space-y-2">
                    {infoIssues.map((issue: SeoAuditIssue) => (
                      <IssueCard key={issue.id} issue={issue} websiteUrl={websiteUrl} websiteName={websiteName} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function WebsiteDetail() {
  const [, params] = useRoute("/websites/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const [activeTab, setActiveTab] = useState("overview");

  const { data: website, isLoading: websiteLoading } = useGetWebsite(id, {
    query: { enabled: !!id, queryKey: getGetWebsiteQueryKey(id) }
  });
  const { data: analytics, isLoading: analyticsLoading } = useGetWebsiteAnalytics(id, {
    query: { enabled: !!id, queryKey: getGetWebsiteAnalyticsQueryKey(id) }
  });
  const { data: keywords, isLoading: keywordsLoading } = useListKeywords({ websiteId: id }, {
    query: { enabled: !!id, queryKey: getListKeywordsQueryKey({ websiteId: id }) }
  });
  const { data: campaigns, isLoading: campaignsLoading } = useListCampaigns({ websiteId: id }, {
    query: { enabled: !!id, queryKey: getListCampaignsQueryKey({ websiteId: id }) }
  });
  const { data: leads, isLoading: leadsLoading } = useListLeads({ websiteId: id }, {
    query: { enabled: !!id, queryKey: getListLeadsQueryKey({ websiteId: id }) }
  });

  if (websiteLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (!website) {
    return (
      <div className="p-6">
        <Link href="/websites" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-websites"><ArrowLeft className="h-4 w-4" /> Back to Websites</Link>
        <div className="text-center py-16"><p className="text-muted-foreground">Website not found.</p></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link href="/websites" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3" data-testid="link-back-websites">
          <ArrowLeft className="h-4 w-4" /> Back to Websites
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display" data-testid="text-website-name">{website.name}</h1>
            <a href={website.url} target="_blank" rel="noreferrer" data-testid="link-website-url" className="text-sm text-primary hover:underline">{website.url}</a>
          </div>
          <Badge variant={website.status === "active" ? "default" : "secondary"} className="mt-1">{website.status}</Badge>
        </div>
        {website.niche && <p className="text-sm text-muted-foreground mt-1">Niche: {website.niche}</p>}
        {website.notes && <p className="text-sm text-muted-foreground mt-1">{website.notes}</p>}
      </div>

      {/* Analytics summary */}
      {analyticsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">SEO Score</p>
              <p className="text-2xl font-bold font-display mt-1">{analytics.seoScore ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Keywords</p>
              <p className="text-2xl font-bold font-display mt-1">{analytics.keywordsTracked}</p>
              <p className="text-xs text-muted-foreground">{analytics.topRankKeywords} in top 10</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Leads</p>
              <p className="text-2xl font-bold font-display mt-1">{analytics.totalLeads}</p>
              <p className="text-xs text-muted-foreground">{analytics.convertedLeads} converted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Backlinks</p>
              <p className="text-2xl font-bold font-display mt-1">{analytics.backlinkOpportunities}</p>
              <p className="text-xs text-muted-foreground">{analytics.securedBacklinks} secured</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-seo-audit">SEO Audit</TabsTrigger>
          <TabsTrigger value="internal-links" data-testid="tab-internal-links">Internal Links</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Keywords table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Keywords</CardTitle>
                <Link href="/keywords" className="text-xs text-primary hover:underline" data-testid="link-manage-keywords">Manage all</Link>
              </div>
            </CardHeader>
            <CardContent>
              {keywordsLoading ? <Skeleton className="h-20 w-full" /> : (keywords ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No keywords tracked</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-left py-2 font-medium">Keyword</th>
                        <th className="text-right py-2 font-medium">Rank</th>
                        <th className="text-right py-2 font-medium">Volume</th>
                        <th className="text-right py-2 font-medium">Difficulty</th>
                        <th className="text-right py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(keywords ?? []).slice(0, 8).map(kw => (
                        <tr key={kw.id} data-testid={`row-keyword-${kw.id}`} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 font-medium">{kw.keyword}</td>
                          <td className="text-right py-2">{kw.currentRank ?? "—"}</td>
                          <td className="text-right py-2">{kw.searchVolume?.toLocaleString() ?? "—"}</td>
                          <td className="text-right py-2">{kw.difficulty ?? "—"}</td>
                          <td className="text-right py-2">
                            <Badge variant={kw.status === "tracking" ? "default" : "secondary"} className="text-xs">{kw.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaigns table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Campaigns</CardTitle>
                <Link href="/campaigns" className="text-xs text-primary hover:underline" data-testid="link-manage-campaigns">Manage all</Link>
              </div>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? <Skeleton className="h-20 w-full" /> : (campaigns ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No campaigns</p>
              ) : (
                <div className="space-y-2">
                  {(campaigns ?? []).slice(0, 5).map(c => (
                    <div key={c.id} data-testid={`row-campaign-${c.id}`} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.type} · {c.goal}</p>
                      </div>
                      <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-xs">{c.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leads table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Leads</CardTitle>
                <Link href="/leads" className="text-xs text-primary hover:underline" data-testid="link-manage-leads">Manage all</Link>
              </div>
            </CardHeader>
            <CardContent>
              {leadsLoading ? <Skeleton className="h-20 w-full" /> : (leads ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No leads yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-left py-2 font-medium">Name</th>
                        <th className="text-left py-2 font-medium">Source</th>
                        <th className="text-right py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(leads ?? []).slice(0, 8).map(l => (
                        <tr key={l.id} data-testid={`row-lead-${l.id}`} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 font-medium">{l.name}</td>
                          <td className="py-2 text-muted-foreground">{l.source}</td>
                          <td className="text-right py-2">
                            <Badge variant="secondary" className="text-xs">{l.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditTab websiteId={id} websiteUrl={website.url} websiteName={website.name} />
        </TabsContent>

        <TabsContent value="internal-links" className="mt-4">
          <InternalLinksTab websiteId={id} websiteUrl={website.url} onSwitchToAudit={() => setActiveTab("audit")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
