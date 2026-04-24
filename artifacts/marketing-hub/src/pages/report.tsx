import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Search,
  ShieldCheck,
  Zap,
  BarChart3,
  Globe,
  TrendingUp,
} from "lucide-react";

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

const SAMPLE_RESULT: AuditResult = {
  score: 62,
  url: "https://example.com",
  issues: [
    {
      id: "s1",
      severity: "critical",
      category: "Meta",
      title: "Missing meta description",
      description: "No meta description tag was found on this page.",
      recommendation: "Add a concise meta description (120–160 characters) summarising the page content to improve click-through rates from search results.",
      currentValue: null,
    },
    {
      id: "s2",
      severity: "critical",
      category: "Performance",
      title: "Images missing alt attributes",
      description: "3 images on the page have no alt text, hurting accessibility and image SEO.",
      recommendation: "Add descriptive alt attributes to every <img> element.",
      currentValue: "3 images affected",
    },
    {
      id: "s3",
      severity: "warning",
      category: "Content",
      title: "H1 tag appears more than once",
      description: "Multiple H1 headings were detected, which can confuse search engines about the primary topic.",
      recommendation: "Use exactly one H1 per page as the main heading.",
      currentValue: "2 H1 tags found",
    },
    {
      id: "s4",
      severity: "warning",
      category: "Links",
      title: "Links missing descriptive anchor text",
      description: "2 links use generic text such as 'click here' or 'read more'.",
      recommendation: "Replace generic link text with descriptive phrases that explain the destination.",
      currentValue: "'click here', 'read more'",
    },
    {
      id: "s5",
      severity: "info",
      category: "Schema",
      title: "No structured data detected",
      description: "Adding JSON-LD schema markup helps search engines understand your content and can unlock rich results.",
      recommendation: "Implement relevant schema types (e.g. Organization, Article, Product) using JSON-LD.",
      currentValue: null,
    },
  ],
};

const BENEFITS = [
  {
    icon: <Zap className="h-5 w-5 text-primary" />,
    title: "Instant results",
    description: "Get a full on-page SEO audit in seconds — no sign-up required.",
  },
  {
    icon: <BarChart3 className="h-5 w-5 text-primary" />,
    title: "Scored & prioritised",
    description: "Every issue is ranked by severity so you know exactly what to fix first.",
  },
  {
    icon: <Globe className="h-5 w-5 text-primary" />,
    title: "Any public URL",
    description: "Analyse any live website, blog post, landing page, or product page.",
  },
  {
    icon: <TrendingUp className="h-5 w-5 text-primary" />,
    title: "Actionable fixes",
    description: "Plain-English recommendations you can hand straight to a developer.",
  },
];

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

  const sampleCritical = SAMPLE_RESULT.issues.filter(i => i.severity === "critical");
  const sampleWarning = SAMPLE_RESULT.issues.filter(i => i.severity === "warning");
  const sampleInfo = SAMPLE_RESULT.issues.filter(i => i.severity === "info");

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar text-sidebar-foreground">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/20 rounded-2xl p-3">
              <ShieldCheck className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold font-display leading-tight mb-4">
            Free SEO Audit —<br className="hidden sm:block" /> know what's holding you back
          </h1>
          <p className="text-sidebar-foreground/70 text-lg max-w-xl mx-auto mb-8">
            Enter any URL and <span className="text-primary font-semibold">SEO Command</span> will
            scan your page for on-page issues, score it out of 100, and tell you exactly how to fix each problem.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {["No account needed", "Results in seconds", "Free · 2 reports/day"].map(label => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full px-3 py-1"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {label}
              </span>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto">
            <Input
              type="text"
              placeholder="https://yourwebsite.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-white/10 border-white/20 placeholder:text-sidebar-foreground/40 text-sidebar-foreground focus-visible:ring-primary"
              data-testid="input-url"
              required
            />
            <Button type="submit" disabled={loading} className="shrink-0" data-testid="button-run-report">
              {loading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</>
                : <><Search className="h-4 w-4 mr-2" /> Analyze</>}
            </Button>
          </form>
        </div>
      </div>

      <div className="border-b">
        <div className="max-w-3xl mx-auto px-4 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {BENEFITS.map(b => (
            <div key={b.title} className="text-center space-y-2">
              <div className="flex justify-center">{b.icon}</div>
              <p className="text-sm font-semibold">{b.title}</p>
              <p className="text-xs text-muted-foreground">{b.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">

        {rateLimited && (
          <Card className="mb-6">
            <CardContent className="py-10 text-center">
              <p className="text-lg font-semibold mb-2">Free report limit reached.</p>
              <p className="text-muted-foreground text-sm">You have used your 2 free reports for today. Contact us to unlock unlimited access.</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="mb-6">
            <CardContent className="py-8 text-center">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-4 mb-12">
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
                    <div className="space-y-2">{criticalIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}</div>
                  </div>
                )}
                {warningIssues.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-yellow-600 mb-2">Warnings ({warningIssues.length})</h3>
                    <div className="space-y-2">{warningIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}</div>
                  </div>
                )}
                {infoIssues.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">Info ({infoIssues.length})</h3>
                    <div className="space-y-2">{infoIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!result && (
          <div className="mt-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 border-t" />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Example report</p>
              <div className="flex-1 border-t" />
            </div>
            <p className="text-xs text-muted-foreground text-center mb-6">
              Here's what a typical audit looks like — analyse your own URL above to see your real score.
            </p>

            <Card className="mb-4 opacity-90">
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center gap-6">
                  <ScoreRing score={SAMPLE_RESULT.score} />
                  <div className="space-y-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      Overall SEO Score
                      <Badge variant="outline" className="text-[10px]">example.com</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Needs improvement</p>
                    <div className="flex gap-3 text-xs mt-2">
                      <span className="text-red-600 font-medium">{sampleCritical.length} critical</span>
                      <span className="text-yellow-600 font-medium">{sampleWarning.length} warnings</span>
                      <span className="text-blue-600 font-medium">{sampleInfo.length} info</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3 opacity-90">
              {sampleCritical.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-2">Critical ({sampleCritical.length})</h3>
                  <div className="space-y-2">{sampleCritical.map(issue => <IssueCard key={issue.id} issue={issue} />)}</div>
                </div>
              )}
              {sampleWarning.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-yellow-600 mb-2">Warnings ({sampleWarning.length})</h3>
                  <div className="space-y-2">{sampleWarning.map(issue => <IssueCard key={issue.id} issue={issue} />)}</div>
                </div>
              )}
              {sampleInfo.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">Info ({sampleInfo.length})</h3>
                  <div className="space-y-2">{sampleInfo.map(issue => <IssueCard key={issue.id} issue={issue} />)}</div>
                </div>
              )}
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">Ready to see your real score?</p>
              <Button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  const input = document.querySelector<HTMLInputElement>('[data-testid="input-url"]');
                  input?.focus();
                }}
              >
                <Search className="h-4 w-4 mr-2" />
                Analyse my website
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
