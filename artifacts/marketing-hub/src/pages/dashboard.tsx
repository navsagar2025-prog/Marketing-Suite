import { useEffect } from "react";
import { Link } from "wouter";
import {
  Globe, Search, Megaphone, Users, Link2, TrendingUp, Target, Calendar,
  Sparkles, BarChart3, Zap, Plus, ArrowRight, Share2
} from "lucide-react";
import { ProductTour, TourLaunchButton, useTour } from "@/components/ProductTour";
import { OnboardingDashboardCard } from "@/components/OnboardingChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import {
  useGetAnalyticsSummary,
  useGetLeadsFunnel,
  useGetCampaignAnalytics,
  useListWebsites,
} from "@workspace/api-client-react";

const STAT_COLORS = [
  { border: "border-l-blue-500", bg: "from-blue-50/60 to-transparent dark:from-blue-950/30", icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" },
  { border: "border-l-violet-500", bg: "from-violet-50/60 to-transparent dark:from-violet-950/30", icon: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" },
  { border: "border-l-emerald-500", bg: "from-emerald-50/60 to-transparent dark:from-emerald-950/30", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" },
  { border: "border-l-orange-500", bg: "from-orange-50/60 to-transparent dark:from-orange-950/30", icon: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400" },
  { border: "border-l-pink-500", bg: "from-pink-50/60 to-transparent dark:from-pink-950/30", icon: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400" },
  { border: "border-l-cyan-500", bg: "from-cyan-50/60 to-transparent dark:from-cyan-950/30", icon: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400" },
  { border: "border-l-teal-500", bg: "from-teal-50/60 to-transparent dark:from-teal-950/30", icon: "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400" },
  { border: "border-l-rose-500", bg: "from-rose-50/60 to-transparent dark:from-rose-950/30", icon: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400" },
  { border: "border-l-amber-500", bg: "from-amber-50/60 to-transparent dark:from-amber-950/30", icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" },
];

function StatCard({
  label, value, icon: Icon, sublabel, href, loading, colorIndex = 0
}: {
  label: string; value?: number | string | null; icon: React.ComponentType<{ className?: string }>;
  sublabel?: string; href?: string; loading?: boolean; colorIndex?: number;
}) {
  const color = STAT_COLORS[colorIndex % STAT_COLORS.length];
  const content = (
    <Card
      className={`hover:shadow-lg transition-all hover:-translate-y-0.5 border-l-4 ${color.border} bg-gradient-to-r ${color.bg}`}
      data-testid={`card-stat-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            {loading ? (
              <Skeleton className="h-9 w-20 mt-1" />
            ) : (
              <p className="text-3xl font-bold font-display mt-1 leading-none">{value ?? 0}</p>
            )}
            {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${color.icon}`}>
            <Icon className="h-5 w-5" />
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

const SERVICES = [
  {
    icon: Search,
    label: "SEO Auditing",
    description: "Audit your sites and uncover technical issues affecting search rankings.",
    href: "/websites",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    icon: TrendingUp,
    label: "Keyword Tracking",
    description: "Monitor keyword positions and spot ranking opportunities.",
    href: "/keywords",
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-950/40",
  },
  {
    icon: Sparkles,
    label: "AI Content",
    description: "Generate blog posts, copy, and FAQs using advanced AI models.",
    href: "/ai",
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  {
    icon: Users,
    label: "Lead Capture",
    description: "Capture, score, and qualify inbound leads automatically.",
    href: "/leads",
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    icon: Megaphone,
    label: "Campaigns",
    description: "Run targeted email campaigns and track every open and click.",
    href: "/campaigns",
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/40",
  },
  {
    icon: Link2,
    label: "Backlinks",
    description: "Discover link opportunities and manage your backlink profile.",
    href: "/backlinks",
    color: "text-pink-500",
    bg: "bg-pink-50 dark:bg-pink-950/40",
  },
  {
    icon: Share2,
    label: "Social Scheduling",
    description: "Schedule and publish social posts across all your channels.",
    href: "/social",
    color: "text-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
  },
  {
    icon: BarChart3,
    label: "Analytics",
    description: "Visualise performance data and measure what matters most.",
    href: "/analytics",
    color: "text-teal-500",
    bg: "bg-teal-50 dark:bg-teal-950/40",
  },
];

const QUICK_ACTIONS = [
  { label: "Add Website", href: "/websites", icon: Plus },
  { label: "New Campaign", href: "/campaigns", icon: Megaphone },
  { label: "View Leads", href: "/leads", icon: Users },
  { label: "AI Tools", href: "/ai", icon: Sparkles },
];

const FUNNEL_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function SeoScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span
        className={`text-xs font-bold w-7 text-right ${
          score >= 70
            ? "text-emerald-600 dark:text-emerald-400"
            : score >= 40
            ? "text-amber-600 dark:text-amber-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {score}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetAnalyticsSummary();
  const { data: funnel, isLoading: funnelLoading } = useGetLeadsFunnel();
  const { data: campaignAnalytics, isLoading: campaignLoading } = useGetCampaignAnalytics();
  const { data: websites, isLoading: websitesLoading } = useListWebsites();
  const { active: tourActive, setActive: setTourActive, startTour, autoStart } = useTour();

  useEffect(() => {
    const t = setTimeout(() => autoStart(), 600);
    return () => clearTimeout(t);
  }, [autoStart]);

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
    <div className="p-6 space-y-8">

      <ProductTour active={tourActive} onClose={() => setTourActive(false)} />

      {/* Welcome Banner */}
      <div
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground p-8"
        data-testid="text-page-title"
        data-tour="welcome-banner"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-5 w-5 opacity-80" />
            <span className="text-sm font-medium opacity-80 uppercase tracking-widest">SEO Command</span>
          </div>
          <h1 className="text-3xl font-bold font-display mt-1 mb-2">Your Marketing Command Center</h1>
          <p className="text-sm opacity-75 max-w-xl mb-6">
            Everything you need to grow organic traffic, capture leads, and run high-converting campaigns — all in one place.
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-primary-foreground border-white/20 border backdrop-blur-sm gap-1.5"
                  data-testid={`button-quick-action-${label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              </Link>
            ))}
            <TourLaunchButton onStart={startTour} />
          </div>
        </div>
      </div>

      {/* Getting Started checklist */}
      <div data-tour="getting-started">
        <OnboardingDashboardCard />
      </div>

      {/* Stats grid */}
      <div data-tour="stats-grid">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">At a Glance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Websites" value={summary?.totalWebsites} icon={Globe} href="/websites" loading={summaryLoading} colorIndex={0} />
          <StatCard label="Keywords" value={summary?.totalKeywords} icon={Search} href="/keywords" loading={summaryLoading} colorIndex={1} />
          <StatCard label="Total Leads" value={summary?.totalLeads} icon={Users} href="/leads" sublabel={`${summary?.convertedLeads ?? 0} converted`} loading={summaryLoading} colorIndex={2} />
          <StatCard label="Campaigns" value={summary?.totalCampaigns} icon={Megaphone} href="/campaigns" sublabel={`${summary?.activeCampaigns ?? 0} active`} loading={summaryLoading} colorIndex={3} />
          <StatCard label="Backlinks" value={summary?.totalBacklinks} icon={Link2} href="/backlinks" sublabel={`${summary?.securedBacklinks ?? 0} secured`} loading={summaryLoading} colorIndex={4} />
          <StatCard label="Scheduled Posts" value={summary?.scheduledPosts} icon={Calendar} href="/social" loading={summaryLoading} colorIndex={5} />
          <StatCard label="Avg SEO Score" value={summary?.avgSeoScore !== null && summary?.avgSeoScore !== undefined ? Math.round(summary.avgSeoScore) : "—"} icon={TrendingUp} loading={summaryLoading} colorIndex={6} />
          <StatCard label="Converted Leads" value={summary?.convertedLeads} icon={Target} href="/leads" loading={summaryLoading} colorIndex={7} />
          <StatCard label="High-Intent Leads" value={summary?.highIntentLeads} icon={TrendingUp} href="/leads" sublabel="score ≥ 70" loading={summaryLoading} colorIndex={8} />
        </div>
      </div>

      {/* Platform Features */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Platform Features</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICES.map(({ icon: Icon, label, description, href, color, bg }) => (
            <Link key={href} href={href} className="block group">
              <Card className="h-full hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
                <CardContent className="pt-5 pb-4">
                  <div className={`inline-flex p-2.5 rounded-xl ${bg} mb-3`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <p className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">{label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                  <div className="flex items-center gap-1 mt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    Open <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Performance</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leads funnel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Leads Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {funnelLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : funnelData.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No lead data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={176}>
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={70} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
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
                <Skeleton className="h-44 w-full" />
              ) : topCampaigns.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No campaign data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={176}>
                  <BarChart data={topCampaigns} margin={{ left: 0, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="clicks" name="Clicks" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="conversions" name="Conversions" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Websites overview */}
      <div>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Websites Overview</CardTitle>
              <Link href="/websites" className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="link-all-websites">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {websitesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (websites ?? []).length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No websites yet.{" "}
                <Link href="/websites" className="text-primary hover:underline" data-testid="link-add-first-website">
                  Add your first website
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(websites ?? []).slice(0, 5).map(site => (
                  <Link
                    key={site.id}
                    href={`/websites/${site.id}`}
                    data-testid={`link-website-${site.id}`}
                    className="flex items-center justify-between py-3 hover:bg-muted/50 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <Globe className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{site.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{site.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-3 shrink-0">
                      {site.seoScore !== null && site.seoScore !== undefined ? (
                        <SeoScoreBar score={site.seoScore} />
                      ) : (
                        <span className="text-xs text-muted-foreground w-[80px]">No score</span>
                      )}
                      <Badge
                        variant={site.status === "active" ? "default" : "secondary"}
                        className={`text-xs capitalize ${
                          site.status === "active"
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {site.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* GA4 Traffic Shortcut */}
      <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/60 to-transparent dark:from-blue-950/30">
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Google Analytics 4 Dashboard</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  View sessions, top pages, traffic sources, and device breakdown for any connected website.
                </p>
              </div>
            </div>
            <Link href="/analytics">
              <Button size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs">
                View Traffic
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
