import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FlaskConical, Plus, Trophy, X, ChevronDown, ChevronUp,
  Trash2, ToggleLeft, ToggleRight, Copy, CheckCheck,
  MousePointerClick, Eye
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type AbTestType = "headline" | "cta" | "meta_description" | "ad_copy";
type AbTestStatus = "active" | "closed";

interface AbVariant {
  id: number;
  testId: number;
  name: string;
  content: string;
  impressions: number;
  clicks: number;
  createdAt: string;
}

interface AbTest {
  id: number;
  name: string;
  type: AbTestType;
  status: AbTestStatus;
  winnerThreshold: number;
  notes: string | null;
  createdAt: string;
  variants: AbVariant[];
}

const TYPE_LABELS: Record<AbTestType, string> = {
  headline: "Headline",
  cta: "CTA",
  meta_description: "Meta Description",
  ad_copy: "Ad Copy",
};

const TYPE_COLORS: Record<AbTestType, string> = {
  headline: "bg-blue-500/10 text-blue-600",
  cta: "bg-green-500/10 text-green-600",
  meta_description: "bg-purple-500/10 text-purple-600",
  ad_copy: "bg-amber-500/10 text-amber-600",
};

const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

function ctr(variant: AbVariant): number {
  if (variant.impressions === 0) return 0;
  return parseFloat(((variant.clicks / variant.impressions) * 100).toFixed(1));
}

function findWinner(variants: AbVariant[], threshold: number): AbVariant | null {
  const eligible = variants.filter((v) => v.impressions >= threshold);
  if (eligible.length < 2) return null;
  const sorted = [...eligible].sort((a, b) => ctr(b) - ctr(a));
  if (ctr(sorted[0]) > ctr(sorted[1])) return sorted[0];
  return null;
}

function TrackingSnippet({ testId, variantId }: { testId: number; variantId: number }) {
  const [copied, setCopied] = useState<"imp" | "click" | null>(null);
  const impUrl = `${API_ORIGIN}/track/ab/${testId}/${variantId}?event=impression`;
  const clickUrl = `${API_ORIGIN}/track/ab/${testId}/${variantId}?event=click`;

  function copy(text: string, key: "imp" | "click") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="space-y-1.5 mt-2">
      <p className="text-xs font-medium text-muted-foreground">Tracking URLs</p>
      {[
        { label: "Impression", url: impUrl, key: "imp" as const },
        { label: "Click", url: clickUrl, key: "click" as const },
      ].map(({ label, url, key }) => (
        <div key={key} className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1.5">
          <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
          <span className="text-xs font-mono truncate flex-1 text-foreground/70" title={url}>{url}</span>
          <button
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => copy(url, key)}
          >
            {copied === key ? <CheckCheck className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      ))}
    </div>
  );
}

