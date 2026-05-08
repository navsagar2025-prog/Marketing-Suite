import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, MemoryStick, HardDrive, Database, Trash2, Activity, RefreshCw, Eye, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

type Metrics = {
  cpuPct: number | null;
  loadAvg: number[];
  memUsedBytes: number;
  memTotalBytes: number;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  uptimeSec: number;
  processRssBytes: number;
  nodeVersion: string;
  platform: string;
};
type DbTable = { name: string; sizeBytes: number; rowEstimate: number };
type SystemHealth = {
  metrics: Metrics;
  db: { totalBytes: number; tables: DbTable[] };
  visitors: { pageViews24h: number; activeVisitors: number };
  autoCleanupEnabled: boolean;
  ga4Configured: boolean;
};
type Snapshot = {
  id: number;
  createdAt: string;
  cpuPct: number | null;
  memUsedBytes: number | null;
  memTotalBytes: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  dbSizeBytes: number | null;
  pageViews24h: number | null;
  activeVisitors: number | null;
};

const fmtBytes = (n: number | null | undefined): string => {
  if (n == null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
};
const pct = (used: number | null | undefined, total: number | null | undefined): number => {
  if (!used || !total) return 0;
  return Math.round((used / total) * 100);
};
const fmtUptime = (sec: number): string => {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
};

function useAdminFetch<T>(queryKey: string[], path: string, refetchInterval?: number) {
  const { token } = useAuth();
  return useQuery<T>({
    queryKey,
    refetchInterval,
    queryFn: async () => {
      const r = await fetch(`${apiBase}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`Failed: ${r.status}`);
      return r.json();
    },
  });
}

export default function AdminSystemHealthPage(): JSX.Element {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: health, isLoading, refetch } = useAdminFetch<SystemHealth>(
    ["admin-system-health"], "/api/admin/system-health", 15_000,
  );
  const { data: snapshots } = useAdminFetch<Snapshot[]>(
    ["admin-health-snapshots"], "/api/admin/system-health/snapshots", 60_000,
  );

  const [filesPreview, setFilesPreview] = useState<{ count: number; sampleNames: string[]; freedBytes: number } | null>(null);
  const [tokensPreview, setTokensPreview] = useState<{ passwordResetTokens: number; sessions: number; pageViews: number; visitorSessions: number } | null>(null);
  const [ga4MeasurementId, setGa4MeasurementId] = useState("");
  const [ga4ApiSecret, setGa4ApiSecret] = useState("");

  const adminPost = async (path: string, body: unknown): Promise<Response> =>
    fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const snapshotMut = useMutation({
    mutationFn: async () => {
      const r = await adminPost("/api/admin/system-health/snapshot", {});
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "Snapshot recorded" });
      qc.invalidateQueries({ queryKey: ["admin-health-snapshots"] });
    },
  });

  const cleanupFiles = useMutation({
    mutationFn: async (execute: boolean) => {
      const r = await adminPost("/api/admin/system-health/cleanup-files", { execute });
      if (!r.ok) throw new Error("Failed");
      const j = await r.json();
      return { ...j.orphanedFiles, executed: j.executed };
    },
    onSuccess: (r) => {
      setFilesPreview(r);
      if (r.executed) toast({ title: `Removed ${r.count} orphaned files`, description: `Freed ${fmtBytes(r.freedBytes)}` });
      else toast({ title: `${r.count} orphaned files found`, description: r.count > 0 ? `Click "Clean now" to remove (~${fmtBytes(r.freedBytes)} freed)` : "Nothing to clean" });
    },
  });

  const purgeTokens = useMutation({
    mutationFn: async (execute: boolean) => {
      const r = await adminPost("/api/admin/system-health/purge-tokens", { execute });
      if (!r.ok) throw new Error("Failed");
      const j = await r.json();
      return { passwordResetTokens: j.passwordResetTokens, sessions: j.sessions, pageViews: j.pageViews, visitorSessions: j.visitorSessions, executed: j.executed };
    },
    onSuccess: (r) => {
      setTokensPreview(r);
      const total = r.passwordResetTokens + r.sessions + r.pageViews + r.visitorSessions;
      if (r.executed) toast({ title: `Purged ${total} expired records` });
      else toast({ title: `${total} expired rows found`, description: total > 0 ? "Click \"Purge now\" to delete" : "Nothing expired" });
    },
  });

  const autoCleanup = useMutation({
    mutationFn: async (enabled: boolean) => {
      const r = await adminPost("/api/admin/system-health/auto-cleanup", { enabled });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-system-health"] });
      toast({ title: "Auto-cleanup setting saved" });
    },
  });

  const saveGa4 = useMutation({
    mutationFn: async () => {
      const r = await adminPost("/api/admin/system-health/ga4-config", { measurementId: ga4MeasurementId, apiSecret: ga4ApiSecret });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-system-health"] });
      setGa4MeasurementId(""); setGa4ApiSecret("");
      toast({ title: "GA4 settings saved" });
    },
  });

  const chartData = (snapshots ?? []).slice().reverse().map(s => ({
    time: new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    cpu: s.cpuPct ?? 0,
    memPct: pct(s.memUsedBytes, s.memTotalBytes),
    diskPct: pct(s.diskUsedBytes, s.diskTotalBytes),
    dbMb: s.dbSizeBytes != null ? Math.round(s.dbSizeBytes / 1024 / 1024) : 0,
  }));

  return (
    <div className="p-6 space-y-6" data-testid="page-system-health">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">System Health</h1>
          <p className="text-sm text-muted-foreground mt-1">Server resources, database size, traffic, and cleanup tools.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh-health">
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Live metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Cpu} title="CPU" loading={isLoading}
          primary={health?.metrics.cpuPct != null ? `${health.metrics.cpuPct.toFixed(1)}%` : "—"}
          secondary={`Load: ${health?.metrics.loadAvg.map(n => n.toFixed(2)).join(" / ") ?? "—"}`}
          color="text-blue-500"
        />
        <MetricCard
          icon={MemoryStick} title="Memory" loading={isLoading}
          primary={health ? `${pct(health.metrics.memUsedBytes, health.metrics.memTotalBytes)}%` : "—"}
          secondary={health ? `${fmtBytes(health.metrics.memUsedBytes)} / ${fmtBytes(health.metrics.memTotalBytes)}` : ""}
          color="text-violet-500"
        />
        <MetricCard
          icon={HardDrive} title="Disk" loading={isLoading}
          primary={health ? `${pct(health.metrics.diskUsedBytes, health.metrics.diskTotalBytes)}%` : "—"}
          secondary={health ? `${fmtBytes(health.metrics.diskUsedBytes)} / ${fmtBytes(health.metrics.diskTotalBytes)}` : ""}
          color="text-orange-500"
        />
        <MetricCard
          icon={Database} title="Database" loading={isLoading}
          primary={fmtBytes(health?.db.totalBytes)}
          secondary={`Top table: ${health?.db.tables[0]?.name ?? "—"}`}
          color="text-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard icon={Activity} title="Active visitors (5m)" loading={isLoading} primary={String(health?.visitors.activeVisitors ?? 0)} secondary="" color="text-pink-500" />
        <MetricCard icon={Eye} title="Page views (24h)" loading={isLoading} primary={String(health?.visitors.pageViews24h ?? 0)} secondary="" color="text-cyan-500" />
        <MetricCard icon={Cpu} title="Process / Uptime" loading={isLoading} primary={fmtBytes(health?.metrics.processRssBytes)} secondary={health ? `${fmtUptime(health.metrics.uptimeSec)} • ${health.metrics.nodeVersion}` : ""} color="text-amber-500" />
      </div>

      {/* History chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">30-day Health History</CardTitle>
          <Button variant="outline" size="sm" onClick={() => snapshotMut.mutate()} disabled={snapshotMut.isPending} data-testid="button-record-snapshot">
            {snapshotMut.isPending ? "Recording..." : "Record snapshot now"}
          </Button>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No snapshots yet — daily cron runs at 04:00 UTC.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="cpu" name="CPU %" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="memPct" name="Mem %" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="diskPct" name="Disk %" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="dbMb" name="DB MB" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* DB tables */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top 20 Database Tables by Size</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr><th className="text-left py-2">Table</th><th className="text-right py-2">Size</th><th className="text-right py-2">Rows (est.)</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(health?.db.tables ?? []).map(t => (
                    <tr key={t.name} data-testid={`row-db-table-${t.name}`}>
                      <td className="py-1.5 font-mono text-xs">{t.name}</td>
                      <td className="py-1.5 text-right">{fmtBytes(t.sizeBytes)}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{t.rowEstimate.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleanup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Trash2 className="h-4 w-4" /> Orphaned Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Files in storage that no DB row references (older than 7 days).</p>
            {filesPreview && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span>Found:</span><Badge variant="secondary">{filesPreview.count}</Badge></div>
                <div className="flex justify-between"><span>Size:</span><span className="font-mono">{fmtBytes(filesPreview.freedBytes)}</span></div>
                {filesPreview.sampleNames.length > 0 && (
                  <div className="text-muted-foreground truncate">e.g. {filesPreview.sampleNames.slice(0, 3).join(", ")}</div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => cleanupFiles.mutate(false)} disabled={cleanupFiles.isPending} data-testid="button-scan-files">
                Dry run
              </Button>
              <Button variant="destructive" size="sm" onClick={() => cleanupFiles.mutate(true)} disabled={cleanupFiles.isPending || !filesPreview || filesPreview.count === 0} data-testid="button-cleanup-files">
                Clean now
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Expired Tokens & Old Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Expired password resets, sessions, page views &gt;90d, visitor sessions &gt;60d.</p>
            {tokensPreview && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span>Password resets:</span><span>{tokensPreview.passwordResetTokens}</span></div>
                <div className="flex justify-between"><span>Sessions:</span><span>{tokensPreview.sessions}</span></div>
                <div className="flex justify-between"><span>Old page views:</span><span>{tokensPreview.pageViews}</span></div>
                <div className="flex justify-between"><span>Old visitor sessions:</span><span>{tokensPreview.visitorSessions}</span></div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => purgeTokens.mutate(false)} disabled={purgeTokens.isPending} data-testid="button-scan-tokens">
                Dry run
              </Button>
              <Button variant="destructive" size="sm" onClick={() => purgeTokens.mutate(true)} disabled={purgeTokens.isPending || !tokensPreview} data-testid="button-purge-tokens">
                Purge now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Automation & GA4</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Auto-cleanup daily</Label>
              <p className="text-xs text-muted-foreground">Run orphan-file scan and token purge automatically at 04:00 UTC.</p>
            </div>
            <Switch
              checked={Boolean(health?.autoCleanupEnabled)}
              onCheckedChange={(v) => autoCleanup.mutate(v)}
              data-testid="switch-auto-cleanup"
            />
          </div>
          <div className="border-t pt-4 space-y-3">
            <div>
              <Label className="font-medium">GA4 Measurement Protocol</Label>
              <p className="text-xs text-muted-foreground">Forward client events to GA4 server-side. Status: {health?.ga4Configured ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">Configured</Badge> : <Badge variant="outline">Not configured</Badge>}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Measurement ID</Label>
                <Input placeholder="G-XXXXXXXXXX" value={ga4MeasurementId} onChange={(e) => setGa4MeasurementId(e.target.value)} data-testid="input-ga4-measurement-id" />
              </div>
              <div>
                <Label className="text-xs">API Secret</Label>
                <Input type="password" placeholder="••••••••" value={ga4ApiSecret} onChange={(e) => setGa4ApiSecret(e.target.value)} data-testid="input-ga4-api-secret" />
              </div>
            </div>
            <Button size="sm" onClick={() => saveGa4.mutate()} disabled={saveGa4.isPending || (!ga4MeasurementId && !ga4ApiSecret)} data-testid="button-save-ga4">
              Save GA4 settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, title, primary, secondary, color, loading }: {
  icon: React.ComponentType<{ className?: string }>; title: string; primary: string; secondary: string; color: string; loading?: boolean;
}): JSX.Element {
  return (
    <Card data-testid={`metric-${title.toLowerCase().replace(/\s|\//g, "-")}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase font-medium text-muted-foreground tracking-wider">{title}</p>
            {loading ? <Skeleton className="h-7 w-20 mt-1" /> : <p className="text-2xl font-bold font-display mt-1">{primary}</p>}
            {secondary && <p className="text-xs text-muted-foreground mt-1 truncate">{secondary}</p>}
          </div>
          <Icon className={`h-5 w-5 ${color} mt-1`} />
        </div>
      </CardContent>
    </Card>
  );
}
