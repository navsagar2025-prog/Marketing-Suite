import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Link2, Trash2, Search, Sparkles, Loader2, ExternalLink,
  ChevronDown, ChevronRight, Zap, Download, Upload, Mail, Link, AlertTriangle, X,
} from "lucide-react";
import { HelpTooltip } from "@/components/HelpTooltip";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  useListBacklinks,
  useCreateBacklink,
  useDeleteBacklink,
  useUpdateBacklink,
  useListWebsites,
  getListBacklinksQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const TOKEN_KEY = "auth_token";
function authHeader() { return { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}` }; }

const STATUS_OPTIONS = ["not_contacted", "contacted", "responded", "link_secured", "rejected"] as const;
const TYPE_OPTIONS = ["guest_post", "directory", "resource", "social", "forum", "other"] as const;

const STATUS_CYCLE: Record<string, string> = {
  not_contacted: "contacted",
  contacted: "responded",
  responded: "link_secured",
  link_secured: "not_contacted",
  rejected: "not_contacted",
};

const createSchema = z.object({
  websiteId: z.coerce.number().min(1, "Website is required"),
  prospectUrl: z.string().url("Must be a valid URL"),
  prospectDomain: z.string().min(1, "Domain is required"),
  contactEmail: z.string().email().optional().nullable(),
  status: z.enum(STATUS_OPTIONS).default("not_contacted"),
  domainAuthority: z.coerce.number().min(0).max(100).optional().nullable(),
  type: z.enum(TYPE_OPTIONS).default("guest_post"),
  notes: z.string().optional().nullable(),
});

type CreateForm = z.infer<typeof createSchema>;

type Opportunity = {
  type: string;
  siteCategory: string;
  exampleDomain: string;
  pitchAngle: string;
  difficulty: 1 | 2 | 3;
  estimatedDA: number;
  whyRelevant: string;
};

const statusVariant = (s: string): "default" | "outline" | "secondary" => {
  if (s === "link_secured") return "default";
  if (s === "rejected") return "secondary";
  return "outline";
};

const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const TYPE_COLORS: Record<string, string> = {
  guest_post: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  resource: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  directory: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  forum: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  social: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  other: "bg-muted text-muted-foreground",
};

const DIFFICULTY_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "Easy", color: "text-green-600" },
  2: { label: "Medium", color: "text-amber-600" },
  3: { label: "Hard", color: "text-red-600" },
};

// ---------------------------------------------------------------------------
// Email Generator Dialog
// ---------------------------------------------------------------------------
function EmailGeneratorDialog({
  domain,
  type,
  pitchAngle,
  siteUrl,
  open,
  onOpenChange,
}: {
  domain: string;
  type: string;
  pitchAngle?: string;
  siteUrl?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [recipientName, setRecipientName] = useState("");
  const [result, setResult] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState<"subject" | "body" | "all" | null>(null);

  const genMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/backlinks/ai-outreach-email`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ domain, type, pitchAngle, siteUrl, recipientName: recipientName.trim() }),
      });
      if (res.status === 429) throw new Error("AI limit reached. Try again later.");
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(e?.error ?? "Generation failed");
      }
      return res.json() as Promise<{ subject: string; body: string }>;
    },
    onSuccess: (data) => setResult(data),
    onError: (err: Error) => toast({ title: "Failed to generate email", description: err.message, variant: "destructive" }),
  });

  const copy = async (text: string, key: "subject" | "body" | "all") => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Generate Outreach Email — {domain}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm font-medium">Recipient name <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                className="mt-1"
                placeholder="e.g. Sarah, John"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => genMutation.mutate()}
                disabled={genMutation.isPending}
                className="gap-2"
              >
                {genMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Writing…</>
                  : <><Sparkles className="h-4 w-4" />Generate</>
                }
              </Button>
            </div>
          </div>

          {result && (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Subject line</label>
                  <button
                    type="button"
                    onClick={() => copy(result.subject, "subject")}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied === "subject" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="rounded border bg-muted/30 px-3 py-2 text-sm font-medium">{result.subject}</div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Email body</label>
                  <button
                    type="button"
                    onClick={() => copy(result.body, "body")}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied === "body" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <Textarea
                  readOnly
                  value={result.body}
                  rows={10}
                  className="resize-none font-mono text-xs bg-muted/30"
                />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => copy(`Subject: ${result.subject}\n\n${result.body}`, "all")}
              >
                {copied === "all" ? "Copied!" : "Copy full email"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Link to Outreach Contact Dialog
// ---------------------------------------------------------------------------
function LinkOutreachDialog({
  backlinkId,
  domain,
  currentContactId,
  open,
  onOpenChange,
  onLinked,
}: {
  backlinkId: number;
  domain: string;
  currentContactId?: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLinked: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateBacklink();
  const [contacts, setContacts] = useState<{ id: number; name: string; domain: string; status: string; email: string | null }[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await fetch(`${BASE}/api/outreach`, { headers: authHeader() });
      if (res.ok) {
        const data = await res.json() as typeof contacts;
        setContacts(data);
      }
    } finally {
      setLoadingContacts(false);
    }
  };

  const link = (contactId: number | null) => {
    updateMutation.mutate(
      { id: backlinkId, data: { outreachContactId: contactId } as Parameters<typeof updateMutation.mutate>[0]["data"] },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBacklinksQueryKey() });
          toast({ title: contactId ? "Linked to outreach contact" : "Outreach contact removed" });
          onLinked();
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to link", variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) loadContacts(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-4 w-4 text-primary" />
            Link to Outreach Contact — {domain}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {loadingContacts ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No outreach contacts found. Add contacts in the Outreach section first.</p>
          ) : (
            contacts.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => link(c.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded border text-left transition-colors hover:bg-muted/50",
                  currentContactId === c.id && "border-primary bg-primary/5"
                )}
              >
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.domain}{c.email ? ` · ${c.email}` : ""}</p>
                </div>
                <Badge variant="outline" className="text-xs capitalize">{c.status.replace(/_/g, " ")}</Badge>
              </button>
            ))
          )}
        </div>
        {currentContactId && (
          <Button variant="ghost" size="sm" className="text-muted-foreground w-full" onClick={() => link(null)}>
            Remove link
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// CSV Import Dialog
// ---------------------------------------------------------------------------
function CsvImportDialog({
  open,
  onOpenChange,
  websites,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  websites: { id: number; name: string; url: string }[];
  onImported: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [selectedWsId, setSelectedWsId] = useState("");

  const importMutation = useMutation({
    mutationFn: async () => {
      const wsId = parseInt(selectedWsId);
      if (!wsId) throw new Error("Select a website first");
      const res = await fetch(`${BASE}/api/backlinks/import`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: wsId, csv: csvText }),
      });
      const data = await res.json() as { imported?: number; skipped?: number; error?: string; errors?: string[] };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: `Imported ${data.imported} prospects${data.skipped ? `, ${data.skipped} skipped` : ""}` });
      onImported();
      setCsvText("");
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(String(ev.target?.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Import Backlinks from CSV
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Expected columns (header row required):</p>
            <p><code className="bg-background px-1 rounded">prospectDomain</code>, <code className="bg-background px-1 rounded">prospectUrl</code>, <code className="bg-background px-1 rounded">type</code>, <code className="bg-background px-1 rounded">status</code>, <code className="bg-background px-1 rounded">domainAuthority</code>, <code className="bg-background px-1 rounded">contactEmail</code>, <code className="bg-background px-1 rounded">notes</code></p>
            <p>Only <strong>domain</strong> or <strong>url</strong> is required. Other columns are optional.</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Assign to website</label>
            <Select value={selectedWsId} onValueChange={setSelectedWsId}>
              <SelectTrigger><SelectValue placeholder="Select website" /></SelectTrigger>
              <SelectContent>{websites.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name || w.url}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">CSV file or paste content</label>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-primary hover:underline">
                Choose file
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            <Textarea
              placeholder="prospectDomain,type,domainAuthority&#10;example.com,guest_post,45&#10;another.com,directory,30"
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => importMutation.mutate()}
            disabled={!csvText.trim() || !selectedWsId || importMutation.isPending}
          >
            {importMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</> : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Opportunity Card (AI Finder)
// ---------------------------------------------------------------------------
function OpportunityCard({
  opp,
  onAdd,
  onGenerateEmail,
  added,
  adding,
  siteUrl,
}: {
  opp: Opportunity;
  onAdd: (o: Opportunity) => void;
  onGenerateEmail: (o: Opportunity) => void;
  added: boolean;
  adding: boolean;
  siteUrl?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const diff = DIFFICULTY_LABEL[opp.difficulty] ?? DIFFICULTY_LABEL[2]!;

  return (
    <div className={cn("rounded-md border transition-colors", added && "opacity-60 bg-muted/30")}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`https://${opp.exampleDomain}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium hover:text-primary flex items-center gap-1"
              onClick={e => e.stopPropagation()}
            >
              {opp.exampleDomain}
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
            <Badge variant="outline" className={cn("text-[10px] capitalize", TYPE_COLORS[opp.type])}>
              {opp.type.replace(/_/g, " ")}
            </Badge>
            <span className={cn("text-xs font-medium", diff.color)}>{diff.label}</span>
            <span className="text-xs text-muted-foreground">DA ~{opp.estimatedDA}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{opp.siteCategory}</p>

          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Pitch angle &amp; relevance
          </button>

          {expanded && (
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="p-2 rounded bg-primary/5 border border-primary/10">
                <p className="font-medium text-primary mb-0.5">Pitch angle</p>
                <p className="text-muted-foreground">{opp.pitchAngle}</p>
              </div>
              <div className="p-2 rounded bg-muted/40">
                <p className="font-medium mb-0.5">Why it helps your SEO</p>
                <p className="text-muted-foreground">{opp.whyRelevant}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <Button
            size="sm"
            variant={added ? "secondary" : "outline"}
            disabled={added || adding}
            onClick={() => onAdd(opp)}
            className="text-xs h-7"
          >
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : added ? "Added" : <><Plus className="h-3 w-3 mr-1" />Add</>}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onGenerateEmail(opp)}
            className="text-xs h-7 text-muted-foreground"
          >
            <Mail className="h-3 w-3 mr-1" />Email
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Finder Sheet
// ---------------------------------------------------------------------------
function AiFinderSheet({
  open,
  onOpenChange,
  websites,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  websites: { id: number; url: string; name: string }[];
  onAdd: (opp: Opportunity, websiteId: number | null) => Promise<void>;
}) {
  const { toast } = useToast();
  const [niche, setNiche] = useState("");
  const [seedKeywords, setSeedKeywords] = useState("");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState("");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [addedDomains, setAddedDomains] = useState<Set<string>>(new Set());
  const [addingDomain, setAddingDomain] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [diffFilter, setDiffFilter] = useState<string>("all");
  const [emailOpp, setEmailOpp] = useState<Opportunity | null>(null);

  const selectedSite = websites.find(w => String(w.id) === selectedWebsiteId);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const wsId = selectedWebsiteId ? parseInt(selectedWebsiteId) : undefined;
      const res = await fetch(`${BASE}/api/backlinks/ai-opportunities`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim(), websiteId: wsId, seedKeywords: seedKeywords.trim() }),
      });
      if (res.status === 429) throw new Error("AI limit reached. Try again later.");
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(e?.error ?? "Generation failed");
      }
      return res.json() as Promise<{ opportunities: Opportunity[]; niche: string }>;
    },
    onSuccess: (data) => {
      setOpportunities(data.opportunities);
      setAddedDomains(new Set());
      if (data.opportunities.length === 0) {
        toast({ title: "No opportunities returned", description: "Try a more specific niche.", variant: "destructive" });
      }
    },
    onError: (err: Error) =>
      toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  const handleAdd = async (opp: Opportunity) => {
    setAddingDomain(opp.exampleDomain);
    try {
      const wsId = selectedWebsiteId ? parseInt(selectedWebsiteId) : null;
      await onAdd(opp, wsId);
      setAddedDomains(prev => new Set([...prev, opp.exampleDomain]));
    } finally {
      setAddingDomain(null);
    }
  };

  const filtered = opportunities.filter(o =>
    (typeFilter === "all" || o.type === typeFilter) &&
    (diffFilter === "all" || String(o.difficulty) === diffFilter)
  );

  const typeCounts = TYPE_OPTIONS.reduce<Record<string, number>>((acc, t) => {
    acc[t] = opportunities.filter(o => o.type === t).length;
    return acc;
  }, {});

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              AI Backlink Opportunity Finder
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              Describe your niche and get 18 targeted link-building opportunities with pitch angles, sorted by difficulty.
            </p>
          </SheetHeader>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Your Niche / Industry</label>
                <Input
                  placeholder="e.g. SaaS project management, local plumber, fitness coaching"
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Seed Keywords <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. team collaboration, remote work tools"
                  value={seedKeywords}
                  onChange={e => setSeedKeywords(e.target.value)}
                />
              </div>
            </div>

            {websites.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Website <span className="text-muted-foreground font-normal">(auto-fills niche &amp; used for email generation)</span>
                </label>
                <Select value={selectedWebsiteId} onValueChange={setSelectedWebsiteId}>
                  <SelectTrigger><SelectValue placeholder="Select a website (optional)" /></SelectTrigger>
                  <SelectContent>
                    {websites.map(w => (
                      <SelectItem key={w.id} value={String(w.id)}>{w.name || w.url}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={(!niche.trim() && !selectedWebsiteId) || generateMutation.isPending}
              className="w-full"
            >
              {generateMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Finding opportunities…</>
                : <><Sparkles className="h-4 w-4 mr-2" />Find Link Building Opportunities</>
              }
            </Button>

            {generateMutation.isPending && (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
                ))}
                <p className="text-center text-xs text-muted-foreground animate-pulse">
                  Analysing niche and generating targeted link prospects…
                </p>
              </div>
            )}

            {opportunities.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTypeFilter("all")}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full border transition-colors",
                      typeFilter === "all" ? "border-primary bg-primary/10 text-primary" : "border-muted text-muted-foreground hover:border-foreground"
                    )}
                  >
                    All ({opportunities.length})
                  </button>
                  {TYPE_OPTIONS.filter(t => typeCounts[t]! > 0).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full border transition-colors capitalize",
                        typeFilter === t ? "border-primary bg-primary/10 text-primary" : "border-muted text-muted-foreground hover:border-foreground"
                      )}
                    >
                      {t.replace(/_/g, " ")} ({typeCounts[t]})
                    </button>
                  ))}
                  <div className="ml-auto flex gap-1">
                    {["all", "1", "2", "3"].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDiffFilter(d)}
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border transition-colors",
                          diffFilter === d ? "border-primary bg-primary/10 text-primary" : "border-muted text-muted-foreground hover:border-foreground"
                        )}
                      >
                        {d === "all" ? "Any difficulty" : d === "1" ? "Easy" : d === "2" ? "Medium" : "Hard"}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {addedDomains.size > 0 && `${addedDomains.size} added to tracker · `}
                  Click a row to see the pitch angle. "Add" saves to pipeline, "Email" drafts an outreach email.
                </p>

                <div className="space-y-1.5">
                  {filtered.map(opp => (
                    <OpportunityCard
                      key={opp.exampleDomain}
                      opp={opp}
                      onAdd={handleAdd}
                      onGenerateEmail={setEmailOpp}
                      added={addedDomains.has(opp.exampleDomain)}
                      adding={addingDomain === opp.exampleDomain}
                      siteUrl={selectedSite?.url}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-6">No opportunities match the current filters.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {emailOpp && (
        <EmailGeneratorDialog
          domain={emailOpp.exampleDomain}
          type={emailOpp.type}
          pitchAngle={emailOpp.pitchAngle}
          siteUrl={selectedSite?.url}
          open={!!emailOpp}
          onOpenChange={(v) => { if (!v) setEmailOpp(null); }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function Backlinks() {
  const [open, setOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [emailRow, setEmailRow] = useState<{ domain: string; type: string; notes?: string | null } | null>(null);
  const [linkRow, setLinkRow] = useState<{ id: number; domain: string; contactId?: number | null } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: websites } = useListWebsites();
  const { data: backlinks, isLoading } = useListBacklinks(
    filterStatus !== "all" ? { status: filterStatus } : undefined,
    { query: { queryKey: getListBacklinksQueryKey(filterStatus !== "all" ? { status: filterStatus } : undefined) } }
  );
  const createMutation = useCreateBacklink();
  const deleteMutation = useDeleteBacklink();
  const updateMutation = useUpdateBacklink();

  const { data: outreachStats } = useQuery({
    queryKey: ["outreach-stats"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/outreach/stats`, { headers: authHeader() });
      if (!res.ok) return null;
      return res.json() as Promise<{ total: number; won: number; replied: number; replyRate: number; followupsDue: number }>;
    },
  });

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { prospectUrl: "", prospectDomain: "", status: "not_contacted", type: "guest_post" },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({ data: data as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBacklinksQueryKey() });
        toast({ title: "Backlink opportunity added" });
        form.reset();
        setOpen(false);
      },
      onError: () => toast({ title: "Failed to add backlink", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBacklinksQueryKey() }),
    });
  };

  const handleStatusCycle = (id: number, currentStatus: string) => {
    const next = STATUS_CYCLE[currentStatus] ?? "not_contacted";
    updateMutation.mutate(
      { id, data: { status: next } as Parameters<typeof updateMutation.mutate>[0]["data"] },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBacklinksQueryKey() }) }
    );
  };

  const handleAddFromFinder = async (opp: Opportunity, websiteId: number | null) => {
    const wsId = websiteId ?? websites?.[0]?.id;
    if (!wsId) {
      toast({ title: "No website found", description: "Add a website first before tracking backlinks.", variant: "destructive" });
      return;
    }
    await new Promise<void>((resolve, reject) => {
      createMutation.mutate(
        {
          data: {
            websiteId: wsId,
            prospectUrl: `https://${opp.exampleDomain}`,
            prospectDomain: opp.exampleDomain,
            type: opp.type as CreateForm["type"],
            status: "not_contacted",
            domainAuthority: opp.estimatedDA,
            notes: opp.pitchAngle,
          } as Parameters<typeof createMutation.mutate>[0]["data"],
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListBacklinksQueryKey() });
            toast({ title: `${opp.exampleDomain} added to pipeline` });
            resolve();
          },
          onError: () => {
            toast({ title: "Failed to add", variant: "destructive" });
            reject(new Error("Failed"));
          },
        }
      );
    });
  };

  const handleExportCsv = () => {
    const wsId = (websites ?? [])[0]?.id;
    const url = `${BASE}/api/backlinks/export.csv${wsId ? `?websiteId=${wsId}` : ""}`;
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "backlinks.csv");
    const token = localStorage.getItem(TOKEN_KEY) ?? "";
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const objUrl = URL.createObjectURL(blob);
        a.href = objUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      });
  };

  const filtered = (backlinks ?? []).filter(b =>
    !search || b.prospectDomain.toLowerCase().includes(search.toLowerCase()) || b.prospectUrl.toLowerCase().includes(search.toLowerCase())
  );

  const showFollowupAlert = !alertDismissed && outreachStats && outreachStats.followupsDue > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2" data-testid="text-page-title">
            Backlinks
            <HelpTooltip text="Backlinks are links from other websites pointing to yours. More high-quality backlinks can improve your search engine rankings. Use this page to track outreach prospects and record which sites have agreed to link to you." />
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your backlink outreach pipeline</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-1.5" />Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" />Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFinderOpen(true)}
            data-testid="button-find-opportunities"
          >
            <Zap className="h-4 w-4 mr-1.5 text-primary" />
            Find Opportunities
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-backlink"><Plus className="h-4 w-4 mr-1" /> Add Opportunity</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Backlink Opportunity</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="websiteId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <Select value={String(field.value ?? "")} onValueChange={v => field.onChange(parseInt(v))}>
                        <FormControl><SelectTrigger data-testid="select-backlink-website"><SelectValue placeholder="Select website" /></SelectTrigger></FormControl>
                        <SelectContent>{(websites ?? []).map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="prospectUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prospect URL</FormLabel>
                      <FormControl><Input {...field} data-testid="input-backlink-url" placeholder="https://example.com/write-for-us" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="prospectDomain" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domain</FormLabel>
                      <FormControl><Input {...field} data-testid="input-backlink-domain" placeholder="example.com" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="contactEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl><Input {...field} type="email" data-testid="input-backlink-email" placeholder="contact@example.com" value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="domainAuthority" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Domain Authority</FormLabel>
                        <FormControl><Input {...field} type="number" data-testid="input-backlink-da" placeholder="45" value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger data-testid="select-backlink-type"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger data-testid="select-backlink-status"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea {...field} data-testid="input-backlink-notes" placeholder="Optional notes..." value={field.value ?? ""} rows={2} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" data-testid="button-submit-backlink" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Adding..." : "Add Opportunity"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pipeline stats bar */}
      {outreachStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total prospects", value: backlinks?.length ?? 0 },
            { label: "Links secured", value: (backlinks ?? []).filter(b => b.status === "link_secured").length },
            { label: "Reply rate", value: `${outreachStats.replyRate}%` },
            { label: "Follow-ups due", value: outreachStats.followupsDue, alert: outreachStats.followupsDue > 0 },
          ].map(stat => (
            <div key={stat.label} className={cn(
              "rounded-lg border p-3 bg-card",
              stat.alert && "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20"
            )}>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={cn("text-2xl font-bold mt-0.5", stat.alert && "text-amber-600 dark:text-amber-400")}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Follow-up due alert */}
      {showFollowupAlert && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20 px-4 py-3 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm">
            <strong>{outreachStats!.followupsDue} outreach follow-up{outreachStats!.followupsDue > 1 ? "s" : ""} overdue.</strong>
            {" "}Check the Outreach section to review contacts awaiting follow-up.
          </div>
          <button type="button" onClick={() => setAlertDismissed(true)} className="text-amber-600 dark:text-amber-400 hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-search-backlinks" className="pl-8" placeholder="Search domains..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger data-testid="select-filter-status" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Link2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-sm">{search ? "No backlinks match your search" : "No backlink opportunities yet"}</p>
              {!search && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs max-w-sm mx-auto leading-relaxed">
                    A backlink is when another website links to yours. Start by using the <strong>AI finder</strong> to discover link building targets, or add one manually.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setFinderOpen(true)}>
                    <Zap className="h-3.5 w-3.5 mr-1.5 text-primary" />
                    Find AI Opportunities
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Domain</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">DA</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Contact / Outreach</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id} data-testid={`row-backlink-${b.id}`} className="border-b last:border-0 hover:bg-muted/20 group">
                      <td className="px-4 py-3">
                        <a href={b.prospectUrl} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">{b.prospectDomain}</a>
                        {b.notes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{b.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-[10px] capitalize", TYPE_COLORS[b.type ?? "other"])}>
                          {(b.type ?? "").replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{b.domainAuthority ?? "—"}</td>
                      <td className="px-4 py-3">
                        {b.outreachContact ? (
                          <div>
                            <p className="text-xs font-medium">{b.outreachContact.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{b.outreachContact.status.replace(/_/g, " ")}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{b.contactEmail ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          title="Click to advance status"
                          onClick={() => handleStatusCycle(b.id, b.status)}
                          disabled={updateMutation.isPending}
                          className="inline-flex"
                        >
                          <Badge variant={statusVariant(b.status)} className="text-xs cursor-pointer hover:opacity-80 transition-opacity">
                            {statusLabel(b.status)}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Generate outreach email"
                            onClick={() => setEmailRow({ domain: b.prospectDomain, type: b.type ?? "guest_post", notes: b.notes })}
                          >
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Link to outreach contact"
                            onClick={() => setLinkRow({ id: b.id, domain: b.prospectDomain, contactId: b.outreachContactId })}
                          >
                            <Link className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            data-testid={`button-delete-backlink-${b.id}`}
                            onClick={() => handleDelete(b.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sheets & dialogs */}
      <AiFinderSheet
        open={finderOpen}
        onOpenChange={setFinderOpen}
        websites={(websites ?? []).map(w => ({ id: w.id, url: w.url, name: w.name ?? w.url }))}
        onAdd={handleAddFromFinder}
      />

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        websites={(websites ?? []).map(w => ({ id: w.id, name: w.name ?? w.url, url: w.url }))}
        onImported={() => queryClient.invalidateQueries({ queryKey: getListBacklinksQueryKey() })}
      />

      {emailRow && (
        <EmailGeneratorDialog
          domain={emailRow.domain}
          type={emailRow.type}
          pitchAngle={emailRow.notes ?? undefined}
          siteUrl={(websites ?? [])[0]?.url}
          open={!!emailRow}
          onOpenChange={(v) => { if (!v) setEmailRow(null); }}
        />
      )}

      {linkRow && (
        <LinkOutreachDialog
          backlinkId={linkRow.id}
          domain={linkRow.domain}
          currentContactId={linkRow.contactId}
          open={!!linkRow}
          onOpenChange={(v) => { if (!v) setLinkRow(null); }}
          onLinked={() => queryClient.invalidateQueries({ queryKey: getListBacklinksQueryKey() })}
        />
      )}
    </div>
  );
}
