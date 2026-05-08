import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wand2, FileText, Package, Image as ImageIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/catalog-api";

interface ScanResponse {
  counts: { blog: number; product: number; gallery: number; total: number };
  samples: Record<"blog" | "product" | "gallery", Array<{ id: number; title: string; hasTitle: boolean; hasDescription: boolean }>>;
}
interface RunResult {
  type: "blog" | "product" | "gallery"; id: number; title: string;
  oldTitle: string | null; oldDescription: string | null;
  newTitle: string; newDescription: string;
  status: "ok" | "error" | "skipped"; error?: string;
}
interface RunResponse { processed: number; remaining: number; results: RunResult[]; dryRun: boolean }

const TYPE_META: Record<"blog" | "product" | "gallery", { label: string; Icon: typeof FileText }> = {
  blog: { label: "Blog posts", Icon: FileText },
  product: { label: "Products", Icon: Package },
  gallery: { label: "Gallery items", Icon: ImageIcon },
};

export default function AdminSeoFillPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Record<"blog" | "product" | "gallery", boolean>>({ blog: true, product: true, gallery: true });
  const [running, setRunning] = useState(false);
  const [activeMode, setActiveMode] = useState<"dry" | "real" | null>(null);
  const [logs, setLogs] = useState<RunResult[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const { data: scan, isLoading } = useQuery<ScanResponse>({
    queryKey: ["seo-fill-scan"],
    queryFn: () => apiFetch<ScanResponse>("/admin/seo-fill/scan"),
  });

  const runOnce = useMutation({
    mutationFn: (params: { types: string[]; dryRun: boolean }) =>
      apiFetch<RunResponse>("/admin/seo-fill/run", {
        method: "POST",
        body: JSON.stringify(params),
      }),
  });

  const start = async (mode: "dry" | "real") => {
    const types = (Object.entries(selected) as Array<["blog" | "product" | "gallery", boolean]>).filter(([, v]) => v).map(([k]) => k);
    if (types.length === 0) {
      toast({ title: "Pick at least one content type", variant: "destructive" });
      return;
    }
    if (!scan || scan.counts.total === 0) {
      toast({ title: "Nothing to fill", description: "All items already have SEO fields." });
      return;
    }
    const isDry = mode === "dry";
    setRunning(true);
    setActiveMode(mode);
    setLogs([]);
    const totalEligible = types.reduce((s, t) => s + scan.counts[t], 0);
    setProgress({ done: 0, total: totalEligible });
    try {
      let done = 0;
      while (done < totalEligible) {
        const res = await runOnce.mutateAsync({ types, dryRun: isDry });
        setLogs(prev => [...prev, ...res.results]);
        done += res.processed;
        setProgress({ done, total: totalEligible });
        if (res.processed === 0 || res.remaining === 0) break;
      }
      toast({ title: isDry ? "Dry-run complete" : "Bulk fill complete", description: `Processed ${done} items.` });
      qc.invalidateQueries({ queryKey: ["seo-fill-scan"] });
    } catch (err) {
      toast({ title: "Run failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setRunning(false);
      setActiveMode(null);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const counts = scan?.counts ?? { blog: 0, product: 0, gallery: 0, total: 0 };
  const okCount = logs.filter(l => l.status === "ok").length;
  const errCount = logs.filter(l => l.status === "error").length;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Wand2 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Bulk SEO Fill</h1>
          <p className="text-sm text-muted-foreground">Auto-generate missing SEO titles and descriptions across your content.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items missing SEO</CardTitle>
          <CardDescription>Select which content types to process. Existing SEO values are kept; only blanks are filled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(TYPE_META) as Array<"blog" | "product" | "gallery">).map((t) => {
            const Icon = TYPE_META[t].Icon;
            return (
              <label
                key={t}
                className="flex items-center justify-between gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                data-testid={`row-type-${t}`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selected[t]}
                    onCheckedChange={(v) => setSelected(s => ({ ...s, [t]: !!v }))}
                    disabled={running}
                    data-testid={`checkbox-type-${t}`}
                  />
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{TYPE_META[t].label}</span>
                </div>
                <Badge variant={counts[t] > 0 ? "default" : "outline"}>
                  {counts[t]} missing
                </Badge>
              </label>
            );
          })}

          <div className="pt-3 flex flex-wrap gap-3 items-center">
            <Button
              onClick={() => start("dry")}
              disabled={running}
              variant="outline"
              data-testid="button-dry-run"
            >
              {activeMode === "dry" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Dry run preview
            </Button>
            <Button
              onClick={() => start("real")}
              disabled={running || counts.total === 0}
              data-testid="button-run-fill"
            >
              {activeMode === "real" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Run bulk fill
            </Button>
            <span className="text-xs text-muted-foreground">{counts.total} total items missing SEO data</span>
          </div>
        </CardContent>
      </Card>

      {(running || logs.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>
              {progress.done} of {progress.total} processed •{" "}
              <span className="text-green-600">{okCount} ok</span> •{" "}
              <span className="text-red-600">{errCount} errors</span>
              {activeMode === "dry" && " • dry-run (no changes saved)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress.total === 0 ? 0 : (progress.done / progress.total) * 100} />
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((l, i) => (
                <div
                  key={`${l.type}-${l.id}-${i}`}
                  className="rounded-md border p-2 text-xs"
                  data-testid={`log-row-${l.type}-${l.id}`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {l.status === "ok"
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      : <AlertCircle className="h-3.5 w-3.5 text-red-600" />}
                    <Badge variant="outline" className="text-[10px]">{l.type}</Badge>
                    <span className="truncate">{l.title}</span>
                  </div>
                  {l.status === "ok" && (
                    <div className="mt-1 pl-5 space-y-0.5 text-muted-foreground">
                      <div><strong>Title:</strong> {l.newTitle}</div>
                      <div><strong>Description:</strong> {l.newDescription}</div>
                    </div>
                  )}
                  {l.status === "error" && <div className="pl-5 text-red-600">{l.error}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
