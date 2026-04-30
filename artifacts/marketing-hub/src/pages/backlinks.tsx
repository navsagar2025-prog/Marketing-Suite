import { useState } from "react";
import { Plus, Link2, Trash2, Search } from "lucide-react";
import { HelpTooltip } from "@/components/HelpTooltip";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

const statusVariant = (s: string): "default" | "outline" | "secondary" => {
  if (s === "link_secured") return "default";
  if (s === "rejected") return "secondary";
  return "outline";
};

const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export default function Backlinks() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: websites } = useListWebsites();
  const { data: backlinks, isLoading } = useListBacklinks(filterStatus !== "all" ? { status: filterStatus } : undefined, {
    query: { queryKey: getListBacklinksQueryKey(filterStatus !== "all" ? { status: filterStatus } : undefined) }
  });
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
                <p className="text-xs mt-2 max-w-sm mx-auto leading-relaxed">
                  A backlink is when another website links to yours — search engines use these as a trust signal. Start by adding domains you'd like to reach out to, then track each outreach attempt as it progresses.
                </p>
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
    </div>
  );
}
