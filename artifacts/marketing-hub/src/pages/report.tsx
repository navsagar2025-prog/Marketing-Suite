import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, Loader2, Search, ShieldCheck } from "lucide-react";

interface AuditIssue {
  id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  recommendation: string;
  currentValue?: string | null;
}

interface AuditResult {
  score: number;
  issues: AuditIssue[];
  url: string;
}

function severityIcon(severity: string) {
  if (severity === "critical") return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
  return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
}

function severityBadge(severity: string) {
  if (severity === "critical") return <Badge variant="destructive" className="text-xs">Critical</Badge>;
  if (severity === "warning") return <Badge className="text-xs bg-yellow-500 hover:bg-yellow-500">Warning</Badge>;
  return <Badge variant="outline" className="text-xs">Info</Badge>;
}

function scoreRingColor(score: number) {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#eab308";
  return "#ef4444";
}

function scoreColor(score: number) {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" className="rotate-[-90deg]">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={scoreRingColor(score)} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className={`absolute text-xl font-bold ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}

function IssueCard({ issue }: { issue: AuditIssue }) {
  return (
    <div className="border rounded-md p-3 space-y-1">
      <div className="flex items-start gap-2 justify-between">
        <div className="flex items-start gap-2 min-w-0">
          {severityIcon(issue.severity)}
          <div className="min-w-0">
            <p className="text-sm font-medium">{issue.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
            {issue.currentValue && (
              <p className="text-xs text-muted-foreground mt-1 italic">Current: {issue.currentValue}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {severityBadge(issue.severity)}
          <Badge variant="outline" className="text-xs hidden sm:block">{issue.category}</Badge>
        </div>
      </div>
      <div className="ml-6">
        <p className="text-xs text-muted-foreground">{issue.recommendation}</p>
      </div>
    </div>
  );
}

export default function PublicReportPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRateLimited(false);
    setResult(null);
    setLoading(true);

    let auditUrl = url.trim();
    if (!auditUrl.startsWith("http://") && !auditUrl.startsWith("https://")) {
      auditUrl = `https://${auditUrl}`;
    }

    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/audit/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: auditUrl }),
      });

      if (res.status === 429) {
        setRateLimited(true);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Audit failed");
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const criticalIssues = result?.issues.filter(i => i.severity === "critical") ?? [];
  const warningIssues = result?.issues.filter(i => i.severity === "warning") ?? [];
  const infoIssues = result?.issues.filter(i => i.severity === "info") ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-display">Free SEO Report</h1>
          <p className="text-muted-foreground mt-2">Enter any URL to get an instant SEO audit — completely free.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
          <Input
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
            data-testid="input-url"
            required
          />
          <Button type="submit" disabled={loading} data-testid="button-run-report">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</> : <><Search className="h-4 w-4 mr-2" /> Analyze</>}
          </Button>
        </form>

        {rateLimited && (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-lg font-semibold mb-2">Free report limit reached.</p>
              <p className="text-muted-foreground text-sm">You have used your 2 free reports for today. Contact us to unlock unlimited access.</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center gap-6">
                  <ScoreRing score={result.score} />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Overall SEO Score</p>
                    <p className="text-xs text-muted-foreground">
                      {result.score >= 70 ? "Good — keep up the work!" : result.score >= 40 ? "Needs improvement" : "Critical issues found"}
                    </p>
                    <div className="flex gap-3 text-xs mt-2">
                      {criticalIssues.length > 0 && <span className="text-red-600 font-medium">{criticalIssues.length} critical</span>}
                      {warningIssues.length > 0 && <span className="text-yellow-600 font-medium">{warningIssues.length} warnings</span>}
                      {infoIssues.length > 0 && <span className="text-blue-600 font-medium">{infoIssues.length} info</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {result.issues.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No issues found — excellent!</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {criticalIssues.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-2">Critical ({criticalIssues.length})</h3>
                    <div className="space-y-2">
                      {criticalIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}
                    </div>
                  </div>
                )}
                {warningIssues.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-yellow-600 mb-2">Warnings ({warningIssues.length})</h3>
                    <div className="space-y-2">
                      {warningIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}
                    </div>
                  </div>
                )}
                {infoIssues.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">Info ({infoIssues.length})</h3>
                    <div className="space-y-2">
                      {infoIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
