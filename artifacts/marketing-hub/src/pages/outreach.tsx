import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Trophy,
  MessageSquare,
  TrendingUp,
  X,
  Bell,
} from "lucide-react";
import { HelpTooltip } from "@/components/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type OutreachType = "guest_post" | "link_request" | "partnership" | "pr";
type OutreachStatus = "not_sent" | "sent" | "opened" | "replied" | "rejected" | "won";

interface OutreachContact {
  id: number;
  name: string;
  domain: string;
  email: string | null;
  type: OutreachType;
  status: OutreachStatus;
  dateSent: string | null;
  followUpDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface OutreachStats {
  total: number;
  won: number;
  replied: number;
  replyRate: number;
  followupsDue: number;
}

const TYPE_LABELS: Record<OutreachType, string> = {
  guest_post: "Guest Post",
  link_request: "Link Request",
  partnership: "Partnership",
  pr: "PR",
};

const STATUS_LABELS: Record<OutreachStatus, string> = {
  not_sent: "Not Sent",
  sent: "Sent",
  opened: "Opened",
  replied: "Replied",
  rejected: "Rejected",
  won: "Won",
};

function StatusBadge({ status }: { status: OutreachStatus }) {
  const classes: Record<OutreachStatus, string> = {
    not_sent: "bg-muted text-muted-foreground",
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    opened: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    replied: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    won: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", classes[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function isFollowupDue(contact: OutreachContact): boolean {
  if (!contact.followUpDate || contact.status !== "sent") return false;
  return contact.followUpDate <= new Date().toISOString().split("T")[0]!;
}

const emptyForm = {
  name: "",
  domain: "",
  email: "",
  type: "link_request" as OutreachType,
  status: "not_sent" as OutreachStatus,
  dateSent: "",
  followUpDate: "",
  notes: "",
};

async function fetchContacts(filter: string): Promise<OutreachContact[]> {
  const params = filter === "followup_due" ? "?followup_due=1" : filter !== "all" ? `?status=${filter}` : "";
  const res = await fetch(`${BASE}/api/outreach${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load contacts");
  return res.json();
}

async function fetchStats(): Promise<OutreachStats> {
  const res = await fetch(`${BASE}/api/outreach/stats`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export default function OutreachPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<OutreachContact | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<OutreachContact | null>(null);
  const [sortCol, setSortCol] = useState<keyof OutreachContact>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["outreach", filter],
    queryFn: () => fetchContacts(filter),
  });

  const { data: stats } = useQuery({
    queryKey: ["outreach-stats"],
    queryFn: fetchStats,
  });

  const sorted = useMemo(() => {
    return [...contacts].sort((a, b) => {
      const av = a[sortCol] ?? "";
      const bv = b[sortCol] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [contacts, sortCol, sortDir]);

  function toggleSort(col: keyof OutreachContact) {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm });
    setSheetOpen(true);
  }

  function openEdit(contact: OutreachContact) {
    setEditing(contact);
    setForm({
      name: contact.name,
      domain: contact.domain,
      email: contact.email ?? "",
      type: contact.type,
      status: contact.status,
      dateSent: contact.dateSent ?? "",
      followUpDate: contact.followUpDate ?? "",
      notes: contact.notes ?? "",
    });
    setSheetOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        domain: form.domain.trim(),
        email: form.email.trim() || null,
        type: form.type,
        status: form.status,
        dateSent: form.dateSent || null,
        followUpDate: form.followUpDate || null,
        notes: form.notes.trim() || null,
      };
      const url = editing ? `${BASE}/api/outreach/${editing.id}` : `${BASE}/api/outreach`;
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-stats"] });
      setSheetOpen(false);
      toast({ title: editing ? "Contact updated" : "Contact added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/outreach/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-stats"] });
      setDeleteTarget(null);
      toast({ title: "Contact deleted" });
    },
    onError: () => toast({ title: "Error deleting contact", variant: "destructive" }),
  });

  const canSave = form.name.trim().length > 0 && form.domain.trim().length > 0;

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "not_sent", label: "Not Sent" },
    { id: "sent", label: "Sent" },
    { id: "opened", label: "Opened" },
    { id: "replied", label: "Replied" },
    { id: "rejected", label: "Rejected" },
    { id: "won", label: "Won" },
    { id: "followup_due", label: "Follow-ups Due" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-6 w-6" /> Outreach Tracker
            <HelpTooltip text="Outreach is the process of contacting other websites or journalists to secure backlinks, guest posts, or press coverage. Track every contact here — from first email through to a won deal — so nothing slips through the cracks." />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track guest posts, link requests, partnerships, and PR outreach.
          </p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-contact">
          <Plus className="h-4 w-4 mr-2" /> Add Contact
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Total Outreach</p>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Reply Rate</p>
              <p className="text-2xl font-bold">{stats?.replyRate ?? 0}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Won</p>
              <p className="text-2xl font-bold">{stats?.won ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer transition-all", filter === "followup_due" && "ring-2 ring-amber-400")}
          onClick={() => setFilter(filter === "followup_due" ? "all" : "followup_due")}
          data-testid="card-followups-due"
        >
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <Bell className={cn("h-5 w-5 shrink-0", (stats?.followupsDue ?? 0) > 0 ? "text-amber-500" : "text-muted-foreground")} />
            <div>
              <p className="text-xs text-muted-foreground">Follow-ups Due</p>
              <p className={cn("text-2xl font-bold", (stats?.followupsDue ?? 0) > 0 ? "text-amber-600" : "")}>{stats?.followupsDue ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            data-testid={`filter-${f.id}`}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f.label}
            {f.id === "followup_due" && (stats?.followupsDue ?? 0) > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {stats?.followupsDue}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="font-medium">No outreach contacts yet</p>
            <p className="text-sm text-muted-foreground">
              {filter !== "all" && filter !== "followup_due"
                ? "No contacts match this filter."
                : filter === "followup_due"
                ? "No follow-ups are due right now."
                : "Add your first contact to start tracking outreach."}
            </p>
            {filter === "all" && (
              <Button onClick={openAdd} className="mt-2">
                <Plus className="h-4 w-4 mr-2" /> Add Contact
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="outreach-table">
              <thead>
                <tr className="border-b bg-muted/30">
                  {[
                    { key: "name" as const, label: "Contact" },
                    { key: "domain" as const, label: "Domain" },
                    { key: "type" as const, label: "Type" },
                    { key: "status" as const, label: "Status" },
                    { key: "dateSent" as const, label: "Date Sent" },
                    { key: "followUpDate" as const, label: "Follow-up" },
                  ].map(col => (
                    <th
                      key={col.key}
                      className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      {sortCol === col.key && (
                        <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {sorted.map(contact => {
                  const followupDue = isFollowupDue(contact);
                  return (
                    <tr
                      key={contact.id}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/20 transition-colors",
                        followupDue && "bg-amber-50/50 dark:bg-amber-900/10"
                      )}
                      data-testid={`row-${contact.id}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {followupDue && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          <div>
                            <p className="font-medium">{contact.name}</p>
                            {contact.email && (
                              <p className="text-xs text-muted-foreground">{contact.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{contact.domain}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[contact.type] ?? contact.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={contact.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {contact.dateSent ?? "—"}
                      </td>
                      <td className={cn("px-4 py-3 text-xs", followupDue ? "text-amber-600 font-medium" : "text-muted-foreground")}>
                        {contact.followUpDate ?? "—"}
                        {followupDue && " ⚠️"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEdit(contact)}
                            data-testid={`button-edit-${contact.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(contact)}
                            data-testid={`button-delete-${contact.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Slide-in form */}
      <Sheet open={sheetOpen} onOpenChange={open => { if (!open) setSheetOpen(false); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>{editing ? "Edit Contact" : "Add Contact"}</span>
              <Button size="icon" variant="ghost" onClick={() => setSheetOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Contact Name *</Label>
              <Input
                placeholder="Jane Smith"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                data-testid="input-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Website / Domain *</Label>
              <Input
                placeholder="example.com"
                value={form.domain}
                onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                data-testid="input-domain"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                data-testid="input-email"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Outreach Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as OutreachType }))}>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guest_post">Guest Post</SelectItem>
                    <SelectItem value="link_request">Link Request</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="pr">PR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as OutreachStatus }))}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_sent">Not Sent</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="opened">Opened</SelectItem>
                    <SelectItem value="replied">Replied</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date Sent</Label>
                <Input
                  type="date"
                  value={form.dateSent}
                  onChange={e => setForm(f => ({ ...f, dateSent: e.target.value }))}
                  data-testid="input-date-sent"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Follow-up Date</Label>
                <Input
                  type="date"
                  value={form.followUpDate}
                  onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))}
                  data-testid="input-followup-date"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any relevant context or previous interactions…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={4}
                data-testid="input-notes"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || saveMutation.isPending}
                data-testid="button-save-contact"
              >
                {saveMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                  : editing ? "Update Contact" : "Add Contact"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" from {deleteTarget?.domain} will be permanently removed.
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
    </div>
  );
}