function TestCard({ test, onRefresh }: { test: AbTest; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const winner = findWinner(test.variants, test.winnerThreshold);

  const patchMutation = useMutation({
    mutationFn: async (data: { status?: AbTestStatus; notes?: string }) => {
      const res = await fetch(`${BASE}/api/ab-tests/${test.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ab-tests"] }),
    onError: () => toast({ title: "Error", description: "Could not update test.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/ab-tests/${test.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ab-tests"] });
      toast({ title: "Deleted", description: "Test removed." });
    },
    onError: () => toast({ title: "Error", description: "Could not delete test.", variant: "destructive" }),
  });

  const chartData = test.variants.map((v) => ({
    name: v.name,
    Impressions: v.impressions,
    Clicks: v.clicks,
    CTR: ctr(v),
    id: v.id,
  }));

  const totalImpressions = test.variants.reduce((s, v) => s + v.impressions, 0);
  const totalClicks = test.variants.reduce((s, v) => s + v.clicks, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{test.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[test.type]}`}>
                {TYPE_LABELS[test.type]}
              </span>
              <Badge
                variant={test.status === "active" ? "default" : "secondary"}
                className="text-xs"
              >
                {test.status === "active" ? "Active" : "Closed"}
              </Badge>
              {winner && (
                <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <Trophy className="h-3 w-3" />
                  Winner: {winner.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{totalImpressions} impressions</span>
              <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" />{totalClicks} clicks</span>
              <span>{test.variants.length} variants</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={test.status === "active" ? "Close test" : "Reopen test"}
              onClick={() => patchMutation.mutate({ status: test.status === "active" ? "closed" : "active" })}
            >
              {test.status === "active"
                ? <ToggleRight className="h-4 w-4 text-green-500" />
                : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Delete test"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete A/B Test?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{test.name}</strong> and all its variants and data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteMutation.mutate()}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              data-testid="expand-test"
              aria-label="Expand test details"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Chart */}
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value, name) => name === "CTR" ? [`${value}%`, "CTR"] : [value, name]}
                />
                <Bar yAxisId="left" dataKey="Impressions" radius={[3, 3, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.4} />)}
                </Bar>
                <Bar yAxisId="left" dataKey="Clicks" radius={[3, 3, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Variants table */}
          <div className="space-y-2">
            {test.variants.map((v, i) => (
              <div
                key={v.id}
                className={`rounded-lg border p-3 space-y-1 ${winner?.id === v.id ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20" : "bg-muted/20"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="font-medium text-sm">{v.name}</span>
                    {winner?.id === v.id && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span><Eye className="h-3 w-3 inline mr-0.5" />{v.impressions}</span>
                    <span><MousePointerClick className="h-3 w-3 inline mr-0.5" />{v.clicks}</span>
                    <span className="font-semibold text-foreground">{ctr(v)}% CTR</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setTrackingOpen(trackingOpen === v.id ? null : v.id)}
                    >
                      {trackingOpen === v.id ? "Hide URLs" : "Track"}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pl-7 line-clamp-2">{v.content}</p>
                {trackingOpen === v.id && (
                  <div className="pl-7">
                    <TrackingSnippet testId={test.id} variantId={v.id} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {test.notes && (
            <p className="text-xs text-muted-foreground italic">{test.notes}</p>
          )}

          {winner && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-center gap-3">
              <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold">{winner.name}</span> is the winning variant with{" "}
                <span className="font-semibold">{ctr(winner)}% CTR</span> across {winner.impressions} impressions.
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function NewTestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState<AbTestType>("headline");
  const [notes, setNotes] = useState("");
  const [threshold, setThreshold] = useState("100");
  const [variants, setVariants] = useState([
    { name: "Variant A", content: "" },
    { name: "Variant B", content: "" },
  ]);

  function addVariant() {
    const label = String.fromCharCode(65 + variants.length);
    setVariants([...variants, { name: `Variant ${label}`, content: "" }]);
  }

  function removeVariant(i: number) {
    if (variants.length <= 2) return;
    setVariants(variants.filter((_, idx) => idx !== i));
  }

  function updateVariant(i: number, field: "name" | "content", val: string) {
    setVariants(variants.map((v, idx) => idx === i ? { ...v, [field]: val } : v));
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/ab-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name,
          type,
          notes: notes || undefined,
          winnerThreshold: parseInt(threshold, 10) || 100,
          variants,
        }),
      });
      if (!res.ok) throw new Error("Failed to create test");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ab-tests"] });
      toast({ title: "Test created", description: "Your A/B test is now active." });
      onClose();
      setName(""); setType("headline"); setNotes(""); setThreshold("100");
      setVariants([{ name: "Variant A", content: "" }, { name: "Variant B", content: "" }]);
    },
    onError: () => toast({ title: "Error", description: "Could not create test.", variant: "destructive" }),
  });

  const isValid = name.trim() && variants.every((v) => v.name.trim() && v.content.trim());

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New A/B Test</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Test Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Homepage headline test" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select value={type} onValueChange={(v) => setType(v as AbTestType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="headline">Headline</SelectItem>
                  <SelectItem value="cta">CTA</SelectItem>
                  <SelectItem value="meta_description">Meta Description</SelectItem>
                  <SelectItem value="ad_copy">Ad Copy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Winner Threshold (impressions)</Label>
              <Input type="number" min="10" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea placeholder="Context, hypothesis, what you're testing..." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Variants <span className="text-destructive">*</span> <span className="text-muted-foreground text-xs font-normal">(min 2)</span></Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addVariant}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Variant
              </Button>
            </div>
            {variants.map((v, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <Input
                    className="h-7 text-sm"
                    placeholder="Variant name"
                    value={v.name}
                    onChange={(e) => updateVariant(i, "name", e.target.value)}
                  />
                  {variants.length > 2 && (
                    <button className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeVariant(i)}>
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Textarea
                  rows={2}
                  className="text-sm"
                  placeholder={type === "headline" ? "e.g. Boost Your SEO Score in 30 Days" : type === "cta" ? "e.g. Get Started Free" : "Content for this variant..."}
                  value={v.content}
                  onChange={(e) => updateVariant(i, "content", e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!isValid || createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AbTestsPage() {
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "closed">("all");

  const { data: tests = [], isLoading } = useQuery<AbTest[]>({
    queryKey: ["ab-tests"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ab-tests`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch A/B tests");
      return res.json();
    },
  });

  const filtered = tests.filter((t) => filter === "all" || t.status === filter);
  const activeCount = tests.filter((t) => t.status === "active").length;
  const closedCount = tests.filter((t) => t.status === "closed").length;
  const totalImpressions = tests.flatMap((t) => t.variants).reduce((s, v) => s + v.impressions, 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <FlaskConical className="h-6 w-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">A/B Test Manager</h1>
            <p className="text-sm text-muted-foreground">Test headlines, CTAs, and copy — find what converts best</p>
          </div>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Test
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Active Tests</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Closed Tests</p>
            <p className="text-2xl font-bold mt-1">{closedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Impressions</p>
            <p className="text-2xl font-bold mt-1">{totalImpressions.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b">
        {(["all", "active", "closed"] as const).map((f) => (
          <button
            key={f}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              filter === f
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setFilter(f)}
          >
            {f} {f !== "all" && `(${f === "active" ? activeCount : closedCount})`}
          </button>
        ))}
      </div>

      {/* Test cards */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading tests...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No {filter === "all" ? "" : filter} tests yet</p>
          {filter === "all" && (
            <p className="text-xs mt-1">Create your first A/B test to start comparing variants.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((test) => (
            <TestCard key={test.id} test={test} onRefresh={() => {}} />
          ))}
        </div>
      )}

      <NewTestDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
