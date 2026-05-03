import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Gauge, RefreshCw, Smartphone, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type PsResult = {
  id: number;
  strategy: "mobile" | "desktop";
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  lcpMs: number | null;
  fcpMs: number | null;
  clsScore: number | null;
  inpMs: number | null;
  ttfbMs: number | null;
  speedIndexMs: number | null;
  error: string | null;
  recordedAt: string;
};

const scoreColor = (s: number | null): string =>
  s === null ? "text-muted-foreground" : s >= 90 ? "text-green-600" : s >= 50 ? "text-amber-600" : "text-red-600";

const formatMs = (ms: number | null): string => {
  if (ms === null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
};

const authHeader = () => {
  const t = localStorage.getItem("auth_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export function PageSpeedTab({ websiteId }: { websiteId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");

  const { data, isLoading } = useQuery({
    queryKey: ["pagespeed", websiteId, strategy],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/websites/${websiteId}/pagespeed?strategy=${strategy}`, { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<{ results: PsResult[] }>;
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE_URL}/api/websites/${websiteId}/pagespeed/run`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ strategy }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Scan failed");
      }
      return res.json();
    },
    onSuccess: (body: { latest?: PsResult }) => {
      if (body.latest?.error) {
        toast({ title: "Scan completed with errors", description: body.latest.error.slice(0, 200), variant: "destructive" });
      } else {
        toast({ title: "PageSpeed scan complete" });
      }
      qc.invalidateQueries({ queryKey: ["pagespeed", websiteId, strategy] });
    },
    onError: (err) => toast({ title: "Scan failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }),
  });

  const results = data?.results ?? [];
  const latest = results[results.length - 1];

  const chartData = results
    .filter(r => r.performanceScore !== null)
    .map(r => ({
      date: new Date(r.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      Performance: r.performanceScore,
      SEO: r.seoScore,
      Accessibility: r.accessibilityScore,
      "Best Practices": r.bestPracticesScore,
    }));

  const vitalsData = results
    .filter(r => r.lcpMs !== null || r.clsScore !== null)
    .map(r => ({
      date: new Date(r.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      LCP: r.lcpMs,
      FCP: r.fcpMs,
      TTFB: r.ttfbMs,
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={strategy === "mobile" ? "default" : "outline"}
            onClick={() => setStrategy("mobile")}
            data-testid="button-strategy-mobile"
          >
            <Smartphone className="h-3.5 w-3.5 mr-1.5" /> Mobile
          </Button>
          <Button
            size="sm"
            variant={strategy === "desktop" ? "default" : "outline"}
            onClick={() => setStrategy("desktop")}
            data-testid="button-strategy-desktop"
          >
            <Monitor className="h-3.5 w-3.5 mr-1.5" /> Desktop
          </Button>
        </div>
        <Button size="sm" onClick={() => runMutation.mutate()} disabled={runMutation.isPending} data-testid="button-run-pagespeed">
          {runMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Gauge className="h-3.5 w-3.5 mr-1.5" />}
          Run PageSpeed Now
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Gauge className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">No PageSpeed data yet</p>
            <p className="text-xs text-muted-foreground">Run a scan to get Lighthouse scores and Core Web Vitals.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Performance", value: latest?.performanceScore },
              { label: "SEO", value: latest?.seoScore },
              { label: "Accessibility", value: latest?.accessibilityScore },
              { label: "Best Practices", value: latest?.bestPracticesScore },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className={`text-3xl font-bold font-display mt-1 ${scoreColor(s.value ?? null)}`}>{s.value ?? "—"}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Lighthouse Scores Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Performance" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="SEO" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="Accessibility" stroke="#f59e0b" strokeWidth={2} />
                    <Line type="monotone" dataKey="Best Practices" stroke="#8b5cf6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">LCP</p><p className="text-xl font-bold mt-1">{formatMs(latest?.lcpMs ?? null)}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">FCP</p><p className="text-xl font-bold mt-1">{formatMs(latest?.fcpMs ?? null)}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">CLS</p><p className="text-xl font-bold mt-1">{latest?.clsScore !== null && latest?.clsScore !== undefined ? latest.clsScore.toFixed(3) : "—"}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">TTFB</p><p className="text-xl font-bold mt-1">{formatMs(latest?.ttfbMs ?? null)}</p></CardContent></Card>
          </div>

          {vitalsData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Core Web Vitals Trend (ms)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vitalsData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="LCP" stroke="#ef4444" strokeWidth={2} />
                      <Line type="monotone" dataKey="FCP" stroke="#3b82f6" strokeWidth={2} />
                      <Line type="monotone" dataKey="TTFB" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {latest?.error && (
            <Card className="border-amber-300 bg-amber-50/60">
              <CardContent className="py-3 text-xs text-amber-900">
                Last scan error: {latest.error}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
