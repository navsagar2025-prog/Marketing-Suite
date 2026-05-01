import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Globe, Search, Megaphone, Users, Link2, ShieldCheck, AlertTriangle, Info, Loader2, Copy, Check, RefreshCw, TrendingUp, Plus, Trash2, Crosshair, Activity, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  useListCompetitors,
  useAddCompetitor,
  useDeleteCompetitor,
  useAnalyseCompetitor,
  useCreateKeyword,
  useStartSiteAudit,
  useGetSiteAuditStatus,
  useGetSiteAuditResults,
  getGetWebsiteQueryKey,
  getGetWebsiteAnalyticsQueryKey,
  getListKeywordsQueryKey,
  getListCampaignsQueryKey,
  getListLeadsQueryKey,
  getListSeoAuditsQueryKey,
  getListLinkSuggestionsQueryKey,
  getListCompetitorsQueryKey,
  getGetSiteAuditStatusQueryKey,
  getGetSiteAuditResultsQueryKey,
} from "@workspace/api-client-react";
import type { SeoAudit, SeoAuditIssue, LinkSuggestion, CompetitorAnalysis, SiteAuditIssueResult, SiteAuditPageResult } from "@workspace/api-client-react";
import SearchPerformanceTab from "@/components/SearchPerformanceTab";

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
          {copied ? <><Check className="h-3 w-3 mr-1" /> Copied!</> : <><Copy className="h-3 w-3 mr-1" /> Copy suggestion</>}
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
  const auditMutation = useRunSeoAudit();
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
    const handleRunAudit = () => {
      auditMutation.mutate({ id: websiteId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSeoAuditsQueryKey(websiteId) });
          toast({ title: "Audit complete — you can now generate link recommendations" });
        },
        onError: (err) => {
          const msg = (err as { message?: string })?.message ?? "Audit failed";
          toast({ title: "Audit failed", description: msg, variant: "destructive" });
        },
      });
    };

    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Link2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No audit data yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Run an SEO audit first to enable AI-powered internal link recommendations.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button size="sm" onClick={handleRunAudit} disabled={auditMutation.isPending}>
              {auditMutation.isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Auditing...</> : "Run Audit Now"}
            </Button>
            <Button size="sm" variant="outline" onClick={onSwitchToAudit}>
              Go to SEO Audit tab
            </Button>
          </div>
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

function SiteIssueBadge({ severity }: { severity: string }) {
  if (severity === "critical") return <Badge variant="destructive" className="text-xs shrink-0">Critical</Badge>;
  if (severity === "warning") return <Badge className="text-xs bg-yellow-500 hover:bg-yellow-500 shrink-0">Warning</Badge>;
  return <Badge variant="outline" className="text-xs shrink-0">Info</Badge>;
}

