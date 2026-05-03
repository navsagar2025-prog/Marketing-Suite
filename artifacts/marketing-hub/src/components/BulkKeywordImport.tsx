import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, RefreshCw, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useListWebsites, getListKeywordsQueryKey } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type ParsedRow = {
  keyword: string;
  currentRank: number | null;
  searchVolume: number | null;
  difficulty: number | null;
  notes: string | null;
};

const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(c => c.trim());
};

const toNum = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const parseCsv = (text: string): ParsedRow[] => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const findIdx = (...names: string[]) => header.findIndex(h => names.some(n => h === n.replace(/[^a-z0-9]/g, "")));
  const kIdx = findIdx("keyword", "keywords", "term", "query");
  const rIdx = findIdx("rank", "currentrank", "position");
  const vIdx = findIdx("volume", "searchvolume", "monthlysearches");
  const dIdx = findIdx("difficulty", "kd");
  const nIdx = findIdx("notes", "note");
  const hasHeader = kIdx !== -1;
  const dataStart = hasHeader ? 1 : 0;
  const keywordCol = hasHeader ? kIdx : 0;
  const rows: ParsedRow[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const keyword = (cells[keywordCol] ?? "").trim();
    if (!keyword) continue;
    rows.push({
      keyword,
      currentRank: hasHeader && rIdx !== -1 ? toNum(cells[rIdx]) : null,
      searchVolume: hasHeader && vIdx !== -1 ? toNum(cells[vIdx]) : null,
      difficulty: hasHeader && dIdx !== -1 ? toNum(cells[dIdx]) : null,
      notes: hasHeader && nIdx !== -1 ? (cells[nIdx] ?? null) : null,
    });
  }
  return rows;
};

export function BulkKeywordImportDialog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: websites } = useListWebsites();
  const [open, setOpen] = useState(false);
  const [websiteId, setWebsiteId] = useState<string>("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setFilename(file.name);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      toast({ title: "No keywords found in file", variant: "destructive" });
      return;
    }
    setRows(parsed);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const submit = async () => {
    if (!websiteId || rows.length === 0) return;
    setBusy(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${BASE_URL}/api/keywords/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ websiteId: parseInt(websiteId), rows }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Import failed");
      toast({
        title: `Imported ${body.inserted} keywords`,
        description: body.skipped > 0 ? `${body.skipped} skipped (duplicates)` : undefined,
      });
      qc.invalidateQueries({ queryKey: getListKeywordsQueryKey({ websiteId: parseInt(websiteId) }) });
      qc.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
      setOpen(false);
      setRows([]);
      setFilename("");
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRows([]); setFilename(""); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="button-bulk-import">
          <Upload className="h-4 w-4 mr-1" /> Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Bulk Import Keywords from CSV</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Website</label>
            <Select value={websiteId} onValueChange={setWebsiteId}>
              <SelectTrigger className="mt-1" data-testid="select-bulk-website">
                <SelectValue placeholder="Choose a website" />
              </SelectTrigger>
              <SelectContent>
                {(websites ?? []).map(w => (
                  <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}`}
            data-testid="dropzone-csv"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              data-testid="input-csv-file"
            />
            {rows.length === 0 ? (
              <>
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop a CSV file here, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Required column: <code>keyword</code>. Optional: <code>rank</code>, <code>volume</code>, <code>difficulty</code>, <code>notes</code></p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-2" />
                <p className="text-sm font-medium">{filename}</p>
                <p className="text-xs text-muted-foreground mt-1">{rows.length} keywords ready to import</p>
              </>
            )}
          </div>

          {rows.length > 0 && (
            <div className="border rounded-md max-h-48 overflow-y-auto text-xs">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5">Keyword</th>
                    <th className="text-left px-2 py-1.5 w-16">Rank</th>
                    <th className="text-left px-2 py-1.5 w-20">Volume</th>
                    <th className="text-left px-2 py-1.5 w-16">KD</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 truncate max-w-xs">{r.keyword}</td>
                      <td className="px-2 py-1">{r.currentRank ?? "—"}</td>
                      <td className="px-2 py-1">{r.searchVolume ?? "—"}</td>
                      <td className="px-2 py-1">{r.difficulty ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <p className="text-xs text-muted-foreground px-2 py-1.5 text-center">…and {rows.length - 50} more</p>
              )}
            </div>
          )}

          <Button onClick={submit} disabled={busy || rows.length === 0 || !websiteId} className="w-full" data-testid="button-submit-bulk-import">
            {busy ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import {rows.length > 0 ? `${rows.length} keywords` : "keywords"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
