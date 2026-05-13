import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, Target, Globe, Users, Wifi, Download, Calendar,
  Eye, ArrowUpRight, ArrowDownRight, Minus, MousePointerClick,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  useGetLeadsFunnel,
  useGetCampaignAnalytics,
  useListWebsites,
} from "@workspace/api-client-react";
import { Ga4TrafficPanel } from "@/components/Ga4TrafficPanel";

const COLORS = [
  "#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#ef4444",
];
const CHANNEL_COLORS: Record<string, string> = {
  Organic: "#10b981",
  Direct: "#0ea5e9",
  Social: "#6366f1",
  Referral: "#f59e0b",
  Email: "#ec4899",
};

type DateRange = "7d" | "30d" | "90d" | "1y" | "all";

const DATE_RANGE_OPTIONS: { value: DateRange; label: string; days: number }[] = [
  { value: "7d", label: "7d", days: 7 },
  { value: "30d", label: "30d", days: 30 },
  { value: "90d", label: "90d", days: 90 },
  { value: "1y", label: "1y", days: 365 },
  { value: "all", label: "All", days: 365 },
];

function getDateRangeParams(range: DateRange): { from?: string; to?: string; days: number } {
  const opt = DATE_RANGE_OPTIONS.find(o => o.value === range) ?? DATE_RANGE_OPTIONS[1];
  if (range === "all") return { days: 365 };
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - opt.days);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
    days: opt.days,
  };
}

