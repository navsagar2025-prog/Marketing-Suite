import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileBarChart,
  Plus,
  Trash2,
  Share2,
  Eye,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Globe,
  Check,
  Copy,
  Download,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Website {
  id: number;
  name: string;
  url: string;
  niche: string;
  seoScore: number | null;
}

interface ReportListItem {
  id: number;
  websiteId: number;
  title: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  sections: string[];
  shareToken: string;
  createdAt: string;
  websiteName: string | null;
  websiteUrl: string | null;
}

const SECTION_OPTIONS = [
  { id: "seo_summary", label: "SEO Summary", description: "Website score and basic info" },
  { id: "keywords", label: "Top Keywords", description: "Current keyword rankings" },
  { id: "backlinks", label: "Backlinks", description: "Link building status & stats" },
  { id: "leads", label: "Lead Performance", description: "Lead counts by status & source" },
  { id: "campaigns", label: "Campaign Performance", description: "Campaign stats and results" },
] as const;

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchWebsites(): Promise<Website[]> {
  const res = await fetch(`${BASE}/api/websites`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load websites");
  return res.json();
}

async function fetchReports(): Promise<ReportListItem[]> {
  const res = await fetch(`${BASE}/api/reports`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load reports");
  return res.json();
}

function formatDate(str: string) {
  const d = new Date(str);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function SectionBadge({ section }: { section: string }) {
  const labels: Record<string, string> = {
    seo_summary: "SEO",
    keywords: "Keywords",
    backlinks: "Backlinks",
    leads: "Leads",
    campaigns: "Campaigns",
  };
  return (
    <Badge variant="outline" className="text-xs">
      {labels[section] ?? section}
    </Badge>
  );
}

function ShareDialog({ report, onClose }: { report: ReportListItem; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}${BASE}/shared-report/${report.shareToken}`;

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Anyone with this link can view the report — no login required.
          </p>
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="text-xs font-mono" />
            <Button size="icon" variant="outline" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReportsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: reports = [], isLoading } = useQuery({ queryKey: ["reports"], queryFn: fetchReports });
  const { data: websites = [] } = useQuery({ queryKey: ["websites"], queryFn: fetchWebsites });

  const [generateOpen, setGenerateOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedWebsite, setSelectedWebsite] = useState<number | null>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0]!;
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]!);
  const [selectedSections, setSelectedSections] = useState<string[]>(["seo_summary", "keywords", "leads"]);

  const [deleteTarget, setDeleteTarget] = useState<ReportListItem | null>(null);
  const [shareTarget, setShareTarget] = useState<ReportListItem | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          websiteId: selectedWebsite,
          title: reportTitle,
          dateRangeStart: dateFrom,
          dateRangeEnd: dateTo,
          sections: selectedSections,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to generate report");
      }
      return res.json();
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setGenerateOpen(false);
      resetForm();
      toast({ title: "Report generated", description: report.title });
      setLocation(`/reports/${report.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/reports/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setDeleteTarget(null);
      toast({ title: "Report deleted" });
    },
    onError: () => {
      toast({ title: "Error deleting report", variant: "destructive" });
    },
  });

  function resetForm() {
    setStep(1);
    setSelectedWebsite(null);
    setReportTitle("");
    setDateFrom(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]!);
    setDateTo(new Date().toISOString().split("T")[0]!);
    setSelectedSections(["seo_summary", "keywords", "leads"]);
  }

  function openGenerate() {
    resetForm();
    setGenerateOpen(true);
  }

  const canNext1 = selectedWebsite !== null && reportTitle.trim().length > 0;
  const canNext2 = dateFrom && dateTo && dateFrom <= dateTo;
  const canGenerate = selectedSections.length > 0;

  const toggleSection = (id: string) => {
    setSelectedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectedWebsiteData = websites.find(w => w.id === selectedWebsite);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart className="h-6 w-6" /> Client Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and share performance reports for your clients.
          </p>
        </div>
        <Button onClick={openGenerate} data-testid="button-generate-report">
          <Plus className="h-4 w-4 mr-2" /> Generate Report
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <FileBarChart className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="font-medium">No reports yet</p>
            <p className="text-sm text-muted-foreground">
              Generate your first client report to share performance data.
            </p>
            <Button onClick={openGenerate} className="mt-2">
              <Plus className="h-4 w-4 mr-2" /> Generate Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id} data-testid={`report-card-${report.id}`}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{report.title}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {report.websiteName && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {report.websiteName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(report.dateRangeStart)} – {formatDate(report.dateRangeEnd)}
                      </span>
                      <span>Created {formatDate(report.createdAt)}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {report.sections.map(s => <SectionBadge key={s} section={s} />)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 items-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation(`/reports/${report.id}`)}
                      data-testid={`button-view-${report.id}`}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShareTarget(report)}
                      data-testid={`button-share-${report.id}`}
                    >
                      <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(report)}
                      data-testid={`button-delete-${report.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate Report Dialog */}
      <Dialog open={generateOpen} onOpenChange={(open) => { if (!open) setGenerateOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs mb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : step > s
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <Check className="h-3 w-3" /> : s}
                </div>
                {s < 3 && <div className={`w-8 h-px ${step > s ? "bg-green-500" : "bg-muted"}`} />}
              </div>
            ))}
            <span className="ml-2 text-muted-foreground">
              {step === 1 ? "Website & Title" : step === 2 ? "Date Range" : "Sections"}
            </span>
          </div>

          {/* Step 1: Website + Title */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Report Title</Label>
                <Input
                  placeholder="e.g. Monthly Performance Report – May 2026"
                  value={reportTitle}
                  onChange={e => setReportTitle(e.target.value)}
                  data-testid="input-report-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                {websites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No websites found. Add one first.</p>
                ) : (
                  <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                    {websites.map(w => (
                      <div
                        key={w.id}
                        onClick={() => setSelectedWebsite(w.id)}
                        data-testid={`website-option-${w.id}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedWebsite === w.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{w.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{w.url}</p>
                        </div>
                        {selectedWebsite === w.id && <Check className="h-4 w-4 text-primary ml-auto shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Date Range */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose the reporting period for <strong>{selectedWebsiteData?.name}</strong>.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>From</Label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="input-date-from" />
                </div>
                <div className="space-y-1.5">
                  <Label>To</Label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="input-date-to" />
                </div>
              </div>
              {dateFrom && dateTo && dateFrom > dateTo && (
                <p className="text-xs text-destructive">Start date must be before end date.</p>
              )}
            </div>
          )}

          {/* Step 3: Sections */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Choose which sections to include in the report.</p>
              {SECTION_OPTIONS.map(s => (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <Checkbox
                    id={s.id}
                    checked={selectedSections.includes(s.id)}
                    onCheckedChange={() => toggleSection(s.id)}
                    data-testid={`checkbox-section-${s.id}`}
                  />
                  <div>
                    <label htmlFor={s.id} className="text-sm font-medium cursor-pointer">{s.label}</label>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                </div>
              ))}
              {selectedSections.length === 0 && (
                <p className="text-xs text-destructive">Select at least one section.</p>
              )}
            </div>
          )}

          <DialogFooter className="flex-row justify-between mt-2">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={generateMutation.isPending}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
            </div>
            <div>
              {step < 3 ? (
                <Button
                  onClick={() => setStep(s => s + 1)}
                  disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={!canGenerate || generateMutation.isPending}
                  data-testid="button-confirm-generate"
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
                  ) : (
                    <><FileBarChart className="h-4 w-4 mr-2" /> Generate Report</>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently deleted and the share link will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share dialog */}
      {shareTarget && <ShareDialog report={shareTarget} onClose={() => setShareTarget(null)} />}
    </div>
  );
}
