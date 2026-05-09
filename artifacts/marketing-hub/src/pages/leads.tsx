import { useState, useEffect, useRef } from "react";
import { Plus, Users, Trash2, Search, TrendingUp, ArrowUpDown, MessageSquare, Code2, Copy, Check, FileText, Eye, Pencil, Download, Settings2, RefreshCw, StickyNote, Pin, PinOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useListLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  useGetLeadsFunnel,
  useListWebsites,
  useGetAnalyticsSummary,
  useListConversations,
  useGetEnrolledLeadIds,
  useListLeadForms,
  useCreateLeadForm,
  useUpdateLeadForm,
  useDeleteLeadForm,
  useGetLeadFormEmbed,
  useGetLeadScoringConfig,
  useUpdateLeadScoringConfig,
  useRecalculateLeadScores,
  useListLeadNotes,
  useCreateLeadNote,
  useUpdateLeadNote,
  useDeleteLeadNote,
  getListLeadsQueryKey,
  getGetLeadsFunnelQueryKey,
  getListConversationsQueryKey,
  getListLeadFormsQueryKey,
  getGetLeadScoringConfigQueryKey,
  getListLeadNotesQueryKey,
} from "@workspace/api-client-react";
import type { Conversation, LeadForm, LeadFormField, Lead, LeadScoringConfig, LeadNote } from "@workspace/api-client-react";
import ConversationDrawer from "@/components/ConversationDrawer";

function highlightHtmlSnippet(code: string): string {
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/(&lt;\/?)([\w-]+)/g, '<span style="color:#7dd3fc">$1$2</span>')
    .replace(/([\w-]+)(=")([^"]*?)(")/g, '<span style="color:#86efac">$1</span><span style="color:#f9a8d4">$2$3$4</span>')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span style="color:#6b7280;font-style:italic">$1</span>')
    .replace(/(\/\/[^\n]*)/g, '<span style="color:#6b7280;font-style:italic">$1</span>')
    .replace(/\b(var|function|return|if|else|for|new|document|fetch|JSON|method|headers|body)\b/g, '<span style="color:#c4b5fd">$1</span>');
}

const STATUS_OPTIONS = ["new", "contacted", "qualified", "converted", "lost"];
const SOURCE_OPTIONS = ["organic", "paid", "social", "direct", "referral"];

