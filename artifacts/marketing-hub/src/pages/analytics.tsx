import { useState } from "react";
import { TrendingUp, Target, Globe, Users, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "@workspace/api-client-react";
import { Ga4TrafficPanel } from "@/components/Ga4TrafficPanel";

const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))"
];

export default function Analytics() {
  const { data: summary, isLoading: summaryLoading } = useGetAnalyticsSummary();
  const { data: funnel, isLoading: funnelLoading } = useGetLeadsFunnel();
  const { data: campaigns, isLoading: campaignsLoading } = useGetCampaignAnalytics();
  const { data: websites } = useListWebsites();

  const [selectedWebsiteId, setSelectedWebsiteId] = useState<number | null>(null);

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
        ) : (
          <Ga4TrafficPanel websiteId={selectedWebsiteId} />
        )}
      </div>
    </div>
  );
}
