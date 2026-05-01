import { useState, useMemo, useEffect } from "react";
import PlanLimitWarning from "@/components/PlanLimitWarning";
import { Plus, Search, Sparkles, Trash2, Camera, TrendingUp, TrendingDown, ChevronRight, Layers, TableProperties, X, Clock, Zap, FlaskConical, BarChart2, BookOpen, History, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useListKeywords,
  useCreateKeyword,
  useDeleteKeyword,
  useUpdateKeyword,
  useSuggestKeywords,
  useClusterKeywords,
  useListWebsites,
  useGetSettings,
  useUpdateSettings,
  useGetKeywordRankHistory,
  useSnapshotKeywordRanks,
  useGetBillingMe,
  useResearchKeywords,
  useGetKeywordResearchHistory,
  getListKeywordsQueryKey,
  getGetKeywordRankHistoryQueryKey,
  getGetSettingsQueryKey,
  getGetBillingMeQueryKey,
  getGetKeywordResearchHistoryQueryKey,
} from "@workspace/api-client-react";
import type { Keyword, KeywordRankHistory, KeywordResearchSuggestion } from "@workspace/api-client-react";

const createSchema = z.object({
  websiteId: z.coerce.number().min(1, "Website is required"),
  keyword: z.string().min(1, "Keyword is required"),
  currentRank: z.coerce.number().optional().nullable(),
  searchVolume: z.coerce.number().optional().nullable(),
  difficulty: z.coerce.number().min(0).max(100).optional().nullable(),
  status: z.enum(["tracking", "paused"]).default("tracking"),
  notes: z.string().optional().nullable(),
});

type CreateForm = z.infer<typeof createSchema>;

const INTENT_COLORS: Record<string, string> = {
  informational: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  commercial: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  navigational: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  transactional: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function IntentBadge({ intent }: { intent: string | null | undefined }) {
  if (!intent) return null;
  const cls = INTENT_COLORS[intent] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {intent}
    </span>
  );
}