const createSchema = z.object({
  websiteId: z.coerce.number().min(1, "Website is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.enum(["organic", "paid", "social", "direct", "referral"]).default("organic"),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).default("new"),
  value: z.coerce.number().optional().nullable(),
  campaignId: z.coerce.number().optional().nullable(),
});

type CreateForm = z.infer<typeof createSchema>;

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  contacted: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  qualified: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  converted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  lost: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const FUNNEL_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

type ScoreBreakdown = {
  sourcePoints: number;
  statusPoints: number;
  valuePoints: number;
  recencyPoints: number;
  total: number;
};

function ScoreBadge({ score, breakdown }: { score: number | null | undefined; breakdown?: ScoreBreakdown | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;

  const colorClass = score >= 70
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : score >= 40
    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
    : "bg-muted text-muted-foreground";

  const badge = (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded cursor-pointer select-none ${colorClass}`}
      data-testid="badge-lead-score"
    >
      {score}
    </span>
  );

  if (!breakdown) return badge;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {badge}
      </PopoverTrigger>
      <PopoverContent className="w-56 text-sm" side="left">
        <p className="font-semibold mb-2">Score breakdown</p>
        <ul className="space-y-1 text-xs">
          {breakdown.sourcePoints > 0 && (
            <li className="flex justify-between">
              <span className="text-muted-foreground">Source</span>
              <span className="font-mono text-green-600">+{breakdown.sourcePoints}</span>
            </li>
          )}
          {breakdown.statusPoints > 0 && (
            <li className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-mono text-green-600">+{breakdown.statusPoints}</span>
            </li>
          )}
          {breakdown.valuePoints > 0 && (
            <li className="flex justify-between">
              <span className="text-muted-foreground">Lead value</span>
              <span className="font-mono text-green-600">+{breakdown.valuePoints}</span>
            </li>
          )}
          {breakdown.recencyPoints > 0 && (
            <li className="flex justify-between">
              <span className="text-muted-foreground">Recency bonus</span>
              <span className="font-mono text-green-600">+{breakdown.recencyPoints}</span>
            </li>
          )}
          <li className="flex justify-between border-t pt-1 mt-1 font-medium">
            <span>Total</span>
            <span>{breakdown.total}</span>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}

type SortKey = "createdAt" | "score";

function EditLeadDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateLead();

  const [name, setName] = useState(lead.name);
  const [email, setEmail] = useState(lead.email ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [status, setStatus] = useState(lead.status);
  const [source, setSource] = useState(lead.source);
  const [value, setValue] = useState(lead.value != null ? String(lead.value) : "");

  const handleSave = () => {
    if (!name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    updateMutation.mutate(
      {
        id: lead.id,
        data: {
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          status,
          source,
          value: value !== "" ? parseFloat(value) : null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeadsFunnelQueryKey() });
          toast({ title: "Lead updated" });
          onClose();
        },
        onError: () => toast({ title: "Failed to update lead", variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Lead</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Full Name</Label>
            <Input data-testid="input-edit-lead-name" className="mt-1" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Email</Label>
              <Input data-testid="input-edit-lead-email" className="mt-1" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <Label className="text-sm">Phone</Label>
              <Input data-testid="input-edit-lead-phone" className="mt-1" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-edit-lead-status" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger data-testid="select-edit-lead-source" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-sm">Lead Value ($)</Label>
            <Input data-testid="input-edit-lead-value" className="mt-1" type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 500" />
          </div>
          <Button data-testid="button-save-lead-edit" className="w-full" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeadNotesDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: notes, isLoading } = useListLeadNotes(lead.id);
  const createMutation = useCreateLeadNote();
  const updateMutation = useUpdateLeadNote();
  const deleteMutation = useDeleteLeadNote();
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sortedNotes = (notes ?? []).slice().sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListLeadNotesQueryKey(lead.id) });

  const handleAdd = () => {
    if (!body.trim()) return;
    const optimisticNote: LeadNote = {
      id: -Date.now(),
      leadId: lead.id,
      staffUserId: null,
      authorName: "Admin",
      body: body.trim(),
      pinned: false,
      createdAt: new Date(),
    };
    queryClient.setQueryData<LeadNote[]>(
      getListLeadNotesQueryKey(lead.id),
      (old) => [optimisticNote, ...(old ?? [])]
    );
    setBody("");
    createMutation.mutate(
      { leadId: lead.id, data: { body: optimisticNote.body } },
      {
        onSuccess: () => invalidate(),
        onError: () => {
          queryClient.setQueryData<LeadNote[]>(
            getListLeadNotesQueryKey(lead.id),
            (old) => (old ?? []).filter(n => n.id !== optimisticNote.id)
          );
          setBody(optimisticNote.body);
          toast({ title: "Failed to add note", variant: "destructive" });
        },
      }
    );
  };

  const handlePin = (note: LeadNote) => {
    updateMutation.mutate(
      { leadId: lead.id, noteId: note.id, data: { pinned: !note.pinned } },
      {
        onSuccess: () => invalidate(),
        onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (noteId: number) => {
    deleteMutation.mutate(
      { leadId: lead.id, noteId },
      {
        onSuccess: () => invalidate(),
        onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            Notes — {lead.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              data-testid="input-lead-note-body"
              placeholder="Add a note... (Ctrl+Enter to submit)"
              rows={3}
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button
              data-testid="button-add-lead-note"
              size="sm"
              onClick={handleAdd}
              disabled={createMutation.isPending || !body.trim()}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {createMutation.isPending ? "Adding..." : "Add Note"}
            </Button>
          </div>

          <div className="border-t pt-3 space-y-2 max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : sortedNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notes yet</p>
              </div>
            ) : (
              sortedNotes.map(note => (
                <div
                  key={note.id}
                  data-testid={`note-card-${note.id}`}
                  className={`rounded-lg border p-3 text-sm space-y-1.5 ${note.pinned ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40" : "bg-muted/30"}`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{note.body}</p>
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {note.pinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />}
                      <span className="font-medium">{note.authorName}</span>
                      <span>·</span>
                      <span>{new Date(note.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={note.pinned ? "Unpin note" : "Pin note"}
                        data-testid={`button-pin-note-${note.id}`}
                        onClick={() => handlePin(note)}
                        disabled={updateMutation.isPending}
                      >
                        {note.pinned
                          ? <PinOff className="h-3.5 w-3.5 text-amber-500" />
                          : <Pin className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="Delete note"
                        data-testid={`button-delete-note-${note.id}`}
                        onClick={() => handleDelete(note.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScoringWeightField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground flex-1">{label}</span>
      <Input
        type="number"
        min={0}
        max={100}
        className="w-20 h-7 text-sm text-right"
        value={value}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
      />
    </div>
  );
}

function ScoringTab() {
  const { data: config, isLoading } = useGetLeadScoringConfig();
  const updateMutation = useUpdateLeadScoringConfig();
  const recalcMutation = useRecalculateLeadScores();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [draft, setDraft] = useState<LeadScoringConfig | null>(null);

  useEffect(() => {
    if (config && !draft) setDraft(config);
  }, [config]);

  if (isLoading || !draft) {
    return <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;
  }

  const update = (path: string[], v: number) => {
    setDraft(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as LeadScoringConfig;
      let obj: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] as Record<string, unknown>;
      obj[path[path.length - 1]] = v;
      return next;
    });
  };

  const handleSave = () => {
    if (!draft) return;
    updateMutation.mutate({ data: draft }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadScoringConfigQueryKey() });
        toast({ title: "Scoring weights saved" });
      },
      onError: () => toast({ title: "Failed to save weights", variant: "destructive" }),
    });
  };

  const handleRecalculate = () => {
    recalcMutation.mutate(undefined, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        toast({ title: `Recalculated scores for ${res.updated} leads` });
      },
      onError: () => toast({ title: "Recalculation failed", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-5 max-w-lg">
      <p className="text-sm text-muted-foreground">Adjust how points are awarded to each lead. After saving, click "Recalculate" to update all existing leads.</p>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Source Points</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(["paid", "referral", "social", "organic", "direct"] as const).map(k => (
            <ScoringWeightField key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={draft.source[k]} onChange={v => update(["source", k], v)} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Status Points</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(["new", "contacted", "qualified", "converted", "lost"] as const).map(k => (
            <ScoringWeightField key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={draft.status[k]} onChange={v => update(["status", k], v)} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Value Tier Points</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(["over1000", "over500", "over100", "over0"] as const).map(k => {
            const label = { over1000: "> $1,000", over500: "> $500", over100: "> $100", over0: "> $0" }[k];
            return <ScoringWeightField key={k} label={label} value={draft.valueTier[k]} onChange={v => update(["valueTier", k], v)} />;
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recency Bonus</CardTitle></CardHeader>
        <CardContent>
          <ScoringWeightField label="Points for leads created in last 7 days" value={draft.recencyBonus} onChange={v => update(["recencyBonus"], v)} />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button data-testid="button-save-scoring" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving..." : "Save Weights"}
        </Button>
        <Button
          data-testid="button-recalculate-scores"
          variant="outline"
          onClick={handleRecalculate}
          disabled={recalcMutation.isPending}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${recalcMutation.isPending ? "animate-spin" : ""}`} />
          {recalcMutation.isPending ? "Recalculating..." : "Recalculate All"}
        </Button>
      </div>
    </div>
  );
}

const EXPORT_STATUSES: { value: string; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Quoted" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

export default function Leads() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterIntent, setFilterIntent] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [qualifyingLead, setQualifyingLead] = useState<{ id: number; name: string } | null>(null);
  const [notesLead, setNotesLead] = useState<Lead | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: websites } = useListWebsites();
  const { data: funnel } = useGetLeadsFunnel();
  const { data: summary } = useGetAnalyticsSummary();
  const { data: allConversations } = useListConversations();
  const { data: leads, isLoading } = useListLeads(filterStatus !== "all" ? { status: filterStatus } : undefined, {
    query: { queryKey: getListLeadsQueryKey(filterStatus !== "all" ? { status: filterStatus } : undefined) }
  });
  const { data: enrolledLeadIds } = useGetEnrolledLeadIds();
  const enrolledSet = new Set(enrolledLeadIds ?? []);
  const createMutation = useCreateLead();
  const deleteMutation = useDeleteLead();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", source: "organic", status: "new" },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({ data: data as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadsFunnelQueryKey() });
        toast({ title: "Lead added" });
        form.reset();
        setOpen(false);
      },
      onError: () => toast({ title: "Failed to add lead", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadsFunnelQueryKey() });
      },
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "score" ? "desc" : "asc");
    }
  };

  const funnelData = funnel
    ? [
        { name: "New", value: funnel.newLeads },
        { name: "Contacted", value: funnel.contacted },
        { name: "Qualified", value: funnel.qualified },
        { name: "Converted", value: funnel.converted },
        { name: "Lost", value: funnel.lost },
      ]
    : [];

  const filtered = (leads ?? [])
    .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.email ?? "").toLowerCase().includes(search.toLowerCase()))
    .filter(l => !filterIntent || (l.score != null && l.score >= 70))
    .sort((a, b) => {
      if (sortKey === "score") {
        const aScore = a.score ?? -1;
        const bScore = b.score ?? -1;
        return sortDir === "desc" ? bScore - aScore : aScore - bScore;
      }
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      return sortDir === "asc" ? aDate - bDate : bDate - aDate;
    });

  const [activeTab, setActiveTab] = useState<"leads" | "forms" | "scoring">("leads");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // Export state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportStatuses, setExportStatuses] = useState<string[]>([]);
  const toggleExportStatus = (s: string) => {
    setExportStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleExportCSV = async () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (exportStatuses.length > 0) params.set("status", exportStatuses.join(","));
    if (exportFrom) params.set("from", exportFrom);
    if (exportTo) params.set("to", exportTo);
    const token = localStorage.getItem("auth_token");
    try {
      const res = await fetch(`${base}/api/leads/export.csv?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { toast({ title: "Export failed", variant: "destructive" }); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your lead generation pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden text-sm">
            <button
              data-testid="tab-leads"
              onClick={() => setActiveTab("leads")}
              className={`px-4 py-1.5 font-medium transition-colors ${activeTab === "leads" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Leads
            </button>
            <button
              data-testid="tab-forms"
              onClick={() => setActiveTab("forms")}
              className={`px-4 py-1.5 font-medium transition-colors ${activeTab === "forms" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Forms</span>
            </button>
            <button
              data-testid="tab-scoring"
              onClick={() => setActiveTab("scoring")}
              className={`px-4 py-1.5 font-medium transition-colors ${activeTab === "scoring" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <span className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" />Scoring</span>
            </button>
          </div>
          {activeTab === "leads" && (
            <Popover open={exportOpen} onOpenChange={setExportOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-export-leads"
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-4" align="end">
                <div>
                  <p className="text-sm font-semibold mb-0.5">Export Leads to CSV</p>
                  <p className="text-xs text-muted-foreground">Filter by date range and status. Leave filters empty to export all leads.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Date Range (Created)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">From</Label>
                      <Input
                        data-testid="input-export-from"
                        type="date"
                        className="h-8 text-xs"
                        value={exportFrom}
                        onChange={e => setExportFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">To</Label>
                      <Input
                        data-testid="input-export-to"
                        type="date"
                        className="h-8 text-xs"
                        value={exportTo}
                        onChange={e => setExportTo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Status</Label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-export-status-all">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={exportStatuses.length === 0}
                        onChange={() => setExportStatuses([])}
                      />
                      <span className="text-sm font-medium">All statuses</span>
                    </label>
                    <div className="border-t my-1" />
                    {EXPORT_STATUSES.map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer" data-testid={`checkbox-export-status-${value}`}>
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={exportStatuses.includes(value)}
                          onChange={() => toggleExportStatus(value)}
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button
                  data-testid="button-confirm-export-csv"
                  className="w-full gap-1.5"
                  size="sm"
                  onClick={handleExportCSV}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV
                </Button>
              </PopoverContent>
            </Popover>
          )}
          {activeTab === "leads" && (
            <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-lead"><Plus className="h-4 w-4 mr-1" /> Add Lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="websiteId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <Select value={String(field.value ?? "")} onValueChange={v => field.onChange(parseInt(v))}>
                      <FormControl><SelectTrigger data-testid="select-lead-website"><SelectValue placeholder="Select website" /></SelectTrigger></FormControl>
                      <SelectContent>{(websites ?? []).map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-lead-name" placeholder="Jane Smith" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} type="email" data-testid="input-lead-email" placeholder="jane@example.com" value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input {...field} data-testid="input-lead-phone" placeholder="+1 555 0100" value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="source" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger data-testid="select-lead-source"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{SOURCE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger data-testid="select-lead-status"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="value" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Value ($)</FormLabel>
                    <FormControl><Input {...field} type="number" data-testid="input-lead-value" placeholder="500" value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" data-testid="button-submit-lead" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Add Lead"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
          )}
        </div>
      </div>

      {activeTab === "forms" && <FormsTab />}
      {activeTab === "scoring" && <ScoringTab />}

      {activeTab === "leads" && <>
      {/* Funnel */}
      {funnel && funnelData.some(d => d.value > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base">Lead Funnel</CardTitle>
              <div className="flex items-center gap-4">
                {summary?.highIntentLeads != null && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    <span className="font-semibold text-foreground">{summary.highIntentLeads}</span>
                    high-intent (score &ge; 70)
                  </span>
                )}
                {funnel.totalValue && (
                  <span className="text-sm text-muted-foreground">Pipeline: <span className="font-semibold text-foreground">${Number(funnel.totalValue).toLocaleString()}</span></span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={70} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]}>
                  {funnelData.map((_, i) => <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-search-leads" className="pl-8" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger data-testid="select-filter-lead-status" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={filterIntent ? "default" : "outline"}
          size="sm"
          data-testid="button-filter-high-intent"
          onClick={() => setFilterIntent(v => !v)}
          className="gap-1.5 whitespace-nowrap"
        >
          <TrendingUp className="h-4 w-4" />
          {filterIntent ? "High-intent only" : "All leads"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground" data-testid="empty-state-leads">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-sm text-foreground">{search || filterIntent ? "No leads match your filters" : "No leads yet"}</p>
              {!search && !filterIntent && (
                <>
                  <p className="text-xs mt-1.5 max-w-xs mx-auto leading-relaxed">
                    Leads come in through your embedded forms, manual entry, or CSV import. Add a lead form to your site to start capturing contacts automatically.
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button size="sm" onClick={() => setOpen(true)} data-testid="empty-cta-add-lead">
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Lead
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setActiveTab("forms")} data-testid="empty-cta-go-to-forms">
                      <FileText className="h-3.5 w-3.5 mr-1.5" /> Set Up a Form
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/80 backdrop-blur">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Contact</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Source</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Value</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th
                      className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                      data-testid="th-score"
                      onClick={() => toggleSort("score")}
                    >
                      <span className="flex items-center justify-center gap-1">
                        Score
                        <ArrowUpDown className={`h-3 w-3 ${sortKey === "score" ? "text-primary" : ""}`} />
                      </span>
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.id} data-testid={`row-lead-${l.id}`} className="border-b last:border-0 hover:bg-muted/20 group">
                      <td className="px-4 py-3 font-medium">{l.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{l.email ?? l.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        {l.source === "referral" && l.notes?.startsWith("[Form]") ? (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                            data-testid={`badge-form-source-${l.id}`}
                          >
                            Form
                          </span>
                        ) : (
                          <span className="text-muted-foreground capitalize text-sm">{l.source}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{l.value ? `$${parseFloat(String(l.value)).toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[l.status] ?? ""}`}>{l.status}</span>
                          {enrolledSet.has(l.id) && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                              data-testid={`badge-in-sequence-${l.id}`}
                              title="Enrolled in a nurture sequence"
                            >
                              In sequence
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ScoreBadge
                          score={l.score}
                          breakdown={l.scoreBreakdown as ScoreBreakdown | null}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            data-testid={`button-edit-lead-${l.id}`}
                            title="Edit lead"
                            onClick={() => setEditingLead(l)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            data-testid={`button-notes-lead-${l.id}`}
                            title="View notes"
                            onClick={() => setNotesLead(l)}
                          >
                            <StickyNote className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            data-testid={`button-qualify-lead-${l.id}`}
                            title="Qualify with AI"
                            onClick={() => setQualifyingLead({ id: l.id, name: l.name })}
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" data-testid={`button-delete-lead-${l.id}`} onClick={() => handleDelete(l.id)} disabled={deleteMutation.isPending}>
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
      {qualifyingLead && (
        <ConversationDrawer
          leadId={qualifyingLead.id}
          leadName={qualifyingLead.name}
          existingConversation={
            (allConversations ?? []).find((c: Conversation) => c.leadId === qualifyingLead.id) ?? null
          }
          onClose={() => setQualifyingLead(null)}
          onConversationCreated={() => {
            queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          }}
        />
      )}
      {editingLead && (
        <EditLeadDialog lead={editingLead} onClose={() => setEditingLead(null)} />
      )}
      {notesLead && (
        <LeadNotesDialog lead={notesLead} onClose={() => setNotesLead(null)} />
      )}
      </>}
    </div>
  );
}

const FORM_FIELD_LABELS: Record<string, string> = { name: "Name", email: "Email", phone: "Phone", message: "Message" };
const DEFAULT_FIELDS: LeadFormField[] = [
  { name: "name", enabled: true, required: true },
  { name: "email", enabled: true, required: true },
  { name: "phone", enabled: false, required: false },
  { name: "message", enabled: false, required: false },
];

function EmbedDialog({ form, onClose }: { form: LeadForm; onClose: () => void }) {
  const { data: embed, isLoading } = useGetLeadFormEmbed(form.id);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!embed?.snippet) return;
    try {
      await navigator.clipboard.writeText(embed.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Embed Code — {form.name}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-32 w-full" /></div>
        ) : embed ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste this snippet into any webpage where you want the form to appear. Replace <code className="text-xs bg-muted px-1 py-0.5 rounded">YOUR_DOMAIN</code> with your actual domain if needed.
            </p>
            <div className="relative">
              <pre
                data-testid="embed-code-block"
                className="bg-zinc-950 text-xs p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all font-mono border border-zinc-800 max-h-64"
                dangerouslySetInnerHTML={{ __html: highlightHtmlSnippet(embed.snippet) }}
              />
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 gap-1.5 bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                data-testid="button-copy-embed"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">The form is self-contained — no external CSS or JS dependencies required.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Failed to load embed code.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormFieldRow({ field, onChange }: {
  field: LeadFormField;
  onChange: (updated: LeadFormField) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <label className="flex items-center gap-2 flex-1 cursor-pointer">
        <input
          type="checkbox"
          checked={field.enabled}
          onChange={e => onChange({ ...field, enabled: e.target.checked, required: e.target.checked ? field.required : false })}
          className="rounded"
        />
        <span className="text-sm font-medium">{FORM_FIELD_LABELS[field.name]}</span>
      </label>
      {field.enabled && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={field.required}
            onChange={e => onChange({ ...field, required: e.target.checked })}
            className="rounded"
          />
          Required
        </label>
      )}
    </div>
  );
}

function FormPreview({ fields }: { fields: LeadFormField[] }) {
  const enabled = fields.filter(f => f.enabled);
  if (enabled.length === 0) return (
    <div className="text-center py-6 text-muted-foreground text-xs">Enable fields to see preview</div>
  );
  return (
    <div className="space-y-2 p-3 bg-muted/30 rounded-md border">
      {enabled.map(f => (
        <div key={f.name}>
          <label className="text-xs font-medium text-muted-foreground block mb-0.5">
            {FORM_FIELD_LABELS[f.name]}{f.required ? " *" : ""}
          </label>
          {f.name === "message"
            ? <div className="bg-background border rounded h-12 text-xs px-2 py-1 text-muted-foreground/50">Message...</div>
            : <div className="bg-background border rounded h-7 text-xs px-2 flex items-center text-muted-foreground/50">{FORM_FIELD_LABELS[f.name]}...</div>
          }
        </div>
      ))}
      <div className="bg-blue-600 text-white text-xs text-center py-1.5 rounded font-medium">Submit</div>
    </div>
  );
}

function FormDialog({
  websites,
  onClose,
  editForm,
}: {
  websites: { id: number; name: string }[];
  onClose: () => void;
  editForm?: LeadForm | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateLeadForm();
  const updateMutation = useUpdateLeadForm();

  const [name, setName] = useState(editForm?.name ?? "");
  const [websiteId, setWebsiteId] = useState<number | null>(editForm?.websiteId ?? null);
  const [fields, setFields] = useState<LeadFormField[]>(
    editForm?.fieldsJson?.length ? (editForm.fieldsJson as LeadFormField[]) : DEFAULT_FIELDS
  );
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (editForm) {
      setName(editForm.name);
      setWebsiteId(editForm.websiteId);
      setFields(editForm.fieldsJson?.length ? (editForm.fieldsJson as LeadFormField[]) : DEFAULT_FIELDS);
    }
  }, [editForm?.id]);

  const handleFieldChange = (idx: number, updated: LeadFormField) => {
    setFields(prev => prev.map((f, i) => i === idx ? updated : f));
  };

  const handleSave = () => {
    if (!name.trim()) { toast({ title: "Form name is required", variant: "destructive" }); return; }
    if (!websiteId) { toast({ title: "Please select a website", variant: "destructive" }); return; }
    if (!fields.some(f => f.enabled)) { toast({ title: "Enable at least one field", variant: "destructive" }); return; }

    if (editForm) {
      updateMutation.mutate({ id: editForm.id, data: { name: name.trim(), fieldsJson: fields } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadFormsQueryKey() });
          toast({ title: "Form updated" });
          onClose();
        },
        onError: () => toast({ title: "Failed to update form", variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: { name: name.trim(), websiteId: websiteId!, fieldsJson: fields } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadFormsQueryKey() });
          toast({ title: "Form created" });
          onClose();
        },
        onError: () => toast({ title: "Failed to create form", variant: "destructive" }),
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editForm ? "Edit Form" : "New Lead Capture Form"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Form Name</label>
            <Input
              data-testid="input-form-name"
              placeholder="e.g. Homepage Contact Form"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          {!editForm && (
            <div>
              <label className="text-sm font-medium block mb-1">Website</label>
              <Select value={websiteId ? String(websiteId) : ""} onValueChange={v => setWebsiteId(parseInt(v))}>
                <SelectTrigger data-testid="select-form-website">
                  <SelectValue placeholder="Select website" />
                </SelectTrigger>
                <SelectContent>
                  {websites.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Form Fields</label>
              <button
                type="button"
                onClick={() => setShowPreview(p => !p)}
                className="text-xs text-primary flex items-center gap-1 hover:underline"
                data-testid="button-toggle-preview"
              >
                <Eye className="h-3.5 w-3.5" />
                {showPreview ? "Hide preview" : "Show preview"}
              </button>
            </div>
            <div className="border rounded-md p-2">
              {fields.map((field, idx) => (
                <FormFieldRow key={field.name} field={field} onChange={updated => handleFieldChange(idx, updated)} />
              ))}
            </div>
          </div>
          {showPreview && (
            <div>
              <label className="text-sm font-medium block mb-1 text-muted-foreground">Live Preview</label>
              <FormPreview fields={fields} />
            </div>
          )}
          <Button data-testid="button-save-form" className="w-full" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : (editForm ? "Save Changes" : "Create Form")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormsTab() {
  const { data: forms, isLoading } = useListLeadForms();
  const { data: websites } = useListWebsites();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteLeadForm();
  const updateMutation = useUpdateLeadForm();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<LeadForm | null>(null);
  const [embedForm, setEmbedForm] = useState<LeadForm | null>(null);

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeadFormsQueryKey() });
        toast({ title: "Form deleted" });
      },
      onError: () => toast({ title: "Failed to delete form", variant: "destructive" }),
    });
  };

  const handleToggleActive = (form: LeadForm) => {
    updateMutation.mutate({ id: form.id, data: { active: !form.active } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListLeadFormsQueryKey() }),
      onError: () => toast({ title: "Failed to update form", variant: "destructive" }),
    });
  };

  const siteMap = Object.fromEntries((websites ?? []).map(w => [w.id, w.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Create embeddable forms to capture leads from any webpage.</p>
        <Button size="sm" data-testid="button-new-form" onClick={() => { setEditForm(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Form
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !forms?.length ? (
            <div className="text-center py-14 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium mb-1">No forms yet</p>
              <p className="text-xs">Create a form and embed it on your website to capture leads automatically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Form Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Website</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Submissions</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {forms.map(f => (
                    <tr key={f.id} data-testid={`row-form-${f.id}`} className="border-b last:border-0 hover:bg-muted/20 group">
                      <td className="px-4 py-3 font-medium">{f.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{siteMap[f.websiteId] ?? `#${f.websiteId}`}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-mono">{f.submissionCount}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          data-testid={`toggle-form-active-${f.id}`}
                          onClick={() => handleToggleActive(f)}
                          className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                            f.active
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {f.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100"
                            data-testid={`button-embed-${f.id}`}
                            onClick={() => setEmbedForm(f)}
                          >
                            <Code2 className="h-3.5 w-3.5" /> Embed
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            data-testid={`button-edit-form-${f.id}`}
                            onClick={() => { setEditForm(f); setDialogOpen(true); }}
                          >
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            data-testid={`button-delete-form-${f.id}`}
                            onClick={() => handleDelete(f.id)}
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

      {dialogOpen && (
        <FormDialog
          websites={websites ?? []}
          editForm={editForm}
          onClose={() => { setDialogOpen(false); setEditForm(null); }}
        />
      )}
      {embedForm && <EmbedDialog form={embedForm} onClose={() => setEmbedForm(null)} />}
    </div>
  );
}
