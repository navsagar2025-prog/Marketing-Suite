import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useListWebsites } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Sparkles, Copy, Check, Loader2, ChevronDown, ChevronRight,
  Target, BookOpen, Hash, MessageCircleQuestion, Link2, Lightbulb, Clock,
  BarChart3, Download
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "auth_token";
function authHeader() { return { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}` }; }
const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type ContentBrief = {
  keyword: string;
  titleOptions: string[];
  metaDescription: string;
  wordCountTarget: number;
  contentType: string;
  outline: { h2: string; intent: string; h3s: string[] }[];
  semanticKeywords: string[];
  paaQuestions: string[];
  internalLinkingTips: string[];
  contentAngle: string;
  estimatedReadTime: string;
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
  guide: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  listicle: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  comparison: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  tutorial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  review: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  pillar: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors",
        copied
          ? "border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
          : "border-muted text-muted-foreground hover:border-muted-foreground hover:text-foreground",
        className
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SectionCard({
  icon,
  title,
  badge,
  children,
  copyText,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  copyText?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-muted text-muted-foreground">{icon}</div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {badge}
          </div>
          {copyText && <CopyButton text={copyText} />}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function OutlineSection({ outline }: { outline: ContentBrief["outline"] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const fullText = outline
    .map((s, i) => `## ${i + 1}. ${s.h2}\n${s.h3s.map(h => `   ### ${h}`).join("\n")}`)
    .join("\n\n");

  return (
    <SectionCard
      icon={<BookOpen className="h-4 w-4" />}
      title="Content Outline"
      badge={<Badge variant="outline" className="text-[10px]">{outline.length} sections</Badge>}
      copyText={fullText}
    >
      <div className="space-y-1">
        {outline.map((section, i) => (
          <div key={i} className="rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
            >
              <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 mt-0.5">H2</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">{section.h2}</p>
                {section.intent && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{section.intent}</p>
                )}
              </div>
              {section.h3s.length > 0 && (
                expandedIdx === i
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              )}
            </button>
            {expandedIdx === i && section.h3s.length > 0 && (
              <div className="border-t bg-muted/20 px-3 py-2 space-y-1">
                {section.h3s.map((h3, j) => (
                  <div key={j} className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono text-muted-foreground w-5">H3</span>
                    <p className="text-xs text-muted-foreground">{h3}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function exportBriefAsText(brief: ContentBrief): string {
  const lines: string[] = [
    `CONTENT BRIEF: ${brief.keyword.toUpperCase()}`,
    `${"=".repeat(60)}`,
    ``,
    `CONTENT TYPE: ${brief.contentType.toUpperCase()}`,
    `WORD COUNT TARGET: ${brief.wordCountTarget.toLocaleString()} words`,
    `ESTIMATED READ TIME: ${brief.estimatedReadTime}`,
    ``,
    `UNIQUE ANGLE`,
    `${"-".repeat(40)}`,
    brief.contentAngle,
    ``,
    `TITLE OPTIONS`,
    `${"-".repeat(40)}`,
    ...brief.titleOptions.map((t, i) => `${i + 1}. ${t}`),
    ``,
    `META DESCRIPTION`,
    `${"-".repeat(40)}`,
    brief.metaDescription,
    ``,
    `CONTENT OUTLINE`,
    `${"-".repeat(40)}`,
    ...brief.outline.flatMap((s, i) => [
      ``,
      `H2 ${i + 1}: ${s.h2}`,
      s.intent ? `   Intent: ${s.intent}` : "",
      ...s.h3s.map(h => `   H3: ${h}`),
    ]).filter(l => l !== undefined),
    ``,
    `SEMANTIC KEYWORDS (include naturally)`,
    `${"-".repeat(40)}`,
    brief.semanticKeywords.join(", "),
    ``,
    `PEOPLE ALSO ASK (questions to answer)`,
    `${"-".repeat(40)}`,
    ...brief.paaQuestions.map((q, i) => `${i + 1}. ${q}`),
    ``,
    `INTERNAL LINKING TIPS`,
    `${"-".repeat(40)}`,
    ...brief.internalLinkingTips.map(t => `• ${t}`),
    ``,
    `Generated by SEO Command`,
  ];
  return lines.join("\n");
}

export default function ContentBriefPage() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState("");
  const [audience, setAudience] = useState("");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState("");
  const [brief, setBrief] = useState<ContentBrief | null>(null);

  const { data: websites } = useListWebsites();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const wsId = selectedWebsiteId ? parseInt(selectedWebsiteId) : undefined;
      const res = await fetch(`${BASE_URL}/api/content-brief/generate`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          websiteId: wsId,
          audience: audience.trim() || undefined,
        }),
      });
      if (res.status === 429) throw new Error("AI limit reached. Try again later.");
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(e?.error ?? "Generation failed");
      }
      return res.json() as Promise<ContentBrief>;
    },
    onSuccess: (data) => setBrief(data),
    onError: (err: Error) =>
      toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  const handleExport = () => {
    if (!brief) return;
    const text = exportBriefAsText(brief);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `content-brief-${brief.keyword.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Content Brief Generator
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Enter a target keyword and get a full SEO content brief — titles, outline, semantic keywords, PAA questions, and more.
        </p>
      </div>

      {/* Input card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Generate Brief</CardTitle>
          </div>
          <CardDescription className="mt-0.5">
            A detailed brief guides any writer — or AI — to produce content that can reach the top 3.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1 space-y-1">
              <label className="text-sm font-medium">Target Keyword</label>
              <Input
                placeholder="e.g. best CRM for small business"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && keyword.trim() && generateMutation.mutate()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Target Audience <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="e.g. SaaS founders, small business owners"
                value={audience}
                onChange={e => setAudience(e.target.value)}
              />
            </div>
            {websites && websites.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Website <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Select value={selectedWebsiteId} onValueChange={setSelectedWebsiteId}>
                  <SelectTrigger><SelectValue placeholder="Auto-detect niche" /></SelectTrigger>
                  <SelectContent>
                    {websites.map(w => (
                      <SelectItem key={w.id} value={String(w.id)}>{w.url}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!keyword.trim() || generateMutation.isPending}
            >
              {generateMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating brief…</>
                : <><Sparkles className="h-4 w-4 mr-2" />Generate Brief</>
              }
            </Button>
            {brief && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export .txt
              </Button>
            )}
          </div>

          {generateMutation.isPending && (
            <div className="rounded-md bg-muted/40 border px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                <Sparkles className="h-4 w-4 text-primary" />
                Analysing keyword intent, competition, and content structure…
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["Outline", "Semantic keywords", "PAA questions"].map(label => (
                  <div key={label} className="h-7 rounded bg-muted animate-pulse flex items-center px-2">
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brief output */}
      {brief && (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="flex flex-wrap items-center gap-2 px-1">
            <Badge variant="outline" className={cn("capitalize", CONTENT_TYPE_COLORS[brief.contentType] ?? "bg-muted text-muted-foreground")}>
              {brief.contentType}
            </Badge>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              {brief.wordCountTarget.toLocaleString()} words
            </div>
            {brief.estimatedReadTime && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {brief.estimatedReadTime}
              </div>
            )}
            <CopyButton text={exportBriefAsText(brief)} className="ml-auto" />
          </div>

          {/* Unique angle */}
          {brief.contentAngle && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded bg-primary/10 shrink-0">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Unique Angle</p>
                    <p className="text-sm">{brief.contentAngle}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Title options */}
          <SectionCard
            icon={<Hash className="h-4 w-4" />}
            title="Title Options"
            badge={<Badge variant="outline" className="text-[10px]">{brief.titleOptions.length} options</Badge>}
          >
            <div className="space-y-2">
              {brief.titleOptions.map((title, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-md bg-muted/40 border">
                  <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <p className="flex-1 text-sm font-medium">{title}</p>
                  <CopyButton text={title} />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Meta description */}
          {brief.metaDescription && (
            <SectionCard
              icon={<Target className="h-4 w-4" />}
              title="Meta Description"
              badge={
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium",
                  brief.metaDescription.length > 160
                    ? "bg-red-100 text-red-700"
                    : brief.metaDescription.length < 120
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
                )}>
                  {brief.metaDescription.length} chars
                </span>
              }
              copyText={brief.metaDescription}
            >
              <p className="text-sm text-muted-foreground leading-relaxed border rounded-md px-3 py-2.5 bg-muted/20">
                {brief.metaDescription}
              </p>
            </SectionCard>
          )}

          {/* Outline */}
          <OutlineSection outline={brief.outline} />

          {/* Semantic keywords */}
          {brief.semanticKeywords.length > 0 && (
            <SectionCard
              icon={<Sparkles className="h-4 w-4" />}
              title="Semantic Keywords"
              badge={<Badge variant="outline" className="text-[10px]">{brief.semanticKeywords.length} terms</Badge>}
              copyText={brief.semanticKeywords.join(", ")}
            >
              <div className="flex flex-wrap gap-1.5">
                {brief.semanticKeywords.map((kw, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded-full border bg-muted/40 text-muted-foreground hover:text-foreground transition-colors cursor-default"
                  >
                    {kw}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Include these terms naturally throughout the content — they signal topical authority to Google.
              </p>
            </SectionCard>
          )}

          {/* PAA questions */}
          {brief.paaQuestions.length > 0 && (
            <SectionCard
              icon={<MessageCircleQuestion className="h-4 w-4" />}
              title="People Also Ask — Questions to Answer"
              badge={<Badge variant="outline" className="text-[10px]">{brief.paaQuestions.length} questions</Badge>}
              copyText={brief.paaQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}
            >
              <div className="space-y-1.5">
                {brief.paaQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/30 transition-colors group">
                    <span className="text-xs font-mono text-muted-foreground w-4 shrink-0 mt-0.5">{i + 1}</span>
                    <p className="flex-1 text-sm">{q}</p>
                    <CopyButton text={q} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Answer each question concisely within the relevant section to capture featured snippet positions.
              </p>
            </SectionCard>
          )}

          {/* Internal linking tips */}
          {brief.internalLinkingTips.length > 0 && (
            <SectionCard
              icon={<Link2 className="h-4 w-4" />}
              title="Internal Linking Tips"
              copyText={brief.internalLinkingTips.map(t => `• ${t}`).join("\n")}
            >
              <ul className="space-y-2">
                {brief.internalLinkingTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-1 shrink-0">•</span>
                    <span className="text-muted-foreground">{tip}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
