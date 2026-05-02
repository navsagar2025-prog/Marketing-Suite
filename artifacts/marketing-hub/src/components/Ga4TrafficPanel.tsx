import { useState } from "react";
import { Link } from "wouter";
import { BarChart3, TrendingUp, Users, Clock, MousePointerClick, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useGetGa4Report, getGetGa4ReportQueryKey } from "@workspace/api-client-react";

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

export function Ga4TrafficPanel({ websiteId }: { websiteId: number }) {
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const { data: ga4Data, isLoading, error } = useGetGa4Report(
    websiteId,
    { dateRange },
    {
      query: {
        enabled: !!websiteId,
        queryKey: getGetGa4ReportQueryKey(websiteId, { dateRange }),
        retry: false,
      },
    }
  );

  const ga4ErrorCode = error
    ? ((error as { response?: { data?: { error?: string } } }).response?.data?.error === "GA4_PROPERTY_NOT_SET"
        ? "not_configured"
        : "api_error")
    : null;

  return (
    <div className="space-y-4">
      {/* Date range selector */}
      <div className="flex items-center justify-end">
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

      {isLoading ? (
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
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                          formatter={(v) => [`${v} sessions`]}
                        />
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
  );
}
