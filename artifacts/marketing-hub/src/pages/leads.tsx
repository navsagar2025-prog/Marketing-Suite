import { useState } from "react";
import { Plus, Users, Trash2, Search, TrendingUp, ArrowUpDown } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import {
  useListLeads,
  useCreateLead,
  useDeleteLead,
  useGetLeadsFunnel,
  useListWebsites,
  getListLeadsQueryKey,
  getGetLeadsFunnelQueryKey,
} from "@workspace/api-client-react";

const STATUS_OPTIONS = ["new", "contacted", "qualified", "converted", "lost"];
const SOURCE_OPTIONS = ["organic", "paid", "social", "direct", "referral"];

const createSchema = z.object({
  websiteId: z.coerce.number().min(1, "Website is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.enum(["organic", "paid", "social", "direct", "referral"]).default("organic"),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).default("new"),
  notes: z.string().optional().nullable(),
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

export default function Leads() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterIntent, setFilterIntent] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: websites } = useListWebsites();
  const { data: funnel } = useGetLeadsFunnel();
  const { data: leads, isLoading } = useListLeads(filterStatus !== "all" ? { status: filterStatus } : undefined, {
    query: { queryKey: getListLeadsQueryKey(filterStatus !== "all" ? { status: filterStatus } : undefined) }
  });
  const createMutation = useCreateLead();
  const deleteMutation = useDeleteLead();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", source: "organic", status: "new", notes: "" },
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your lead generation pipeline</p>
        </div>
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
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea {...field} data-testid="input-lead-notes" placeholder="Optional notes..." value={field.value ?? ""} rows={2} /></FormControl>
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
      </div>

      {/* Funnel */}
      {funnel && funnelData.some(d => d.value > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Lead Funnel</CardTitle>
              {funnel.totalValue && (
                <span className="text-sm text-muted-foreground">Pipeline value: <span className="font-semibold text-foreground">${Number(funnel.totalValue).toLocaleString()}</span></span>
              )}
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
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{search || filterIntent ? "No leads match" : "No leads yet"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
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
                      <td className="px-4 py-3 text-muted-foreground capitalize">{l.source}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{l.value ? `$${parseFloat(String(l.value)).toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[l.status] ?? ""}`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ScoreBadge
                          score={l.score}
                          breakdown={l.scoreBreakdown as ScoreBreakdown | null}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" data-testid={`button-delete-lead-${l.id}`} onClick={() => handleDelete(l.id)} disabled={deleteMutation.isPending}>
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
    </div>
  );
}
