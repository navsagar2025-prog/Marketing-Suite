import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Link2, Trash2, Search, Sparkles, Loader2, ExternalLink, ChevronDown, ChevronRight, Zap } from "lucide-react";
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
  useListWebsites,
  getListBacklinksQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const TOKEN_KEY = "auth_token";
function authHeader() { return { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}` }; }

const STATUS_OPTIONS = ["not_contacted", "contacted", "responded", "link_secured", "rejected"];
const TYPE_OPTIONS = ["guest_post", "directory", "resource", "social", "forum", "other"];

const createSchema = z.object({
  websiteId: z.coerce.number().min(1, "Website is required"),
  prospectUrl: z.string().url("Must be a valid URL"),
  prospectDomain: z.string().min(1, "Domain is required"),
  contactEmail: z.string().email().optional().nullable(),
  status: z.enum(["not_contacted", "contacted", "responded", "link_secured", "rejected"]).default("not_contacted"),
  domainAuthority: z.coerce.number().min(0).max(100).optional().nullable(),
  type: z.enum(["guest_post", "directory", "resource", "social", "forum", "other"]).default("guest_post"),
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

function OpportunityCard({
  opp,
  onAdd,
  added,
  adding,
}: {
  opp: Opportunity;
  onAdd: (o: Opportunity) => void;
  added: boolean;
  adding: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const diff = DIFFICULTY_LABEL[opp.difficulty] ?? DIFFICULTY_LABEL[2];

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

        <Button
          size="sm"
          variant={added ? "secondary" : "outline"}
          disabled={added || adding}
          onClick={() => onAdd(opp)}
          className="shrink-0 text-xs h-7"
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : added ? "Added" : <><Plus className="h-3 w-3 mr-1" />Add</>}
        </Button>
      </div>
    </div>
  );
}

function AiFinderSheet({
  open,
  onOpenChange,
  websites,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  websites: { id: number; url: string; name: string }[];
  onAdd: (opp: Opportunity) => Promise<void>;
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
      await onAdd(opp);
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
          {/* Inputs */}
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
                Website <span className="text-muted-foreground font-normal">(auto-fills niche from your site)</span>
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
              {/* Summary pills */}
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
                {TYPE_OPTIONS.filter(t => typeCounts[t] > 0).map(t => (
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
                Click a row to see the pitch angle, then "Add" to save it to your backlink pipeline.
              </p>

              <div className="space-y-1.5">
                {filtered.map(opp => (
                  <OpportunityCard
                    key={opp.exampleDomain}
                    opp={opp}
                    onAdd={handleAdd}
                    added={addedDomains.has(opp.exampleDomain)}
                    adding={addingDomain === opp.exampleDomain}
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
  );
}

export default function Backlinks() {
  const [open, setOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: websites } = useListWebsites();
  const { data: backlinks, isLoading } = useListBacklinks(
    filterStatus !== "all" ? { status: filterStatus } : undefined,
    { query: { queryKey: getListBacklinksQueryKey(filterStatus !== "all" ? { status: filterStatus } : undefined) } }
  );
  const createMutation = useCreateBacklink();
  const deleteMutation = useDeleteBacklink();

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

  const handleAddFromFinder = async (opp: Opportunity) => {
    const wsId = websites?.[0]?.id;
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

  const filtered = (backlinks ?? []).filter(b =>
    !search || b.prospectDomain.toLowerCase().includes(search.toLowerCase()) || b.prospectUrl.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2" data-testid="text-page-title">
            Backlinks
            <HelpTooltip text="Backlinks are links from other websites pointing to yours. More high-quality backlinks can improve your search engine rankings. Use this page to track outreach prospects and record which sites have agreed to link to you." />
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your backlink outreach pipeline</p>
        </div>
        <div className="flex items-center gap-2">
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Contact</th>
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
                      <td className="px-4 py-3 text-muted-foreground capitalize">{(b.type ?? "").replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-right font-mono">{b.domainAuthority ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{b.contactEmail ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={statusVariant(b.status)} className="text-xs">{statusLabel(b.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" data-testid={`button-delete-backlink-${b.id}`} onClick={() => handleDelete(b.id)} disabled={deleteMutation.isPending}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AiFinderSheet
        open={finderOpen}
        onOpenChange={setFinderOpen}
        websites={(websites ?? []).map(w => ({ id: w.id, url: w.url, name: w.name ?? w.url }))}
        onAdd={handleAddFromFinder}
      />
    </div>
  );
}
