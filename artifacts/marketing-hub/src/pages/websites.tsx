import { useState } from "react";
import { Link } from "wouter";
import { Plus, Globe, ExternalLink, Trash2, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useListWebsites,
  useCreateWebsite,
  useDeleteWebsite,
  getListWebsitesQueryKey,
} from "@workspace/api-client-react";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  niche: z.string().min(1, "Niche is required"),
  seoScore: z.coerce.number().min(0).max(100).optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: z.string().optional().nullable(),
});

type CreateForm = z.infer<typeof createSchema>;

export default function Websites() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: websites, isLoading } = useListWebsites();
  const createMutation = useCreateWebsite();
  const deleteMutation = useDeleteWebsite();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", url: "", niche: "", status: "active", notes: "", seoScore: null },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({ data: data as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWebsitesQueryKey() });
        toast({ title: "Website added" });
        form.reset();
        setOpen(false);
      },
      onError: () => toast({ title: "Failed to add website", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWebsitesQueryKey() });
        toast({ title: "Website deleted" });
      },
    });
  };

  const filtered = (websites ?? []).filter(w =>
    !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Websites</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your website portfolio</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-website" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Website
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Website</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-website-name" placeholder="My Blog" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="url" render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl><Input {...field} data-testid="input-website-url" placeholder="https://example.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="niche" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niche</FormLabel>
                    <FormControl><Input {...field} data-testid="input-website-niche" placeholder="Health & Fitness" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="seoScore" render={({ field }) => (
                    <FormItem>
                      <FormLabel>SEO Score (0-100)</FormLabel>
                      <FormControl><Input {...field} type="number" data-testid="input-website-seo-score" placeholder="75" value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger data-testid="select-website-status"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea {...field} data-testid="input-website-notes" placeholder="Optional notes..." value={field.value ?? ""} rows={2} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" data-testid="button-submit-website" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Add Website"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search-websites"
          className="pl-8"
          placeholder="Search websites..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? "No websites match your search" : "No websites yet. Add your first one."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(site => (
            <Card key={site.id} data-testid={`card-website-${site.id}`} className="hover:shadow-md transition-shadow group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/websites/${site.id}`}>
                    <a data-testid={`link-website-detail-${site.id}`} className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1">{site.name}</a>
                  </Link>
                  <Badge variant={site.status === "active" ? "default" : "secondary"} className="text-xs shrink-0">{site.status}</Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <a href={site.url} target="_blank" rel="noreferrer" data-testid={`link-website-url-${site.id}`} className="truncate hover:text-primary flex items-center gap-1">
                    {site.url} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pb-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Niche</span>
                  <span className="font-medium">{site.niche}</span>
                </div>
                {site.seoScore !== null && site.seoScore !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">SEO Score</span>
                    <span className={`font-bold ${site.seoScore >= 70 ? "text-green-600 dark:text-green-400" : site.seoScore >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                      {site.seoScore}/100
                    </span>
                  </div>
                )}
                {site.notes && <p className="text-xs text-muted-foreground line-clamp-2">{site.notes}</p>}
                <div className="flex items-center justify-between pt-1">
                  <Link href={`/websites/${site.id}`}>
                    <a data-testid={`button-view-website-${site.id}`} className="text-xs text-primary hover:underline">View details</a>
                  </Link>
                  <Button
                    variant="ghost" size="icon"
                    data-testid={`button-delete-website-${site.id}`}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                    onClick={() => handleDelete(site.id, site.name)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
