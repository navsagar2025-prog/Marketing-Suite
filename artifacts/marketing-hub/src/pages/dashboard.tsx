import { Link } from "wouter";
import {
  Globe, Search, Megaphone, Users, Link2, TrendingUp, Target, Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell
} from "recharts";
import {
  useGetAnalyticsSummary,
  useGetLeadsFunnel,
  useGetCampaignAnalytics,
  useListWebsites,
} from "@workspace/api-client-react";

function StatCard({
  label, value, icon: Icon, sublabel, href, loading
}: {
  label: string; value?: number | string | null; icon: React.ComponentType<{ className?: string }>;
  sublabel?: string; href?: string; loading?: boolean;
}) {
  const content = (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold font-display mt-1">{value ?? 0}</p>
            )}
            {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }
  return content;
}

const FUNNEL_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetAnalyticsSummary();
  const { data: funnel, isLoading: funnelLoading } = useGetLeadsFunnel();
  const { data: campaignAnalytics, isLoading: campaignLoading } = useGetCampaignAnalytics();
  const { data: websites, isLoading: websitesLoading } = useListWebsites();

  const funnelData = funnel
    ? [
        { name: "New", value: funnel.newLeads },
        { name: "Contacted", value: funnel.contacted },
        { name: "Qualified", value: funnel.qualified },
        { name: "Converted", value: funnel.converted },
      ].filter(d => d.value > 0)
    : [];

  const topCampaigns = (campaignAnalytics ?? []).slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your marketing command center at a glance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Websites" value={summary?.totalWebsites} icon={Globe} href="/websites" loading={summaryLoading} />
        <StatCard label="Keywords" value={summary?.totalKeywords} icon={Search} href="/keywords" loading={summaryLoading} />
        <StatCard label="Total Leads" value={summary?.totalLeads} icon={Users} href="/leads" sublabel={`${summary?.convertedLeads ?? 0} converted`} loading={summaryLoading} />
        <StatCard label="Campaigns" value={summary?.totalCampaigns} icon={Megaphone} href="/campaigns" sublabel={`${summary?.activeCampaigns ?? 0} active`} loading={summaryLoading} />
        <StatCard label="Backlinks" value={summary?.totalBacklinks} icon={Link2} href="/backlinks" sublabel={`${summary?.securedBacklinks ?? 0} secured`} loading={summaryLoading} />
        <StatCard label="Scheduled Posts" value={summary?.scheduledPosts} icon={Calendar} href="/social" loading={summaryLoading} />
        <StatCard label="Avg SEO Score" value={summary?.avgSeoScore !== null && summary?.avgSeoScore !== undefined ? Math.round(summary.avgSeoScore) : "—"} icon={TrendingUp} loading={summaryLoading} />
        <StatCard label="Converted Leads" value={summary?.convertedLeads} icon={Target} href="/leads" loading={summaryLoading} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Leads Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : funnelData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No lead data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={70} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((_, i) => (
                      <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Campaign performance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {campaignLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : topCampaigns.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No campaign data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={topCampaigns} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="clicks" name="Clicks" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversions" name="Conversions" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Websites overview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Websites</CardTitle>
            <Link href="/websites" className="text-xs text-primary hover:underline" data-testid="link-all-websites">View all</Link>
          </div>
        </CardHeader>
        <CardContent>
          {websitesLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (websites ?? []).length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No websites yet. <Link href="/websites" className="text-primary hover:underline" data-testid="link-add-first-website">Add your first website</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {(websites ?? []).slice(0, 5).map(site => (
                <Link
                  key={site.id}
                  href={`/websites/${site.id}`}
                  data-testid={`link-website-${site.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Globe className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{site.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{site.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {site.seoScore !== null && site.seoScore !== undefined && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${site.seoScore >= 70 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : site.seoScore >= 40 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                        {site.seoScore}
                      </span>
                    )}
                    <Badge variant={site.status === "active" ? "default" : "secondary"} className="text-xs">{site.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
