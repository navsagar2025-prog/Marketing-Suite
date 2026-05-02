import { useState } from "react";
import { Link } from "wouter";
import { BarChart3, TrendingUp, Target, Globe, Users, Clock, MousePointerClick, Wifi, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  useGetAnalyticsSummary,
  useGetLeadsFunnel,
  useGetCampaignAnalytics,
  useListWebsites,
  useGetGa4Report,
  getGetGa4ReportQueryKey,
} from "@workspace/api-client-react";

const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))"
];

const DEVICE_COLORS: Record<string, string> = {
  desktop: "hsl(var(--chart-1))",
  mobile: "hsl(var(--chart-2))",
  tablet: "hsl(var(--chart-3))",
};

const SOURCE_COLORS: Record<string, string> = {
  "Organic Search": "hsl(var(--chart-1))",
  "Direct": "hsl(var(--chart-2))",
  "Referral": "hsl(var(--chart-3))",
  "Organic Social": "hsl(var(--chart-4))",
  "Paid Search": "hsl(var(--chart-5))",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

type DateRange = "7d" | "30d" | "90d";
const DATE_RANGE_LABELS: Record<DateRange, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" };

export default function Analytics() {
  const { data: summary, isLoading: summaryLoading } = useGetAnalyticsSummary();
  const { data: funnel, isLoading: funnelLoading } = useGetLeadsFunnel();
  const { data: campaigns, isLoading: campaignsLoading } = useGetCampaignAnalytics();
  const { data: websites } = useListWebsites();

  const [selectedWebsiteId, setSelectedWebsiteId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const { data: ga4Data, isLoading: ga4Loading, error: ga4Error } = useGetGa4Report(
    selectedWebsiteId ?? 0,
    { dateRange },
    {
      query: {
        enabled: !!selectedWebsiteId,
        queryKey: getGetGa4ReportQueryKey(selectedWebsiteId ?? 0, { dateRange }),
        retry: false,
      },
    }
  );

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

  const ga4ErrorCode = ga4Error
    ? ((ga4Error as { response?: { data?: { error?: string } } }).response?.data?.error === "GA4_PROPERTY_NOT_SET"
        ? "not_configured"
        : "api_error")
    : null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Full cross-site performance overview</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : [
          { label: "Total Websites", value: summary?.totalWebsites ?? 0, icon: Globe },
          { label: "Total Leads", value: summary?.totalLeads ?? 0, icon: Users, sub: `${summary?.convertedLeads ?? 0} converted` },
          { label: "Active Campaigns", value: summary?.activeCampaigns ?? 0, icon: TrendingUp },
          { label: "Avg SEO Score", value: summary?.avgSeoScore != null ? Math.round(summary.avgSeoScore) : "—", icon: Target },
        ].map(({ label, value, icon: Icon, sub }) => (
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
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SEO Scores by Website</CardTitle>
          </CardHeader>
          <CardContent>
            {websiteSeoData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No SEO score data</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={websiteSeoData} margin={{ left: 0, right: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-30} textAnchor="end" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="score" name="SEO Score" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]}>
                    {websiteSeoData.map((d, i) => (
                      <Cell key={i} fill={d.score >= 70 ? "hsl(var(--chart-3))" : d.score >= 40 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lead Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelLoading ? <Skeleton className="h-48 w-full" /> : funnelData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No lead data</div>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campaignsLoading ? (
            <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (campaigns ?? []).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No campaign data yet</div>
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

      {/* ── GA4 Traffic Dashboard ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Traffic (Google Analytics 4)
          </h2>
          <div className="flex items-center gap-2">
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
            <div className="flex rounded-md border border-input overflow-hidden">
              {(["7d", "30d", "90d"] as DateRange[]).map(range => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    dateRange === range
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  data-testid={`button-ga4-range-${range}`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!selectedWebsiteId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Wifi className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Select a website to view GA4 traffic data</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Traffic data is pulled live from Google Analytics 4</p>
            </CardContent>
          </Card>
        ) : ga4Loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
            <Skeleton className="h-48" />
          </div>
        ) : ga4ErrorCode === "not_configured" ? (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <div>
                <p className="text-sm font-medium">GA4 Property ID not configured</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Enter your GA4 Property ID in Settings → Google Search Console to connect this website's analytics.
                </p>
              </div>
              <Link href="/settings">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Settings className="h-3.5 w-3.5" />
                  Go to Settings
                </Button>
              </Link>
              <div className="text-xs text-muted-foreground border rounded-md p-3 bg-muted/40 text-left max-w-sm mx-auto">
                <p className="font-medium mb-1">How to find your GA4 Property ID:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Open Google Analytics</li>
                  <li>Click Admin (gear icon, bottom-left)</li>
                  <li>Under Property, click Property settings</li>
                  <li>Copy the numeric Property ID</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        ) : ga4ErrorCode === "api_error" ? (
          <Card>
            <CardContent className="py-10 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Failed to load GA4 data. Check your connection and property ID in Settings.</p>
              <Link href="/settings">
                <Button size="sm" variant="outline" className="mt-2 text-xs gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : ga4Data ? (
          <div className="space-y-6" data-testid="section-ga4-dashboard">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Sessions", value: ga4Data.summary.sessions.toLocaleString(), icon: MousePointerClick, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40" },
                { label: "Users", value: ga4Data.summary.users.toLocaleString(), icon: Users, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/40" },
                { label: "Bounce Rate", value: `${ga4Data.summary.bounceRate.toFixed(1)}%`, icon: TrendingUp, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/40" },
                { label: "Avg Session Duration", value: formatDuration(ga4Data.summary.avgSessionDuration), icon: Clock, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} data-testid={`card-ga4-${label.toLowerCase().replace(/\s/g, "-")}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className="text-2xl font-bold font-display mt-1">{value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Last {DATE_RANGE_LABELS[dateRange]}</p>
                      </div>
                      <div className={`p-2 rounded-lg ${bg}`}>
                        <Icon className={`h-4 w-4 ${color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Traffic Sources + Device Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Traffic Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  {ga4Data.trafficSources.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No traffic source data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={ga4Data.trafficSources} layout="vertical" margin={{ left: 0, right: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis type="category" dataKey="channel" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={110} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                          formatter={(v, _n, entry) => [`${v} sessions (${(entry.payload as { percentage: number }).percentage}%)`, "Sessions"]}
                        />
                        <Bar dataKey="sessions" radius={[0, 4, 4, 0]}>
                          {ga4Data.trafficSources.map((s, i) => (
                            <Cell key={i} fill={SOURCE_COLORS[s.channel] ?? COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Device Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {ga4Data.devices.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No device data</div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="60%" height={180}>
                        <PieChart>
                          <Pie data={ga4Data.devices} dataKey="sessions" nameKey="category" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                            {ga4Data.devices.map((d, i) => (
                              <Cell key={i} fill={DEVICE_COLORS[d.category] ?? COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(v) => [`${v} sessions`]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 flex-1">
                        {ga4Data.devices.map((d, i) => (
                          <div key={d.category} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: DEVICE_COLORS[d.category] ?? COLORS[i % COLORS.length] }} />
                              <span className="capitalize text-muted-foreground">{d.category}</span>
                            </div>
                            <span className="font-medium tabular-nums">{d.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Pages */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Pages</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ga4Data.topPages.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No page data available</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider w-8">#</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Page</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sessions</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ga4Data.topPages.map((p, i) => {
                          const share = ga4Data.summary.sessions > 0
                            ? Math.round((p.sessions / ga4Data.summary.sessions) * 1000) / 10
                            : 0;
                          return (
                            <tr key={p.page} data-testid={`row-ga4-page-${i}`} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                              <td className="px-4 py-2.5 font-mono text-xs max-w-xs truncate">{p.page}</td>
                              <td className="px-4 py-2.5 text-right font-mono">{p.sessions.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(100, share * 2)}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{share}%</span>
                                </div>
                              </td>
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
        ) : null}
      </div>
    </div>
  );
}