function SiteIssueRow({ issue }: { issue: SiteAuditIssueResult }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b last:border-0 py-2 px-3">
      <div className="flex items-start gap-2 justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <SiteIssueBadge severity={issue.severity} />
            <code className="text-xs bg-muted px-1 py-0.5 rounded text-muted-foreground shrink-0">
              {issue.issueType}
            </code>
            <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={issue.pageUrl}>
              {issue.pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}
            </span>
          </div>
          <p className="text-sm font-medium mt-0.5">{issue.description}</p>
          {expanded && (
            <p className="text-xs text-muted-foreground mt-1">{issue.recommendation}</p>
          )}
        </div>
        <button
          className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          onClick={() => setExpanded(!expanded)}
          aria-label="toggle recommendation"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

const ISSUE_CATEGORIES: Record<string, string> = {
  broken_link: "Technical",
  unreachable: "Technical",
  redirect: "Technical",
  redirect_chain: "Technical",
  slow_page: "Technical",
  robots_blocked: "Technical",
  missing_title: "Content",
  title_too_short: "Content",
  title_too_long: "Content",
  missing_h1: "Content",
  multiple_h1: "Content",
  thin_content: "Content",
  missing_meta_description: "Meta",
  meta_description_too_long: "Meta",
  duplicate_title: "Meta",
  duplicate_meta_description: "Meta",
  noindex: "Indexing",
  missing_canonical: "Indexing",
  missing_alt_text: "Accessibility",
};

function SitePageRow({ page }: { page: SiteAuditPageResult }) {
  const score = page.score ?? 0;
  const scoreColor = score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600";
  const statusColor = (page.statusCode ?? 0) >= 400 ? "text-red-600" : (page.statusCode ?? 0) >= 300 ? "text-yellow-600" : "text-muted-foreground";
  const metaLen = page.metaDescription ? page.metaDescription.length : null;
  const metaColor = metaLen == null ? "text-red-500" : metaLen > 160 ? "text-yellow-600" : metaLen < 70 ? "text-yellow-600" : "text-muted-foreground";

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20">
      <td className="py-2 px-3 max-w-[240px]">
        <div className="flex items-center gap-1">
          <a
            href={page.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline truncate block"
            title={page.url}
          >
            {page.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
          </a>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </div>
        {page.title && <p className="text-xs text-muted-foreground truncate">{page.title}</p>}
      </td>
      <td className={`py-2 px-3 text-xs text-right font-mono ${statusColor}`}>{page.statusCode ?? "—"}</td>
      <td className={`py-2 px-3 text-xs text-right font-semibold ${scoreColor}`}>{page.score ?? "—"}</td>
      <td className="py-2 px-3 text-xs text-right text-muted-foreground">{page.issueCount}</td>
      <td className={`py-2 px-3 text-xs text-right ${metaColor}`}>
        {metaLen != null ? `${metaLen}ch` : "—"}
      </td>
      <td className="py-2 px-3 text-xs text-right text-muted-foreground">
        {page.responseTimeMs != null ? `${(page.responseTimeMs / 1000).toFixed(1)}s` : "—"}
      </td>
    </tr>
  );
}

function SiteAuditTab({ websiteId }: { websiteId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [issueFilter, setIssueFilter] = useState<"all" | "critical" | "warning" | "info">("all");

  const startMutation = useStartSiteAudit();

  const { data: status } = useGetSiteAuditStatus(websiteId, {
    query: {
      queryKey: getGetSiteAuditStatusQueryKey(websiteId),
      retry: false,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data && (data.status === "crawling" || data.status === "queued")) return 2000;
        return false;
      },
    },
  });

  const isCrawling = status?.status === "crawling" || status?.status === "queued";

  const hasAudit = !!status;
  const { data: results } = useGetSiteAuditResults(websiteId, {
    query: {
      queryKey: getGetSiteAuditResultsQueryKey(websiteId),
      enabled: hasAudit,
      retry: false,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data && (data.status === "crawling" || data.status === "queued")) return 3000;
        return false;
      },
    },
  });

  const handleStart = () => {
    startMutation.mutate(
      { websiteId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSiteAuditStatusQueryKey(websiteId) });
          toast({ title: "Site audit started — crawling your website..." });
        },
        onError: (err) => {
          const msg = (err as { message?: string })?.message ?? "Failed to start audit";
          if (msg.includes("already in progress")) {
            toast({ title: "Crawl already running", description: "Wait for the current crawl to finish.", variant: "destructive" });
          } else {
            toast({ title: "Failed to start audit", description: msg, variant: "destructive" });
          }
        },
      }
    );
  };

  const issues = results?.issues ?? [];
  const pages = results?.pages ?? [];

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  const filteredIssues = issueFilter === "all" ? issues : issues.filter((i) => i.severity === issueFilter);

  const progressPct = status && status.pagesFound > 0
    ? Math.min(100, Math.round((status.pagesCrawled / status.pagesFound) * 100))
    : 0;

  const healthScore = results?.healthScore ?? status?.healthScore;
  const lastAuditTime = status?.completedAt
    ? new Date(status.completedAt)
    : status?.createdAt
    ? new Date(status.createdAt)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">Full Site Audit</h2>
          {lastAuditTime && status?.status === "complete" && (
            <p className="text-xs text-muted-foreground">
              Last crawled {Math.round((Date.now() - lastAuditTime.getTime()) / 60000)} min ago
              · {status.pagesCrawled} page{status.pagesCrawled !== 1 ? "s" : ""} scanned
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleStart}
          disabled={startMutation.isPending || isCrawling}
          data-testid="button-run-site-audit"
        >
          {isCrawling ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Crawling...</>
          ) : startMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting...</>
          ) : status?.status === "complete" ? (
            <><RefreshCw className="h-4 w-4 mr-2" /> Re-crawl Site</>
          ) : (
            <><Activity className="h-4 w-4 mr-2" /> Run Full Audit</>
          )}
        </Button>
      </div>

      {/* Crawl progress */}
      {isCrawling && (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Crawling your website...</p>
              <span className="text-xs text-muted-foreground">{progressPct}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.pagesCrawled ?? 0} pages crawled of {status?.pagesFound ?? 0} found
            </p>
          </CardContent>
        </Card>
      )}

      {/* Failed state */}
      {status?.status === "failed" && (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-500 opacity-70" />
            <p className="text-sm font-medium text-red-600">Crawl failed</p>
            <p className="text-xs text-muted-foreground">The crawler could not reach your website. Check your website URL and try again.</p>
          </CardContent>
        </Card>
      )}

      {/* No audit yet */}
      {!status && !startMutation.isPending && (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No site audit yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Run Full Audit" to crawl your entire website and find technical SEO issues.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results — shown even during crawl for partial data */}
      {results && results.pages.length > 0 && (
        <div className="space-y-4">
          {/* Health score + summary */}
          <Card>
            <CardContent className="pt-6 pb-4">
              <div className="flex items-center gap-6 flex-wrap">
                <ScoreRing score={healthScore ?? 0} />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Site Health Score</p>
                    {isCrawling && <Badge variant="outline" className="text-xs">Partial</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isCrawling ? "Crawl in progress — results updating..." : (healthScore ?? 0) >= 70 ? "Good overall health" : (healthScore ?? 0) >= 40 ? "Needs attention" : "Critical issues detected"}
                  </p>
                  {/* Severity breakdown */}
                  <div className="flex gap-3 text-xs mt-2 flex-wrap">
                    {criticalCount > 0 && <span className="text-red-600 font-medium">{criticalCount} critical</span>}
                    {warningCount > 0 && <span className="text-yellow-600 font-medium">{warningCount} warnings</span>}
                    {infoCount > 0 && <span className="text-blue-600 font-medium">{infoCount} info</span>}
                    {issues.length === 0 && <span className="text-green-600 font-medium">No issues found!</span>}
                  </div>
                  {/* Category breakdown */}
                  {issues.length > 0 && (() => {
                    const cats: Record<string, number> = {};
                    for (const iss of issues) {
                      const cat = ISSUE_CATEGORIES[iss.issueType] ?? "Other";
                      cats[cat] = (cats[cat] ?? 0) + 1;
                    }
                    return (
                      <div className="flex gap-3 text-xs mt-1 flex-wrap">
                        {Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                          <span key={cat} className="text-muted-foreground">{cat}: <span className="font-medium text-foreground">{count}</span></span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="ml-auto text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Pages scanned</p>
                  <p className="text-2xl font-bold font-display">{results.pagesCrawled}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Issues */}
          {issues.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm">Issues ({issues.length})</CardTitle>
                  <div className="flex items-center gap-1 flex-wrap">
                    {(["all", "critical", "warning", "info"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setIssueFilter(f)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          issueFilter === f
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-muted hover:border-muted-foreground text-muted-foreground"
                        }`}
                      >
                        {f === "all" ? `All (${issues.length})` : f === "critical" ? `Critical (${criticalCount})` : f === "warning" ? `Warning (${warningCount})` : `Info (${infoCount})`}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y-0 max-h-[400px] overflow-y-auto">
                  {filteredIssues.slice(0, 200).map((issue) => (
                    <SiteIssueRow key={issue.id} issue={issue} />
                  ))}
                  {filteredIssues.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No {issueFilter} issues found.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Page inventory */}
          {pages.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Page Inventory ({pages.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">Page</th>
                        <th className="text-right py-2 px-3 font-medium">Status</th>
                        <th className="text-right py-2 px-3 font-medium">Score</th>
                        <th className="text-right py-2 px-3 font-medium">Issues</th>
                        <th className="text-right py-2 px-3 font-medium">Meta Desc</th>
                        <th className="text-right py-2 px-3 font-medium">Load time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pages.slice(0, 500).map((page) => (
                        <SitePageRow key={page.id} page={page} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function CompetitorCard({
  competitor,
  websiteId,
  trackedKeywordIds,
  onDeleted,
  onAnalysed,
}: {
  competitor: CompetitorAnalysis;
  websiteId: number;
  trackedKeywordIds: Set<string>;
  onDeleted: () => void;
  onAnalysed: (updated: CompetitorAnalysis) => void;
}) {
  const { toast } = useToast();
  const deleteMutation = useDeleteCompetitor();
  const analyseMutation = useAnalyseCompetitor();
  const createKeyword = useCreateKeyword();
  const queryClient = useQueryClient();
  const { data: aiSettings } = useGetSettings();
  const aiProvider = aiSettings?.aiProvider ?? "replit";
  const aiDisabled = aiSettings !== undefined && (!aiSettings.aiEnabled || (aiProvider !== "replit" && !aiSettings.aiApiKeyConfigured));

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: websiteId, competitorId: competitor.id },
      {
        onSuccess: () => {
          toast({ title: "Competitor removed" });
          onDeleted();
        },
        onError: () => toast({ title: "Failed to remove competitor", variant: "destructive" }),
      }
    );
  };

  const handleAnalyse = () => {
    analyseMutation.mutate(
      { id: websiteId, competitorId: competitor.id },
      {
        onSuccess: (updated) => {
          toast({ title: "Gap analysis complete" });
          onAnalysed(updated);
        },
        onError: (err) => {
          const msg = (err as { message?: string })?.message ?? "Analysis failed";
          toast({ title: "Analysis failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleAddKeyword = (keyword: string) => {
    createKeyword.mutate(
      { data: { websiteId, keyword, status: "tracking" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey({ websiteId }) });
          toast({ title: `"${keyword}" added to tracked keywords` });
        },
        onError: () => toast({ title: `Failed to add "${keyword}"`, variant: "destructive" }),
      }
    );
  };

  const analysis = competitor.analysisJson as { summary?: string; gapKeywords?: Array<{ keyword: string; reason: string; priority: number }> } | null;

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <a
              href={competitor.competitorUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary hover:underline truncate block"
            >
              {competitor.competitorUrl}
            </a>
            <p className="text-xs text-muted-foreground mt-0.5">
              {analysis
                ? `Analysed ${new Date(competitor.createdAt).toLocaleDateString()}`
                : "Not yet analysed"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAnalyse}
              disabled={analyseMutation.isPending || aiDisabled}
              title={aiDisabled ? "AI is disabled — enable in Settings" : undefined}
              data-testid={`button-analyse-competitor-${competitor.id}`}
            >
              {analyseMutation.isPending ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analysing...</>
              ) : (
                <><RefreshCw className="h-3 w-3 mr-1" /> {analysis ? "Re-analyse" : "Analyse"}</>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-competitor-${competitor.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {analysis && (
          <div className="space-y-3 pt-1">
            {analysis.summary && (
              <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-muted pl-3">
                {analysis.summary}
              </p>
            )}
            {analysis.gapKeywords && analysis.gapKeywords.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Keyword Gap Opportunities ({analysis.gapKeywords.length})
                </p>
                {analysis.gapKeywords.map((gap, i) => {
                  const alreadyTracked = trackedKeywordIds.has(gap.keyword.toLowerCase());
                  const priorityColors: Record<number, string> = {
                    1: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                    2: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                    3: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
                    4: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
                    5: "bg-muted text-muted-foreground",
                  };
                  const priorityClass = priorityColors[gap.priority] ?? priorityColors[3];
                  return (
                    <div key={i} className="border rounded-md p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{gap.keyword}</p>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${priorityClass}`}>
                              P{gap.priority}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{gap.reason}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={alreadyTracked ? "secondary" : "outline"}
                          className="text-xs h-7 px-2 shrink-0"
                          onClick={() => handleAddKeyword(gap.keyword)}
                          disabled={alreadyTracked || createKeyword.isPending}
                          title={alreadyTracked ? "Already tracked" : "Add to tracked keywords"}
                          data-testid={`button-add-keyword-${i}`}
                        >
                          {alreadyTracked ? (
                            <><Check className="h-3 w-3 mr-1" /> Tracked</>
                          ) : (
                            <><Plus className="h-3 w-3 mr-1" /> Add keyword</>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompetitorsTab({ websiteId }: { websiteId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [urlInput, setUrlInput] = useState("");
  const { data: competitors, isLoading } = useListCompetitors(websiteId, {
    query: { queryKey: getListCompetitorsQueryKey(websiteId) },
  });
  const { data: keywords } = useListKeywords({ websiteId }, {
    query: { queryKey: getListKeywordsQueryKey({ websiteId }) },
  });
  const addMutation = useAddCompetitor();

  const trackedKeywordIds = new Set(
    (keywords ?? []).map((k) => k.keyword.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    let normalised = url;
    if (!/^https?:\/\//i.test(normalised)) normalised = `https://${normalised}`;
    addMutation.mutate(
      { id: websiteId, data: { competitorUrl: normalised } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCompetitorsQueryKey(websiteId) });
          setUrlInput("");
          toast({ title: "Competitor added" });
        },
        onError: (err) => {
          const msg = (err as { message?: string })?.message ?? "Failed to add competitor";
          const isMax = msg.includes("Maximum 3");
          toast({
            title: isMax ? "Maximum 3 competitors reached" : "Failed to add competitor",
            description: isMax ? "Remove an existing competitor to add a new one." : msg,
            variant: "destructive",
          });
        },
      }
    );
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListCompetitorsQueryKey(websiteId) });
  };

  const atMax = (competitors?.length ?? 0) >= 3;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">Competitor Analysis</h2>
          <p className="text-xs text-muted-foreground">
            Track up to 3 competitors and find keyword gaps with AI
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <Input
          placeholder="https://competitor.com"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          className="flex-1 text-sm"
          disabled={addMutation.isPending || atMax}
          data-testid="input-competitor-url"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!urlInput.trim() || addMutation.isPending || atMax}
          data-testid="button-add-competitor"
        >
          {addMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <><Plus className="h-4 w-4 mr-1" /> Add</>
          )}
        </Button>
      </form>
      {atMax && (
        <p className="text-xs text-muted-foreground">Maximum 3 competitors reached. Remove one to add another.</p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !competitors || competitors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Crosshair className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No competitors tracked yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a competitor URL above to start finding keyword gaps.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {competitors.map((c) => (
            <CompetitorCard
              key={c.id}
              competitor={c}
              websiteId={websiteId}
              trackedKeywordIds={trackedKeywordIds}
              onDeleted={invalidate}
              onAnalysed={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WebsiteDetail() {
  const [, params] = useRoute("/websites/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const initialTab = new URLSearchParams(window.location.search).get("tab") ?? "overview";
  const [activeTab, setActiveTab] = useState(initialTab);

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
          <TabsTrigger value="site-audit" data-testid="tab-site-audit">Full Site Audit</TabsTrigger>
          <TabsTrigger value="internal-links" data-testid="tab-internal-links">Internal Links</TabsTrigger>
          <TabsTrigger value="competitors" data-testid="tab-competitors">Competitors</TabsTrigger>
          <TabsTrigger value="search-performance" data-testid="tab-search-performance">Search Performance</TabsTrigger>
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

        <TabsContent value="site-audit" className="mt-4">
          <SiteAuditTab websiteId={id} />
        </TabsContent>

        <TabsContent value="internal-links" className="mt-4">
          <InternalLinksTab websiteId={id} websiteUrl={website.url} onSwitchToAudit={() => setActiveTab("audit")} />
        </TabsContent>

        <TabsContent value="competitors" className="mt-4">
          <CompetitorsTab websiteId={id} />
        </TabsContent>

        <TabsContent value="search-performance" className="mt-4">
          <SearchPerformanceTab websiteId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
