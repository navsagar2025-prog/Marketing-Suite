import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetGoogleIntegrationStatus,
  useListGscProperties,
  useConnectGscProperty,
  useDisconnectGoogleIntegration,
  useGetGscSearchPerformance,
  getGscSearchPerformance,
  getGetGoogleIntegrationStatusQueryKey,
  getListGscPropertiesQueryKey,
  getGetGscSearchPerformanceQueryKey,
} from "@workspace/api-client-react";
import type { GscSearchPerformance, GscProperty } from "@workspace/api-client-react";
import { TrendingUp, TrendingDown, Minus, ExternalLink, RefreshCw, Loader2, Search, Globe, BarChart2, Unlink } from "lucide-react";

const TOKEN_KEY = "auth_token";

async function fetchGoogleAuthUrl(websiteId: number): Promise<string | null> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const res = await fetch(`/api/integrations/google/auth?websiteId=${websiteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.authUrl ?? null;
}

type DateRange = "7days" | "28days" | "90days";

function DeltaBadge({ delta, isPosition = false }: { delta: number | null; isPosition?: boolean }) {
  if (delta === null || isNaN(delta)) return <span className="text-muted-foreground text-xs">—</span>;
  // For position: lower is better, so negative delta is good
  const isGood = isPosition ? delta < 0 : delta > 0;
  const isNeutral = Math.abs(delta) < 0.5;
  if (isNeutral) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />{isPosition ? Math.abs(delta).toFixed(1) : `${Math.abs(delta).toFixed(1)}%`}</span>;
  const Icon = isGood ? TrendingUp : TrendingDown;
  const color = isGood ? "text-green-600" : "text-red-500";
  const label = isPosition
    ? `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}`
    : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
  return <span className={`text-xs font-medium flex items-center gap-0.5 ${color}`}><Icon className="h-3 w-3" />{label}</span>;
}

function MetricCard({ label, value, delta, isPosition = false, format = "number" }: {
  label: string;
  value: number;
  delta?: number | null;
  isPosition?: boolean;
  format?: "number" | "pct" | "pos";
}) {
  const displayValue = format === "pct"
    ? `${(value * 100).toFixed(1)}%`
    : format === "pos"
    ? value.toFixed(1)
    : value.toLocaleString();
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold font-display mt-0.5">{displayValue}</p>
        {delta !== undefined && <div className="mt-1"><DeltaBadge delta={delta ?? null} isPosition={isPosition} /></div>}
      </CardContent>
    </Card>
  );
}

function QueryTable({ queries, label }: { queries: GscSearchPerformance["queries"]; label: string }) {
  const [sort, setSort] = useState<"clicks" | "impressions" | "ctr" | "position">("clicks");
  const sorted = [...queries].sort((a, b) => {
    if (sort === "position") return a.position - b.position;
    return b[sort] - a[sort];
  });
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label} ({queries.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="max-h-[340px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background border-b">
              <tr>
                <th className="text-left py-2 px-3 font-medium">Query</th>
                {(["clicks", "impressions", "ctr", "position"] as const).map(col => (
                  <th
                    key={col}
                    className={`text-right py-2 px-3 font-medium cursor-pointer hover:text-primary transition-colors ${sort === col ? "text-primary" : ""}`}
                    onClick={() => setSort(col)}
                  >
                    {col === "ctr" ? "CTR" : col === "position" ? "Pos." : col.charAt(0).toUpperCase() + col.slice(1)}
                    {sort === col && " ↓"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="py-1.5 px-3 max-w-[240px]">
                    <span className="truncate block" title={"query" in row ? row.query : (row as { page: string }).page}>
                      {"query" in row ? row.query : (row as { page: string }).page}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{row.clicks.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{row.impressions.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{(row.ctr * 100).toFixed(1)}%</td>
                  <td className={`py-1.5 px-3 text-right tabular-nums font-medium ${row.position <= 3 ? "text-green-600" : row.position <= 10 ? "text-yellow-600" : "text-muted-foreground"}`}>
                    {row.position.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PageTable({ pages }: { pages: GscSearchPerformance["pages"] }) {
  const [sort, setSort] = useState<"clicks" | "impressions" | "ctr" | "position">("clicks");
  const sorted = [...pages].sort((a, b) => {
    if (sort === "position") return a.position - b.position;
    return b[sort] - a[sort];
  });
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Top Pages ({pages.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="max-h-[340px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background border-b">
              <tr>
                <th className="text-left py-2 px-3 font-medium">Page</th>
                {(["clicks", "impressions", "ctr", "position"] as const).map(col => (
                  <th
                    key={col}
                    className={`text-right py-2 px-3 font-medium cursor-pointer hover:text-primary transition-colors ${sort === col ? "text-primary" : ""}`}
                    onClick={() => setSort(col)}
                  >
                    {col === "ctr" ? "CTR" : col.charAt(0).toUpperCase() + col.slice(1)}
                    {sort === col && " ↓"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="py-1.5 px-3 max-w-[280px]">
                    <div className="flex items-center gap-1">
                      <a href={row.page} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate block" title={row.page}>
                        {row.page.replace(/^https?:\/\/[^/]+/, "") || "/"}
                      </a>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </div>
                  </td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{row.clicks.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{row.impressions.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{(row.ctr * 100).toFixed(1)}%</td>
                  <td className={`py-1.5 px-3 text-right tabular-nums font-medium ${row.position <= 3 ? "text-green-600" : row.position <= 10 ? "text-yellow-600" : "text-muted-foreground"}`}>
                    {row.position.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PositionChart({ data }: { data: GscSearchPerformance["positionDistribution"] }) {
  const COLORS = ["#22c55e", "#84cc16", "#eab308", "#f97316"];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Position Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
            <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip formatter={(val) => [`${val} queries`, "Count"]} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground text-center mt-1">Number of queries ranking in each position range</p>
      </CardContent>
    </Card>
  );
}

// ─── Property selector ────────────────────────────────────────────────────────

function PropertySelector({
  websiteId,
  onConnected,
}: {
  websiteId: number;
  onConnected: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: properties, isLoading } = useListGscProperties(websiteId, {
    query: { queryKey: getListGscPropertiesQueryKey(websiteId) },
  });
  const connectMutation = useConnectGscProperty();

  const handleSelect = (propertyUrl: string) => {
    connectMutation.mutate(
      { data: { websiteId, propertyUrl } },
      {
        onSuccess: () => {
          toast({ title: "GSC property connected" });
          qc.invalidateQueries({ queryKey: getGetGoogleIntegrationStatusQueryKey(websiteId) });
          qc.invalidateQueries({ queryKey: getGetGscSearchPerformanceQueryKey(websiteId) });
          onConnected();
        },
        onError: () => toast({ title: "Failed to connect property", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!properties || properties.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm text-muted-foreground">No Search Console properties found for this Google account.</p>
          <p className="text-xs text-muted-foreground mt-1">Make sure you have added your website to Google Search Console first.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Select a GSC Property</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {properties.map((prop: GscProperty) => (
          <div key={prop.siteUrl} className="flex items-center justify-between border rounded-md px-3 py-2">
            <div>
              <p className="text-sm font-medium truncate max-w-[280px]">{prop.siteUrl}</p>
              <p className="text-xs text-muted-foreground capitalize">{prop.permissionLevel.replace(/_/g, " ")}</p>
            </div>
            <Button
              size="sm"
              onClick={() => handleSelect(prop.siteUrl)}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Use this"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────

export default function SearchPerformanceTab({ websiteId }: { websiteId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>("28days");
  const [showPropertySelector, setShowPropertySelector] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await getGscSearchPerformance(websiteId, { dateRange, refresh: true });
      await qc.invalidateQueries({ queryKey: getGetGscSearchPerformanceQueryKey(websiteId) });
    } catch {
      toast({ title: "Refresh failed", description: "Could not fetch fresh data from Google Search Console.", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  }

  const { data: status, isLoading: statusLoading } = useGetGoogleIntegrationStatus(websiteId, {
    query: { queryKey: getGetGoogleIntegrationStatusQueryKey(websiteId) },
  });

  const { data: performance, isLoading: perfLoading, error: perfError } = useGetGscSearchPerformance(
    websiteId,
    { dateRange },
    {
      query: {
        queryKey: getGetGscSearchPerformanceQueryKey(websiteId, { dateRange }),
        enabled: status?.connected === true && !!status.propertyUrl,
        retry: false,
      },
    }
  );

  const disconnectMutation = useDisconnectGoogleIntegration();

  // Handle URL params from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gsc") === "connected") {
      toast({ title: "Google Search Console connected successfully" });
      qc.invalidateQueries({ queryKey: getGetGoogleIntegrationStatusQueryKey(websiteId) });
      // Remove the param from the URL
      params.delete("gsc");
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", newUrl);
    } else if (params.get("gsc") === "error") {
      toast({
        title: "Google connection failed",
        description: `Error: ${params.get("reason") ?? "unknown"}`,
        variant: "destructive",
      });
      params.delete("gsc");
      params.delete("reason");
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const handleConnect = async () => {
    if (!status?.configured) {
      toast({ title: "Google OAuth not configured", description: "Ask an admin to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.", variant: "destructive" });
      return;
    }
    const authUrl = await fetchGoogleAuthUrl(websiteId);
    if (!authUrl) {
      toast({ title: "Failed to initiate Google sign-in", description: "Please try again.", variant: "destructive" });
      return;
    }
    window.location.href = authUrl;
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate(
      { websiteId },
      {
        onSuccess: () => {
          toast({ title: "Google Search Console disconnected" });
          qc.invalidateQueries({ queryKey: getGetGoogleIntegrationStatusQueryKey(websiteId) });
          qc.invalidateQueries({ queryKey: getGetGscSearchPerformanceQueryKey(websiteId) });
          setShowPropertySelector(false);
        },
        onError: () => toast({ title: "Failed to disconnect", variant: "destructive" }),
      }
    );
  };

  if (statusLoading) {
    return <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">Search Performance</h2>
          {status?.connected && status.email && (
            <p className="text-xs text-muted-foreground">Connected as {status.email}</p>
          )}
          {status?.connected && status.propertyUrl && (
            <p className="text-xs text-muted-foreground">Property: <span className="font-medium">{status.propertyUrl}</span></p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status?.connected && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowPropertySelector(!showPropertySelector)}>
                <Globe className="h-4 w-4 mr-2" />
                {status.propertyUrl ? "Change Property" : "Select Property"}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={disconnectMutation.isPending} className="text-muted-foreground hover:text-destructive">
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </>
          )}
          {!status?.connected && (
            <Button size="sm" onClick={handleConnect} data-testid="button-connect-gsc">
              <Search className="h-4 w-4 mr-2" />
              Connect Google Search Console
            </Button>
          )}
          {status?.connected && status.propertyUrl && !perfLoading && (
            <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Not connected state */}
      {!status?.connected && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="p-4 rounded-full bg-muted/50">
                <BarChart2 className="h-10 w-10 opacity-40" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Connect Google Search Console</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                See real organic traffic data — clicks, impressions, CTR, and average ranking position for all your search queries.
              </p>
            </div>
            <Button onClick={handleConnect} data-testid="button-connect-gsc-empty">
              <Search className="h-4 w-4 mr-2" />
              Connect Google Search Console
            </Button>
            {!status?.configured && (
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-3 py-2">
                Google OAuth credentials are not configured. An admin needs to set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Property selector */}
      {status?.connected && showPropertySelector && (
        <PropertySelector
          websiteId={websiteId}
          onConnected={() => setShowPropertySelector(false)}
        />
      )}

      {/* No property selected */}
      {status?.connected && !status.propertyUrl && !showPropertySelector && (
        <Card>
          <CardContent className="py-8 text-center">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Select a GSC property to view data</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Select Property" above to choose which Search Console property to display.</p>
          </CardContent>
        </Card>
      )}

      {/* Data panel */}
      {status?.connected && status.propertyUrl && !showPropertySelector && (
        <>
          {/* Date range selector */}
          <div className="flex items-center gap-1">
            {(["7days", "28days", "90days"] as DateRange[]).map(dr => (
              <button
                key={dr}
                onClick={() => setDateRange(dr)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${dateRange === dr ? "bg-primary text-primary-foreground border-primary" : "border-muted hover:border-muted-foreground text-muted-foreground"}`}
              >
                {dr === "7days" ? "Last 7 days" : dr === "28days" ? "Last 28 days" : "Last 90 days"}
              </button>
            ))}
          </div>

          {perfLoading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
              <Skeleton className="h-60 w-full" />
            </div>
          )}

          {perfError && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-red-600">Failed to load data. Your connection may have expired.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={handleConnect}>Reconnect Google</Button>
              </CardContent>
            </Card>
          )}

          {performance && (
            <div className="space-y-4">
              {/* Summary metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="Total Clicks" value={performance.summary.clicks} delta={performance.summary.clicksDelta} />
                <MetricCard label="Impressions" value={performance.summary.impressions} delta={performance.summary.impressionsDelta} />
                <MetricCard label="Avg CTR" value={performance.summary.ctr} delta={performance.summary.ctrDelta} format="pct" />
                <MetricCard label="Avg Position" value={performance.summary.avgPosition} delta={performance.summary.positionDelta} isPosition format="pos" />
              </div>

              {/* Position distribution chart */}
              <PositionChart data={performance.positionDistribution} />

              {/* Queries table */}
              {performance.queries.length > 0 && (
                <QueryTable queries={performance.queries} label="Top Queries" />
              )}

              {/* Pages table */}
              {performance.pages.length > 0 && (
                <PageTable pages={performance.pages} />
              )}

              <p className="text-xs text-muted-foreground text-center">
                Data cached · last updated {new Date(performance.cachedAt).toLocaleString()}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