function Sparkline({ history }: { history: KeywordRankHistory[] }) {
  const pts = history
    .filter((h) => h.rank !== null && h.rank !== undefined)
    .map((h) => ({ date: h.recordedDate, rank: h.rank as number }));

  if (pts.length < 2) {
    return <span className="text-xs text-muted-foreground">no data</span>;
  }

  const W = 80, H = 26, pad = 3;
  const ranks = pts.map((p) => p.rank);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  const range = maxRank - minRank || 1;

  const coordPts = pts.map((p, i) => ({
    x: pad + (i / (pts.length - 1)) * (W - pad * 2),
    y: pad + ((p.rank - minRank) / range) * (H - pad * 2),
    rank: p.rank,
    date: p.date,
  }));

  const polylinePoints = coordPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const lastRank = pts[pts.length - 1].rank;
  const firstRank = pts[0].rank;
  const color = lastRank < firstRank ? "#22c55e" : lastRank > firstRank ? "#ef4444" : "#94a3b8";

  return (
    <svg width={W} height={H} className="overflow-visible shrink-0" role="img" aria-label="Rank trend sparkline">
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coordPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="transparent" stroke="transparent">
          <title>{`Rank #${p.rank} on ${p.date}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function getMovementBadge(history: KeywordRankHistory[]): "up" | "down" | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));
  const newest = sorted[sorted.length - 1];
  if (!newest.rank) return null;
  const sevenDaysAgoStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const weekOld = sorted.findLast((h) => h.recordedDate <= sevenDaysAgoStr);
  if (!weekOld || !weekOld.rank) return null;
  const diff = weekOld.rank - newest.rank;
  if (diff >= 5) return "up";
  if (diff <= -5) return "down";
  return null;
}

function KeywordRowWithHistory({
  kw,
  onSelect,
  onDelete,
  deleteIsPending,
  allClusters,
  onClusterChange,
}: {
  kw: Keyword;
  onSelect: (kw: Keyword) => void;
  onDelete: (id: number) => void;
  deleteIsPending: boolean;
  allClusters: string[];
  onClusterChange: (id: number, cluster: string | null) => void;
}) {
  const { data: history30 } = useGetKeywordRankHistory(kw.id, { days: 30 });
  const movement = history30 ? getMovementBadge(history30) : null;

  const difficultyColor = (d: number | null | undefined) => {
    if (!d) return "";
    if (d >= 70) return "text-red-600 dark:text-red-400";
    if (d >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  return (
    <tr
      data-testid={`row-keyword-${kw.id}`}
      className="border-b last:border-0 hover:bg-muted/20 group cursor-pointer"
      onClick={() => onSelect(kw)}
    >
      <td className="px-4 py-3 font-medium">
        <span className="flex items-center gap-1.5">
          {kw.keyword}
          {movement === "up" && (
            <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400 text-xs font-semibold" title="Moved up 5+ positions in last 7 days">
              <TrendingUp className="h-3 w-3" />
            </span>
          )}
          {movement === "down" && (
            <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400 text-xs font-semibold" title="Dropped 5+ positions in last 7 days">
              <TrendingDown className="h-3 w-3" />
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm">{kw.currentRank ?? "—"}</td>
      <td className="px-4 py-3 text-right text-muted-foreground">{kw.searchVolume?.toLocaleString() ?? "—"}</td>
      <td className={`px-4 py-3 text-right font-semibold ${difficultyColor(kw.difficulty)}`}>{kw.difficulty ?? "—"}</td>
      <td className="px-4 py-3 text-center">
        <Badge variant={kw.status === "tracking" ? "default" : "secondary"} className="text-xs">{kw.status}</Badge>
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <Select
          value={kw.cluster ?? "__none__"}
          onValueChange={(v) => onClusterChange(kw.id, v === "__none__" ? null : v)}
        >
          <SelectTrigger className="h-7 text-xs min-w-[110px] w-fit border-dashed">
            <SelectValue placeholder="No cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No cluster</SelectItem>
            {allClusters.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {history30 ? (
            history30.some((h) => h.rank !== null) ? (
              <Sparkline history={history30} />
            ) : (
              <span className="w-20 text-xs text-right text-muted-foreground">no data</span>
            )
          ) : (
            <Skeleton className="h-5 w-20" />
          )}
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
            data-testid={`button-delete-keyword-${kw.id}`}
            onClick={(e) => { e.stopPropagation(); onDelete(kw.id); }}
            disabled={deleteIsPending}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

const DATE_RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

function KeywordDetailPanel({
  keyword,
  open,
  onClose,
}: {
  keyword: Keyword | null;
  open: boolean;
  onClose: () => void;
}) {
  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90>(90);

  const { data: history90, isLoading } = useGetKeywordRankHistory(
    keyword?.id ?? 0,
    { days: selectedDays },
    { query: { enabled: !!keyword && open } },
  );

  const stats = useMemo(() => {
    if (!history90 || history90.length === 0) return null;
    const ranked = history90.filter((h) => h.rank !== null && h.rank !== undefined) as Array<KeywordRankHistory & { rank: number }>;
    if (ranked.length === 0) return null;
    const ranks = ranked.map((h) => h.rank);
    const best = Math.min(...ranks);
    const worst = Math.max(...ranks);
    const sorted = [...ranked].sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));
    const oldest = sorted[0];
    const newest = sorted[sorted.length - 1];
    const changePeriod = oldest && newest ? oldest.rank - newest.rank : null;
    return { best, worst, changePeriod };
  }, [history90]);

  const chartData = useMemo(() => {
    if (!history90) return [];
    return history90
      .filter((h) => h.rank !== null)
      .map((h) => ({ date: h.recordedDate.slice(5), rank: h.rank }));
  }, [history90]);

  if (!keyword) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate">{keyword.keyword}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xl font-bold font-mono text-green-600 dark:text-green-400">#{stats.best}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Best rank</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xl font-bold font-mono text-red-600 dark:text-red-400">#{stats.worst}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Worst rank</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                {stats.changePeriod === null ? (
                  <div className="text-xl font-bold font-mono text-muted-foreground">—</div>
                ) : stats.changePeriod > 0 ? (
                  <div className="text-xl font-bold font-mono text-green-600 dark:text-green-400">+{stats.changePeriod}</div>
                ) : stats.changePeriod < 0 ? (
                  <div className="text-xl font-bold font-mono text-red-600 dark:text-red-400">{stats.changePeriod}</div>
                ) : (
                  <div className="text-xl font-bold font-mono text-muted-foreground">0</div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">{selectedDays}d change</div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Rank history</h3>
              <div className="flex gap-1">
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => setSelectedDays(opt.days)}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                      selectedDays === opt.days
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : chartData.length < 2 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground border rounded-md">
                Not enough data yet — take a snapshot to start tracking.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={208}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                  <YAxis
                    reversed
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [`#${v}`, "Rank"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="rank" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1.5 border-t pt-4">
            <div className="flex justify-between"><span>Current rank</span><span className="font-mono">{keyword.currentRank ?? "—"}</span></div>
            <div className="flex justify-between"><span>Search volume</span><span>{keyword.searchVolume?.toLocaleString() ?? "—"}</span></div>
            <div className="flex justify-between"><span>Difficulty</span><span>{keyword.difficulty ?? "—"}</span></div>
            <div className="flex justify-between"><span>Status</span><span className="capitalize">{keyword.status}</span></div>
            {keyword.cluster && <div className="flex justify-between"><span>Cluster</span><span>{keyword.cluster}</span></div>}
            {keyword.intent && <div className="flex justify-between"><span>Intent</span><span className="capitalize">{keyword.intent}</span></div>}
            {keyword.notes && <div className="pt-1"><span className="font-medium">Notes:</span> {keyword.notes}</div>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ClustersView({
  keywords,
  websiteId,
  aiDisabled,
  onClusterChange,
}: {
  keywords: Keyword[];
  websiteId: number | null;
  aiDisabled: boolean;
  onClusterChange: (id: number, cluster: string | null, intent?: string | null, callbacks?: { onSuccess?: () => void; onError?: () => void }) => void;
}) {
  const { toast } = useToast();
  const clusterMutation = useClusterKeywords();

  const grouped = useMemo(() => {
    const map = new Map<string, { intent: string | null; keywords: Keyword[] }>();
    for (const kw of keywords) {
      const key = kw.cluster ?? "__unclustered__";
      const existing = map.get(key);
      if (existing) {
        existing.keywords.push(kw);
      } else {
        map.set(key, { intent: kw.intent ?? null, keywords: [kw] });
      }
    }
    return map;
  }, [keywords]);

  const handleAiCluster = () => {
    if (!websiteId) {
      toast({ title: "Select a website filter first to cluster its keywords", variant: "destructive" });
      return;
    }
    if (keywords.length === 0) {
      toast({ title: "No keywords to cluster", variant: "destructive" });
      return;
    }
    const kwStrings = keywords.map((k) => k.keyword);
    clusterMutation.mutate(
      { data: { websiteId, keywords: kwStrings } },
      {
        onSuccess: async (result) => {
          const kwByText = new Map<string, Keyword[]>();
          for (const kw of keywords) {
            const lower = kw.keyword.toLowerCase();
            const existing = kwByText.get(lower);
            if (existing) existing.push(kw);
            else kwByText.set(lower, [kw]);
          }

          const updates: Array<{ id: number; cluster: string; intent: string }> = [];
          for (const cluster of result.clusters) {
            for (const kwStr of cluster.keywords) {
              const matches = kwByText.get(kwStr.toLowerCase());
              if (matches) {
                for (const match of matches) {
                  updates.push({ id: match.id, cluster: cluster.name, intent: cluster.intent });
                  kwByText.delete(kwStr.toLowerCase());
                }
              }
            }
          }

          const results = await Promise.allSettled(
            updates.map((u) =>
              new Promise<void>((resolve, reject) =>
                onClusterChange(u.id, u.cluster, u.intent, { onSuccess: resolve, onError: reject }),
              ),
            ),
          );

          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed > 0) {
            toast({ title: `Clustered ${updates.length - failed} keywords (${failed} failed to save)`, variant: "destructive" });
          } else {
            toast({ title: `Clustered ${updates.length} keywords into ${result.clusters.length} groups` });
          }
        },
        onError: () => toast({ title: "AI clustering failed", variant: "destructive" }),
      },
    );
  };

  const clusters = Array.from(grouped.entries());
  const unclustered = clusters.find(([k]) => k === "__unclustered__");
  const named = clusters.filter(([k]) => k !== "__unclustered__");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {named.length > 0
            ? `${named.length} cluster${named.length !== 1 ? "s" : ""} — ${keywords.length} keywords total`
            : "No clusters yet. Use AI Cluster to group your keywords automatically."}
        </p>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-ai-cluster"
          onClick={handleAiCluster}
          disabled={clusterMutation.isPending || aiDisabled || !websiteId}
          title={aiDisabled ? "AI is disabled — enable in Settings" : !websiteId ? "Filter by a website first" : undefined}
        >
          <Sparkles className="h-4 w-4 mr-1.5" />
          {clusterMutation.isPending ? "Clustering..." : "AI Cluster"}
        </Button>
      </div>

      {named.length === 0 && !unclustered && keywords.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No keywords tracked yet</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {named.map(([clusterName, { intent, keywords: kwList }]) => (
          <Card key={clusterName} data-testid={`cluster-card-${clusterName}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-semibold text-sm leading-tight">{clusterName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{kwList.length} keyword{kwList.length !== 1 ? "s" : ""}</p>
                </div>
                <IntentBadge intent={intent} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {kwList.map((kw) => (
                  <span
                    key={kw.id}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground"
                  >
                    {kw.keyword}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {unclustered && unclustered[1].keywords.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Unclustered ({unclustered[1].keywords.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {unclustered[1].keywords.map((kw) => (
              <span
                key={kw.id}
                className="inline-flex items-center px-2 py-0.5 rounded border text-xs text-muted-foreground"
              >
                {kw.keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const VOLUME_BAND_ORDER = ["<100", "100-1K", "1K-10K", "10K+"] as const;

const VOLUME_BAND_COLORS: Record<string, string> = {
  "<100": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  "100-1K": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "1K-10K": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  "10K+": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

function DifficultyBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-red-500" : value >= 40 ? "bg-yellow-400" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden min-w-[48px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums w-5 text-right">{value}</span>
    </div>
  );
}

function KeywordResearchPanel({ aiDisabled, websites }: {
  aiDisabled: boolean;
  websites: Array<{ id: number; name: string; url: string }>;
}) {
  const [seedInput, setSeedInput] = useState("");
  const [results, setResults] = useState<KeywordResearchSuggestion[] | null>(null);
  const [sessionSeed, setSessionSeed] = useState<string | null>(null);
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [volumeFilter, setVolumeFilter] = useState<string>("all");
  const [maxDifficulty, setMaxDifficulty] = useState<string>("100");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>(
    websites.length === 1 ? String(websites[0].id) : "none"
  );
  const [trackedKeywords, setTrackedKeywords] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (selectedWebsiteId === "none" && websites.length === 1) {
      setSelectedWebsiteId(String(websites[0].id));
    }
  }, [websites, selectedWebsiteId]);

  const researchMutation = useResearchKeywords();
  const createKeywordMutation = useCreateKeyword();
  const { data: history } = useGetKeywordResearchHistory({
    query: { queryKey: getGetKeywordResearchHistoryQueryKey() },
  });

  const handleResearch = () => {
    const trimmed = seedInput.trim();
    if (!trimmed) return;
    const wsIdNum = parseInt(selectedWebsiteId, 10);
    researchMutation.mutate(
      { data: { seedInput: trimmed, websiteId: !isNaN(wsIdNum) && wsIdNum > 0 ? wsIdNum : undefined } },
      {
        onSuccess: (data) => {
          setResults(data.suggestions);
          setSessionSeed(data.seedInput);
          setIntentFilter("all");
          setVolumeFilter("all");
          setMaxDifficulty("100");
          setTrackedKeywords(new Set());
          queryClient.invalidateQueries({ queryKey: getGetKeywordResearchHistoryQueryKey() });
        },
        onError: () => toast({ title: "Research failed — please try again", variant: "destructive" }),
      },
    );
  };

  const handleLoadHistory = (session: { seedInput: string; suggestions: KeywordResearchSuggestion[] }) => {
    setSessionSeed(session.seedInput);
    setSeedInput(session.seedInput);
    setResults(session.suggestions);
    setIntentFilter("all");
    setVolumeFilter("all");
    setMaxDifficulty("100");
    setTrackedKeywords(new Set());
  };

  const handleTrack = (s: KeywordResearchSuggestion) => {
    const wsId = parseInt(selectedWebsiteId, 10);
    if (!wsId || isNaN(wsId)) {
      toast({ title: "Select a website first to track this keyword", variant: "destructive" });
      return;
    }
    createKeywordMutation.mutate(
      {
        data: {
          websiteId: wsId,
          keyword: s.keyword,
          difficulty: s.difficulty,
          intent: s.intent as "informational" | "commercial" | "navigational" | "transactional",
          status: "tracking",
        },
      },
      {
        onSuccess: () => {
          setTrackedKeywords((prev) => new Set([...prev, s.keyword]));
          queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
          toast({ title: `"${s.keyword}" added to tracking` });
        },
        onError: () => toast({ title: "Failed to add keyword", variant: "destructive" }),
      },
    );
  };

  const maxDiffNum = parseInt(maxDifficulty, 10) || 100;

  const filtered = useMemo(() => {
    if (!results) return [];
    return results.filter((s) => {
      if (intentFilter !== "all" && s.intent !== intentFilter) return false;
      if (volumeFilter !== "all" && s.volumeBand !== volumeFilter) return false;
      if (s.difficulty > maxDiffNum) return false;
      return true;
    });
  }, [results, intentFilter, volumeFilter, maxDiffNum]);

  return (
    <div className="space-y-4">
      {/* Input card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">Seed keyword or competitor URL</p>
            <p className="text-xs text-muted-foreground">Enter a topic, keyword, or a competitor's domain to discover keyword opportunities</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Input
              data-testid="research-seed-input"
              placeholder="e.g. &quot;content marketing&quot; or competitor.com"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !researchMutation.isPending && handleResearch()}
              disabled={aiDisabled || researchMutation.isPending}
              className="flex-1 min-w-48"
            />
            {websites.length >= 1 && (
              <Select value={selectedWebsiteId} onValueChange={setSelectedWebsiteId}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Select website" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No website</SelectItem>
                  {websites.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>{w.name || w.url}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              data-testid="research-submit-button"
              onClick={handleResearch}
              disabled={aiDisabled || !seedInput.trim() || researchMutation.isPending}
            >
              {researchMutation.isPending ? (
                <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 animate-pulse" />Researching…</span>
              ) : (
                <span className="flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" />Research</span>
              )}
            </Button>
          </div>
          {aiDisabled && (
            <p className="text-xs text-amber-600 dark:text-amber-400">AI is disabled. Enable it in Settings → AI to use keyword research.</p>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {!results && history && history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><History className="h-3.5 w-3.5" />Recent sessions</p>
          <div className="flex flex-wrap gap-2">
            {history.map((session) => (
              <button
                key={session.id}
                onClick={() => handleLoadHistory(session)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs hover:bg-muted/80 transition-colors border"
              >
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                {session.seedInput}
                <span className="text-muted-foreground">({(session.suggestions as KeywordResearchSuggestion[]).length})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {researchMutation.isPending && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Sparkles className="h-4 w-4 animate-pulse text-purple-500" />
              Analysing keywords for <span className="font-medium text-foreground">{seedInput}</span>…
            </div>
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && !researchMutation.isPending && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{filtered.length}</span> suggestions for <span className="font-medium text-foreground italic">{sessionSeed}</span>
            </p>
            <div className="flex gap-2 flex-wrap">
              <Select value={intentFilter} onValueChange={setIntentFilter}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Filter intent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All intents</SelectItem>
                  <SelectItem value="informational">Informational</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="transactional">Transactional</SelectItem>
                  <SelectItem value="navigational">Navigational</SelectItem>
                </SelectContent>
              </Select>
              <Select value={volumeFilter} onValueChange={setVolumeFilter}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Filter volume" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All volumes</SelectItem>
                  {VOLUME_BAND_ORDER.map((v) => (
                    <SelectItem key={v} value={v}>{v}/mo</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={maxDifficulty} onValueChange={setMaxDifficulty}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Max difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">Any difficulty</SelectItem>
                  <SelectItem value="30">Easy (≤ 30)</SelectItem>
                  <SelectItem value="60">Medium (≤ 60)</SelectItem>
                  <SelectItem value="80">Hard (≤ 80)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {websites.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Add a website first to be able to track keywords from this list.
            </p>
          )}

          <Card>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No suggestions match your filters</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Keyword</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Volume/mo</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-36">Difficulty</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Intent</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Content angle</th>
                        <th className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s, i) => {
                        const isTracked = trackedKeywords.has(s.keyword);
                        return (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium">{s.keyword}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${VOLUME_BAND_COLORS[s.volumeBand] ?? ""}`}>
                                {s.volumeBand}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <DifficultyBar value={s.difficulty} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <IntentBadge intent={s.intent} />
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs">{s.contentAngle}</td>
                            <td className="px-4 py-3 text-right">
                              {isTracked ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                                  <TrendingUp className="h-3 w-3" />Tracking
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  disabled={websites.length === 0 || createKeywordMutation.isPending}
                                  onClick={() => handleTrack(s)}
                                  data-testid={`track-keyword-${i}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" />Track
                                </Button>
                              )}
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

          <button
            onClick={() => { setResults(null); setSessionSeed(null); setSeedInput(""); setTrackedKeywords(new Set()); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Clear results
          </button>
        </div>
      )}
    </div>
  );
}

const KEYWORD_TIP_KEY = "tip_first_keyword_dismissed";

const KW_LIMIT_NUDGE_KEY = "nudge_kw_limit_dismissed";

export default function Keywords() {
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [kwTipDismissedLocal, setKwTipDismissedLocal] = useState(() => localStorage.getItem(KEYWORD_TIP_KEY) === "true");
  const [kwNudgeDismissed, setKwNudgeDismissed] = useState(() => localStorage.getItem(KW_LIMIT_NUDGE_KEY) === "true");
  const [aiNiche, setAiNiche] = useState("");
  const [aiResult, setAiResult] = useState<Array<{ keyword: string; intent: string; estimatedDifficulty: string; notes: string }>>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "clusters" | "research">("table");
  const [clusterFilter, setClusterFilter] = useState<string>("__all__");
  const [websiteFilter, setWebsiteFilter] = useState<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const { data: keywords, isLoading } = useListKeywords();
  const { data: websites } = useListWebsites();
  const { data: billing } = useGetBillingMe({ query: { queryKey: getGetBillingMeQueryKey() } });
  const createMutation = useCreateKeyword();
  const deleteMutation = useDeleteKeyword();
  const updateMutation = useUpdateKeyword();
  const suggestMutation = useSuggestKeywords();
  const snapshotMutation = useSnapshotKeywordRanks();
  const updateSettingsMutation = useUpdateSettings();
  const { data: settings } = useGetSettings();
  const aiProvider = settings?.aiProvider ?? "replit";
  const aiDisabled = settings !== undefined && (!settings.aiEnabled || (aiProvider !== "replit" && !settings.aiApiKeyConfigured));

  const serverDismissedTips = settings?.dismissedTips ?? null;
  const kwTipDismissed = kwTipDismissedLocal || (serverDismissedTips?.includes(KEYWORD_TIP_KEY) ?? false);

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { keyword: "", status: "tracking", notes: "", currentRank: null, searchVolume: null, difficulty: null },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({ data: data as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
        toast({ title: "Keyword added" });
        form.reset();
        setOpen(false);
      },
      onError: () => toast({ title: "Failed to add keyword", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
        if (selectedKeyword?.id === id) setSelectedKeyword(null);
      },
    });
  };

  const handleSnapshot = () => {
    snapshotMutation.mutate({}, {
      onSuccess: (result) => {
        const failedNote = result.failed > 0 ? ` (${result.failed} failed)` : "";
        toast({ title: `Snapshot complete — ${result.snapshotted} keywords captured for ${result.date}${failedNote}` });
        (keywords ?? []).forEach((kw) => {
          queryClient.invalidateQueries({ queryKey: getGetKeywordRankHistoryQueryKey(kw.id) });
        });
      },
      onError: () => toast({ title: "Snapshot failed", variant: "destructive" }),
    });
  };

  const handleAiSuggest = () => {
    if (!aiNiche.trim()) return;
    suggestMutation.mutate({ data: { niche: aiNiche } }, {
      onSuccess: (result) => setAiResult(result.keywords),
      onError: () => toast({ title: "AI suggestion failed", variant: "destructive" }),
    });
  };

  const handleClusterChange = (id: number, cluster: string | null, intent?: string | null, callbacks?: { onSuccess?: () => void; onError?: () => void }) => {
    const updateData: Record<string, unknown> = { cluster };
    if (intent !== undefined) updateData.intent = intent;
    updateMutation.mutate(
      { id, data: updateData as Parameters<typeof updateMutation.mutate>[0]["data"] },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
          callbacks?.onSuccess?.();
        },
        onError: () => {
          toast({ title: "Failed to update cluster", variant: "destructive" });
          callbacks?.onError?.();
        },
      },
    );
  };

  const dismissKwTip = () => {
    localStorage.setItem(KEYWORD_TIP_KEY, "true");
    setKwTipDismissedLocal(true);
    const current = serverDismissedTips ?? [];
    if (!current.includes(KEYWORD_TIP_KEY)) {
      updateSettingsMutation.mutate(
        { data: { dismissedTips: [...current, KEYWORD_TIP_KEY] } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() }) },
      );
    }
  };

  const showFirstKeywordTip = !kwTipDismissed && (keywords ?? []).length === 1;

  const isStarterPlan = billing?.plan === "starter";
  const kwUsed = billing?.usage?.keywords ?? 0;
  const kwLimit = billing?.limits?.keywords ?? 25;
  const showKwLimitNudge = isStarterPlan && !kwNudgeDismissed && kwUsed >= 20;

  const dismissKwNudge = () => {
    localStorage.setItem(KW_LIMIT_NUDGE_KEY, "true");
    setKwNudgeDismissed(true);
  };

  const allClusters = useMemo(() => {
    const names = new Set<string>();
    for (const kw of keywords ?? []) {
      if (kw.cluster) names.add(kw.cluster);
    }
    return Array.from(names).sort();
  }, [keywords]);

  const websiteFiltered = useMemo(() => {
    if (!websiteFilter) return keywords ?? [];
    return (keywords ?? []).filter((k) => k.websiteId === websiteFilter);
  }, [keywords, websiteFilter]);

  const filtered = useMemo(() => {
    return websiteFiltered.filter((k) => {
      if (search && !k.keyword.toLowerCase().includes(search.toLowerCase())) return false;
      if (clusterFilter !== "__all__") {
        if (clusterFilter === "__none__") return !k.cluster;
        return k.cluster === clusterFilter;
      }
      return true;
    });
  }, [websiteFiltered, search, clusterFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Keywords</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your SEO keyword rankings</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              data-testid="button-snapshot-ranks"
              onClick={handleSnapshot}
              disabled={snapshotMutation.isPending}
            >
              <Camera className="h-4 w-4 mr-1" />
              {snapshotMutation.isPending ? "Snapshotting..." : "Snapshot ranks now"}
            </Button>
          )}
          <Dialog open={aiOpen} onOpenChange={setAiOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline" size="sm"
                data-testid="button-ai-suggest"
                disabled={aiDisabled}
                title={aiDisabled ? "AI is disabled — enable in Settings" : undefined}
              >
                <Sparkles className="h-4 w-4 mr-1" /> AI Suggest
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>AI Keyword Suggestions</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Your niche</label>
                  <Input
                    data-testid="input-ai-niche"
                    className="mt-1"
                    placeholder="e.g. health & fitness"
                    value={aiNiche}
                    onChange={e => setAiNiche(e.target.value)}
                  />
                </div>
                <Button data-testid="button-get-suggestions" onClick={handleAiSuggest} disabled={suggestMutation.isPending || !aiNiche.trim()} className="w-full">
                  {suggestMutation.isPending ? "Generating..." : "Get Suggestions"}
                </Button>
                {aiResult.length > 0 && (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {aiResult.map((kw, i) => (
                      <div key={i} data-testid={`suggestion-keyword-${i}`} className="p-3 border rounded-md text-sm">
                        <p className="font-semibold">{kw.keyword}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{kw.intent}</Badge>
                          <Badge variant="outline" className="text-xs">{kw.estimatedDifficulty}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{kw.notes}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-keyword">
                <Plus className="h-4 w-4 mr-1" /> Add Keyword
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Keyword</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="websiteId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <Select value={String(field.value ?? "")} onValueChange={v => field.onChange(parseInt(v))}>
                        <FormControl><SelectTrigger data-testid="select-keyword-website"><SelectValue placeholder="Select website" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(websites ?? []).map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="keyword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Keyword</FormLabel>
                      <FormControl><Input {...field} data-testid="input-keyword" placeholder="best running shoes" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-3 gap-3">
                    <FormField control={form.control} name="currentRank" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rank</FormLabel>
                        <FormControl><Input {...field} type="number" data-testid="input-keyword-rank" placeholder="5" value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="searchVolume" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Volume</FormLabel>
                        <FormControl><Input {...field} type="number" data-testid="input-keyword-volume" placeholder="1000" value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="difficulty" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty</FormLabel>
                        <FormControl><Input {...field} type="number" data-testid="input-keyword-difficulty" placeholder="45" value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger data-testid="select-keyword-status"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="tracking">Tracking</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea {...field} data-testid="input-keyword-notes" placeholder="Optional..." value={field.value ?? ""} rows={2} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" data-testid="button-submit-keyword" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Adding..." : "Add Keyword"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-search-keywords" className="pl-8 w-56" placeholder="Search keywords..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {(websites ?? []).length > 1 && (
          <Select value={websiteFilter ? String(websiteFilter) : "__all__"} onValueChange={(v) => setWebsiteFilter(v === "__all__" ? null : parseInt(v))}>
            <SelectTrigger className="w-44" data-testid="select-filter-website">
              <SelectValue placeholder="All websites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All websites</SelectItem>
              {(websites ?? []).map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {activeTab === "table" && allClusters.length > 0 && (
          <Select value={clusterFilter} onValueChange={setClusterFilter}>
            <SelectTrigger className="w-44" data-testid="select-filter-cluster">
              <SelectValue placeholder="All clusters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All clusters</SelectItem>
              <SelectItem value="__none__">Unclustered</SelectItem>
              {allClusters.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!showKwLimitNudge && <PlanLimitWarning billing={billing} metric="keywords" />}

      {/* Keyword limit nudge */}
      {showKwLimitNudge && (
        <div
          data-testid="banner-kw-limit-nudge"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm"
        >
          <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="flex-1 text-amber-900 dark:text-amber-200">
            You're using <strong>{kwUsed} of {kwLimit} keywords</strong> on your Starter plan.{" "}
            <Link href="/pricing" className="font-semibold underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100">
              Upgrade to Growth
            </Link>{" "}
            to track up to 200 keywords.
          </p>
          <button
            data-testid="button-dismiss-kw-limit-nudge"
            onClick={dismissKwNudge}
            className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors shrink-0"
            aria-label="Dismiss upgrade nudge"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* First keyword tip */}
      {showFirstKeywordTip && (
        <div
          data-testid="banner-first-keyword-tip"
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3 text-sm"
        >
          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <p className="flex-1 text-blue-900 dark:text-blue-200">
            Your first snapshot will appear within 24 hours. Check back here to see ranking trends.
          </p>
          <button
            data-testid="button-dismiss-first-keyword-tip"
            onClick={dismissKwTip}
            className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 transition-colors shrink-0"
            aria-label="Dismiss tip"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        <button
          data-testid="tab-table"
          onClick={() => setActiveTab("table")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "table"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <TableProperties className="h-3.5 w-3.5" />
          Table
        </button>
        <button
          data-testid="tab-clusters"
          onClick={() => setActiveTab("clusters")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "clusters"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Clusters
        </button>
        <button
          data-testid="tab-research"
          onClick={() => setActiveTab("research")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "research"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Research
        </button>
      </div>

      {activeTab === "table" && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{search ? "No keywords match" : "No keywords tracked yet"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Keyword</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Rank</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Volume</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Difficulty</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Cluster</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">30-day trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(kw => (
                      <KeywordRowWithHistory
                        key={kw.id}
                        kw={kw}
                        onSelect={setSelectedKeyword}
                        onDelete={handleDelete}
                        deleteIsPending={deleteMutation.isPending}
                        allClusters={allClusters}
                        onClusterChange={handleClusterChange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "clusters" && (
        <ClustersView
          keywords={websiteFiltered}
          websiteId={websiteFilter ?? (websites && websites.length === 1 ? websites[0].id : null)}
          aiDisabled={aiDisabled}
          onClusterChange={handleClusterChange}
        />
      )}

      {activeTab === "research" && (
        <KeywordResearchPanel
          aiDisabled={aiDisabled}
          websites={websites ?? []}
        />
      )}

      <KeywordDetailPanel
        keyword={selectedKeyword}
        open={!!selectedKeyword}
        onClose={() => setSelectedKeyword(null)}
      />
    </div>
  );
}