function downloadCsv(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (days <= 7) return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (days <= 90) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted-foreground">—</span>;
  if (previous === 0) return <span className="text-xs text-emerald-500 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />New</span>;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 1) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />0%</span>;
  const up = pct > 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${up ? "text-emerald-500" : "text-red-500"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function apiGet(path: string, token: string | null) {
  const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
  return fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<number | null>(null);

  const { from: drFrom, to: drTo, days } = getDateRangeParams(dateRange);
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["analytics-summary", drFrom, drTo],
    queryFn: async ({ signal }) => {
      const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
      const params = new URLSearchParams();
      if (drFrom) params.set("from", drFrom);
      if (drTo) params.set("to", drTo);
      const res = await fetch(`${base}/api/analytics/summary?${params}`, {
        signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch analytics summary");
      return res.json() as Promise<{
        totalWebsites: number; totalLeads: number; convertedLeads: number;
        activeCampaigns: number; avgSeoScore: number | null; totalKeywords: number;
        totalBacklinks: number; securedBacklinks: number; scheduledPosts: number;
        highIntentLeads: number;
      }>;
    },
  });

  const { data: trafficTrend, isLoading: trendLoading } = useQuery({
    queryKey: ["analytics-traffic-trend", days],
    queryFn: () => apiGet(`/api/analytics/traffic-trend?days=${days}`, token) as Promise<{
      days: number; trend: { date: string; views: number; visitors: number }[];
    }>,
  });

  const { data: trafficSources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["analytics-traffic-sources", days],
    queryFn: () => apiGet(`/api/analytics/traffic-sources?days=${days}`, token) as Promise<{
      days: number; sources: { channel: string; views: number }[];
    }>,
  });

  const { data: topPages, isLoading: topPagesLoading } = useQuery({
    queryKey: ["analytics-top-pages", days],
    queryFn: () => apiGet(`/api/analytics/top-pages?days=${days}`, token) as Promise<{
      days: number; pages: { path: string; views: number; visitors: number }[];
    }>,
  });

  const { data: funnel, isLoading: funnelLoading } = useGetLeadsFunnel();
  const { data: campaigns, isLoading: campaignsLoading } = useGetCampaignAnalytics();
  const { data: websites } = useListWebsites();

  // Traffic totals + trend comparison (first half vs second half of period)
  const trend = trafficTrend?.trend ?? [];
  const half = Math.floor(trend.length / 2);
  const firstHalf = trend.slice(0, half);
  const secondHalf = trend.slice(half);
  const totalViews = trend.reduce((s, d) => s + d.views, 0);
  const totalVisitors = trend.reduce((s, d) => s + (d.visitors ?? 0), 0);
  const prevViews = firstHalf.reduce((s, d) => s + d.views, 0);
  const curViews = secondHalf.reduce((s, d) => s + d.views, 0);
  const prevVisitors = firstHalf.reduce((s, d) => s + (d.visitors ?? 0), 0);
  const curVisitors = secondHalf.reduce((s, d) => s + (d.visitors ?? 0), 0);

  const funnelData = funnel
    ? [
        { name: "New", value: funnel.newLeads },
        { name: "Contacted", value: funnel.contacted },
        { name: "Qualified", value: funnel.qualified },
        { name: "Converted", value: funnel.converted },
        { name: "Lost", value: funnel.lost },
      ].filter(d => d.value > 0)
    : [];

  const websiteSeoData = (websites ?? [])
    .filter(w => w.seoScore !== null && w.seoScore !== undefined)
    .map(w => ({ name: w.name, score: w.seoScore ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const totalSourceViews = (trafficSources?.sources ?? []).reduce((s, d) => s + d.views, 0);

  const chartTrendData = trend.map(d => ({
    ...d,
    label: formatDate(d.date, days),
  }));

  // Sparse labels for large ranges
  const tickFormatter = (_: string, index: number) => {
    if (days <= 7) return chartTrendData[index]?.label ?? "";
    if (days <= 30) return index % 5 === 0 ? (chartTrendData[index]?.label ?? "") : "";
    return index % 15 === 0 ? (chartTrendData[index]?.label ?? "") : "";
  };

  const summaryCards = [
    { label: "Total Websites", value: summary?.totalWebsites ?? 0, icon: Globe },
    { label: "Total Leads", value: summary?.totalLeads ?? 0, icon: Users, sub: `${summary?.convertedLeads ?? 0} converted` },
    { label: "Active Campaigns", value: summary?.activeCampaigns ?? 0, icon: TrendingUp },
    { label: "Avg SEO Score", value: summary?.avgSeoScore != null ? Math.round(summary.avgSeoScore) : "—", icon: Target },
    { label: "Total Keywords", value: summary?.totalKeywords ?? 0, icon: Target },
    { label: "Backlinks", value: summary?.totalBacklinks ?? 0, icon: TrendingUp, sub: `${summary?.securedBacklinks ?? 0} secured` },
    { label: "Scheduled Posts", value: summary?.scheduledPosts ?? 0, icon: Calendar },
    { label: "High-Intent Leads", value: summary?.highIntentLeads ?? 0, icon: Users, sub: "score ≥ 70" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header + date range */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Full cross-site performance overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            {DATE_RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  dateRange === opt.value
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => {
              if (campaigns?.length) {
                downloadCsv(campaigns.map(c => ({
                  Campaign: c.name, Type: c.type, Status: c.status,
                  Impressions: c.impressions ?? 0, Clicks: c.clicks ?? 0,
                  "CTR (%)": c.ctr != null ? c.ctr.toFixed(2) : "",
                  Conversions: c.conversions ?? 0, Leads: c.leads ?? 0,
                  Spend: c.spend ?? "",
                })), "campaign-analytics.csv");
              }
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Traffic KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Page Views</p>
                <p className="text-2xl font-bold font-display mt-1">
                  {trendLoading ? <Skeleton className="h-7 w-16 inline-block" /> : totalViews.toLocaleString()}
                </p>
                {!trendLoading && <TrendBadge current={curViews} previous={prevViews} />}
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Eye className="h-4 w-4 text-primary" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Unique Visitors</p>
                <p className="text-2xl font-bold font-display mt-1">
                  {trendLoading ? <Skeleton className="h-7 w-16 inline-block" /> : totalVisitors.toLocaleString()}
                </p>
                {!trendLoading && <TrendBadge current={curVisitors} previous={prevVisitors} />}
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Users className="h-4 w-4 text-primary" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Top Channel</p>
                <p className="text-2xl font-bold font-display mt-1">
                  {sourcesLoading ? <Skeleton className="h-7 w-16 inline-block" /> : (trafficSources?.sources[0]?.channel ?? "—")}
                </p>
                {!sourcesLoading && trafficSources?.sources[0] && (
                  <p className="text-xs text-muted-foreground">
                    {totalSourceViews > 0
                      ? `${((trafficSources.sources[0].views / totalSourceViews) * 100).toFixed(0)}% of traffic`
                      : "No data yet"}
                  </p>
                )}
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><MousePointerClick className="h-4 w-4 text-primary" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg SEO Score</p>
                <p className="text-2xl font-bold font-display mt-1">
                  {summaryLoading ? <Skeleton className="h-7 w-16 inline-block" /> : (summary?.avgSeoScore != null ? Math.round(summary.avgSeoScore) : "—")}
                </p>
                <p className="text-xs text-muted-foreground">{summary?.totalWebsites ?? 0} sites tracked</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Target className="h-4 w-4 text-primary" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic trend chart */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Site Traffic Over Time</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Page views and unique visitors tracked by the built-in pixel</p>
          </div>
          {totalViews > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => downloadCsv(
              (trafficTrend?.trend ?? []).map(d => ({ Date: d.date, "Page Views": d.views, "Unique Visitors": d.visitors })),
              "traffic-trend.csv"
            )}>
              <Download className="h-3 w-3" /> CSV
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : totalViews === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-8 w-8 opacity-30" />
              <p>No tracked page views yet in this period</p>
              <p className="text-xs">The built-in tracking pixel records visits automatically</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartTrendData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(_, i) => tickFormatter("", i)}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
                />
                <Area type="monotone" dataKey="views" name="Page Views" stroke="#0ea5e9" strokeWidth={2} fill="url(#gViews)" dot={false} />
                <Area type="monotone" dataKey="visitors" name="Unique Visitors" stroke="#6366f1" strokeWidth={2} fill="url(#gVisitors)" dot={false} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Traffic sources + Top pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Traffic Sources</CardTitle>
            <p className="text-xs text-muted-foreground">Where your visitors are coming from</p>
          </CardHeader>
          <CardContent>
            {sourcesLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : totalSourceViews === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-8 w-8 opacity-30" />
                <p>No traffic source data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={trafficSources?.sources}
                      dataKey="views"
                      nameKey="channel"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={38}
                    >
                      {(trafficSources?.sources ?? []).map((s) => (
                        <Cell key={s.channel} fill={CHANNEL_COLORS[s.channel] ?? COLORS[0]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [v.toLocaleString(), "views"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {(trafficSources?.sources ?? []).map(s => {
                    const pct = totalSourceViews > 0 ? (s.views / totalSourceViews) * 100 : 0;
                    return (
                      <div key={s.channel} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHANNEL_COLORS[s.channel] ?? COLORS[0] }} />
                        <span className="text-xs font-medium flex-1">{s.channel}</span>
                        <span className="text-xs text-muted-foreground">{s.views.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Pages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Pages</CardTitle>
            <p className="text-xs text-muted-foreground">Most-visited pages in the selected period</p>
          </CardHeader>
          <CardContent className="p-0">
            {topPagesLoading ? (
              <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : (topPages?.pages ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <Eye className="h-8 w-8 opacity-30" />
                <p className="text-sm">No page view data yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Page</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Views</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Visitors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(topPages?.pages ?? []).map((p, i) => {
                      const maxViews = topPages?.pages[0]?.views ?? 1;
                      const pct = (p.views / maxViews) * 100;
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-xs truncate max-w-[180px]">{p.path}</span>
                              <div className="h-1 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs">{p.views.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{p.visitors.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary stats — 8 cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Portfolio Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {summaryLoading ? (
            [...Array(8)].map((_, i) => <Skeleton key={i} className="h-20" />)
          ) : (
            summaryCards.map(({ label, value, icon: Icon, sub }) => (
              <Card key={label} data-testid={`card-analytics-${label.toLowerCase().replace(/\s/g, "-")}`}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="text-2xl font-bold font-display mt-1">{value}</p>
                      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                    </div>
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Charts row — SEO scores + Lead funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SEO Scores by Website</CardTitle>
          </CardHeader>
          <CardContent>
            {websiteSeoData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-8 w-8 opacity-30" />
                <p>No SEO score data yet</p>
                <p className="text-xs">Add a website and run an audit to see scores</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={websiteSeoData} margin={{ left: 0, right: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-30} textAnchor="end" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="score" name="SEO Score" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]}>
                    {websiteSeoData.map((d, i) => (
                      <Cell key={i} fill={d.score >= 70 ? "#10b981" : d.score >= 40 ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lead Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelLoading ? <Skeleton className="h-48 w-full" /> : funnelData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Users className="h-8 w-8 opacity-30" />
                <p>No lead data for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={funnelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {funnelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campaign analytics table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Campaign Performance</CardTitle>
          {(campaigns ?? []).length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => {
                downloadCsv((campaigns ?? []).map(c => ({
                  Campaign: c.name, Type: c.type, Status: c.status,
                  Impressions: c.impressions ?? 0, Clicks: c.clicks ?? 0,
                  "CTR (%)": c.ctr != null ? c.ctr.toFixed(2) : "",
                  Conversions: c.conversions ?? 0, Leads: c.leads ?? 0, Spend: c.spend ?? "",
                })), "campaigns.csv");
              }}
            >
              <Download className="h-3 w-3" /> CSV
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {campaignsLoading ? (
            <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (campaigns ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <TrendingUp className="h-8 w-8 opacity-30" />
              <p className="text-sm font-medium">No campaigns yet</p>
              <p className="text-xs">Create your first campaign to start tracking performance</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Campaign</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Impressions</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Clicks</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">CTR</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Conversions</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Leads</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {(campaigns ?? []).map(c => (
                    <tr key={c.campaignId} data-testid={`row-campaign-analytics-${c.campaignId}`} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.type}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-xs">{c.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{c.impressions?.toLocaleString() ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{c.clicks?.toLocaleString() ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{c.ctr != null ? `${c.ctr.toFixed(2)}%` : "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{c.conversions?.toLocaleString() ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{c.leads ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono">{c.spend ? `$${parseFloat(String(c.spend)).toLocaleString()}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GA4 Traffic */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Traffic (Google Analytics 4)
          </h2>
          <select
            value={selectedWebsiteId ?? ""}
            onChange={e => setSelectedWebsiteId(e.target.value ? parseInt(e.target.value) : null)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid="select-ga4-website"
          >
            <option value="">Select a website…</option>
            {(websites ?? []).map(w => (
              <option key={w.id} value={w.id}>{w.name || w.url}</option>
            ))}
          </select>
        </div>

        {!selectedWebsiteId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Wifi className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Select a website to view GA4 traffic data</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Traffic data is pulled live from Google Analytics 4</p>
            </CardContent>
          </Card>
        ) : (
          <Ga4TrafficPanel websiteId={selectedWebsiteId} />
        )}
      </div>
    </div>
  );
}
