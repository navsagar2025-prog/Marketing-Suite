import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  FileBarChart,
  ArrowLeft,
  Share2,
  Download,
  Trash2,
  Globe,
  Calendar,
  Loader2,
  Check,
  Copy,
  TrendingUp,
  Users,
  Link2,
  Megaphone,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface Snapshot {
  generatedAt: string;
  website: { id: number; name: string; url: string; niche: string; seoScore: number | null; status: string };
  keywords?: {
    total: number;
    topKeywords: Array<{ keyword: string; currentRank: number | null; searchVolume: number | null; difficulty: number | null; intent: string | null; cluster: string | null; status: string }>;
  };
  backlinks?: {
    total: number;
    secured: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    recentCount: number;
  };
  leads?: {
    total: number;
    periodCount: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
  };
  campaigns?: {
    total: number;
    active: number;
    list: Array<{ name: string; type: string; status: string; goal: string; impressions: number | null; clicks: number | null; conversions: number | null; budget: number | null; spend: number | null }>;
  };
}

interface Report {
  id: number;
  title: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  sections: string[];
  shareToken: string;
  snapshot: Snapshot;
  createdAt: string;
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-4 px-5 flex items-center gap-3">
        <div className="text-primary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function scoreColor(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

export function ReportContent({ report }: { report: Report }) {
  const snap = report.snapshot;

  return (
    <div className="space-y-8 print:space-y-6">
      {/* Header */}
      <div className="space-y-1 border-b pb-6 print:pb-4">
        <h1 className="text-2xl font-bold">{report.title}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Globe className="h-3.5 w-3.5" />
            {snap.website.name} — <a href={snap.website.url} className="hover:underline text-primary">{snap.website.url}</a>
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(report.dateRangeStart)} – {formatDate(report.dateRangeEnd)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Generated {formatDate(snap.generatedAt)}
        </p>
      </div>

      {/* SEO Summary */}
      {report.sections.includes("seo_summary") && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> SEO Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="py-5 px-5 flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground mb-1">SEO Score</p>
                <p className={`text-4xl font-extrabold ${scoreColor(snap.website.seoScore)}`}>
                  {snap.website.seoScore ?? "—"}
                </p>
                {snap.website.seoScore != null && (
                  <p className="text-xs text-muted-foreground mt-1">out of 100</p>
                )}
              </CardContent>
            </Card>
            <StatCard icon={<Globe className="h-5 w-5" />} label="Niche" value={snap.website.niche} />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Status"
              value={<Badge variant="outline" className="text-xs capitalize">{snap.website.status}</Badge>}
            />
          </div>
        </section>
      )}

      {/* Keywords */}
      {report.sections.includes("keywords") && snap.keywords && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" /> Top Keywords
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard icon={<Search className="h-4 w-4" />} label="Keywords Tracked" value={snap.keywords.total} />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="In Top 10"
              value={snap.keywords.topKeywords.filter(k => k.currentRank != null && k.currentRank <= 10).length}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="In Top 3"
              value={snap.keywords.topKeywords.filter(k => k.currentRank != null && k.currentRank <= 3).length}
            />
          </div>
          {snap.keywords.topKeywords.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Keyword</th>
                      <th className="text-center px-4 py-2 font-medium text-xs text-muted-foreground">Rank</th>
                      <th className="text-center px-4 py-2 font-medium text-xs text-muted-foreground hidden sm:table-cell">Volume</th>
                      <th className="text-center px-4 py-2 font-medium text-xs text-muted-foreground hidden sm:table-cell">Difficulty</th>
                      <th className="text-center px-4 py-2 font-medium text-xs text-muted-foreground hidden md:table-cell">Intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.keywords.topKeywords.slice(0, 15).map((k, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium max-w-xs truncate">{k.keyword}</td>
                        <td className="px-4 py-2 text-center">
                          {k.currentRank != null ? (
                            <Badge variant={k.currentRank <= 3 ? "default" : k.currentRank <= 10 ? "secondary" : "outline"} className="text-xs">
                              #{k.currentRank}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-muted-foreground hidden sm:table-cell">
                          {k.searchVolume?.toLocaleString() ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-muted-foreground hidden sm:table-cell">
                          {k.difficulty != null ? `${k.difficulty}/100` : "—"}
                        </td>
                        <td className="px-4 py-2 text-center hidden md:table-cell">
                          {k.intent ? (
                            <Badge variant="outline" className="text-xs capitalize">{k.intent}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Backlinks */}
      {report.sections.includes("backlinks") && snap.backlinks && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" /> Backlinks
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard icon={<Link2 className="h-4 w-4" />} label="Total Prospects" value={snap.backlinks.total} />
            <StatCard icon={<Check className="h-4 w-4" />} label="Links Secured" value={snap.backlinks.secured} />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Win Rate"
              value={snap.backlinks.total > 0 ? `${Math.round((snap.backlinks.secured / snap.backlinks.total) * 100)}%` : "—"}
            />
            <StatCard icon={<Link2 className="h-4 w-4" />} label="New in Period" value={snap.backlinks.recentCount} />
          </div>
          {Object.keys(snap.backlinks.byStatus).length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-36 px-2 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(snap.backlinks.byStatus).map(([k, v]) => ({ name: k.replace(/_/g, " "), count: v }))}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Leads */}
      {report.sections.includes("leads") && snap.leads && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Lead Performance
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <StatCard icon={<Users className="h-4 w-4" />} label="Total Leads" value={snap.leads.total} />
            <StatCard icon={<Users className="h-4 w-4" />} label="In Period" value={snap.leads.periodCount} />
            <StatCard
              icon={<Check className="h-4 w-4" />}
              label="Converted"
              value={snap.leads.byStatus["converted"] ?? 0}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {Object.keys(snap.leads.byStatus).length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-medium text-muted-foreground">By Status</CardTitle>
                </CardHeader>
                <CardContent className="h-36 px-2 pb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(snap.leads.byStatus).map(([k, v]) => ({ name: k, count: v }))}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {Object.entries(snap.leads.byStatus).map((_, i) => (
                          <Cell key={i} fill={["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6"][i % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            {Object.keys(snap.leads.bySource).length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-medium text-muted-foreground">By Source</CardTitle>
                </CardHeader>
                <CardContent className="h-36 px-2 pb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(snap.leads.bySource).map(([k, v]) => ({ name: k, count: v }))}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Campaigns */}
      {report.sections.includes("campaigns") && snap.campaigns && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> Campaign Performance
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <StatCard icon={<Megaphone className="h-4 w-4" />} label="Total Campaigns" value={snap.campaigns.total} />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Active" value={snap.campaigns.active} />
            <StatCard
              icon={<Check className="h-4 w-4" />}
              label="Total Conversions"
              value={snap.campaigns.list.reduce((acc, c) => acc + (c.conversions ?? 0), 0)}
            />
          </div>
          {snap.campaigns.list.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Campaign</th>
                      <th className="text-center px-4 py-2 font-medium text-xs text-muted-foreground">Status</th>
                      <th className="text-center px-4 py-2 font-medium text-xs text-muted-foreground hidden sm:table-cell">Impressions</th>
                      <th className="text-center px-4 py-2 font-medium text-xs text-muted-foreground hidden sm:table-cell">Clicks</th>
                      <th className="text-center px-4 py-2 font-medium text-xs text-muted-foreground">Conv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.campaigns.list.map((c, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium max-w-xs truncate">{c.name}</td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant={c.status === "active" ? "default" : "outline"} className="text-xs capitalize">{c.status}</Badge>
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-muted-foreground hidden sm:table-cell">{c.impressions?.toLocaleString() ?? "—"}</td>
                        <td className="px-4 py-2 text-center text-xs text-muted-foreground hidden sm:table-cell">{c.clicks?.toLocaleString() ?? "—"}</td>
                        <td className="px-4 py-2 text-center text-xs">{c.conversions ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Footer */}
      <div className="border-t pt-6 text-center text-xs text-muted-foreground print:pt-4">
        <p>Generated by <strong>SEO Command</strong> · {formatDate(snap.generatedAt)}</p>
      </div>
    </div>
  );
}

export default function ReportDetailPage({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const reportId = parseInt(id, 10);

  const { data: report, isLoading, error } = useQuery<Report>({
    queryKey: ["report", reportId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/reports/${reportId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Report not found");
      return res.json();
    },
    enabled: !isNaN(reportId),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/reports/${reportId}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast({ title: "Report deleted" });
      setLocation("/reports");
    },
    onError: () => toast({ title: "Error deleting report", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Report not found.</p>
        <Button variant="link" onClick={() => setLocation("/reports")}>Back to Reports</Button>
      </div>
    );
  }

  const shareUrl = `${window.location.origin}${BASE}/shared-report/${report.shareToken}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Toolbar — hidden on print */}
      <div className="flex items-center gap-2 mb-6 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/reports")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Reports
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setShareOpen(true)} data-testid="button-share">
          <Share2 className="h-4 w-4 mr-1.5" /> Share
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.print()} data-testid="button-download-pdf">
          <Download className="h-4 w-4 mr-1.5" /> Download PDF
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
          data-testid="button-delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <ReportContent report={report} />

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Share Report</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Anyone with this link can view the report — no login required.</p>
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="text-xs font-mono" />
            <Button size="icon" variant="outline" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              This report and its share link will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
