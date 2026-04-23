import { Link, useRoute } from "wouter";
import { ArrowLeft, Globe, Search, Megaphone, Users, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  useGetWebsite,
  useGetWebsiteAnalytics,
  useListKeywords,
  useListCampaigns,
  useListLeads,
  getGetWebsiteQueryKey,
  getGetWebsiteAnalyticsQueryKey,
  getListKeywordsQueryKey,
  getListCampaignsQueryKey,
  getListLeadsQueryKey,
} from "@workspace/api-client-react";

export default function WebsiteDetail() {
  const [, params] = useRoute("/websites/:id");
  const id = params?.id ? parseInt(params.id) : 0;

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
    </div>
  );
}
