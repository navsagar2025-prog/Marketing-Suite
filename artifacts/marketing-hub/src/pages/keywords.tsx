import { useState } from "react";
import { Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useListKeywords,
  useCreateKeyword,
  useDeleteKeyword,
  useSuggestKeywords,
  useListWebsites,
  useGetSettings,
  getListKeywordsQueryKey,
} from "@workspace/api-client-react";

const createSchema = z.object({
  websiteId: z.coerce.number().min(1, "Website is required"),
  keyword: z.string().min(1, "Keyword is required"),
  currentRank: z.coerce.number().optional().nullable(),
  searchVolume: z.coerce.number().optional().nullable(),
  difficulty: z.coerce.number().min(0).max(100).optional().nullable(),
  status: z.enum(["tracking", "paused"]).default("tracking"),
  notes: z.string().optional().nullable(),
});

type CreateForm = z.infer<typeof createSchema>;

export default function Keywords() {
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [aiNiche, setAiNiche] = useState("");
  const [aiResult, setAiResult] = useState<Array<{ keyword: string; intent: string; estimatedDifficulty: string; notes: string }>>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: keywords, isLoading } = useListKeywords();
  const { data: websites } = useListWebsites();
  const createMutation = useCreateKeyword();
  const deleteMutation = useDeleteKeyword();
  const suggestMutation = useSuggestKeywords();
  const { data: settings } = useGetSettings();
  const aiProvider = settings?.aiProvider ?? "replit";
  const aiDisabled = settings !== undefined && (!settings.aiEnabled || (aiProvider !== "replit" && !settings.aiApiKeyConfigured));

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { keyword: "", status: "tracking", notes: "", currentRank: null, searchVolume: null, difficulty: null },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({ data: data as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
        toast({ title: "Keyword added" });
        form.reset();
        setOpen(false);
      },
      onError: () => toast({ title: "Failed to add keyword", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() }),
    });
  };

  const handleAiSuggest = () => {
    if (!aiNiche.trim()) return;
    suggestMutation.mutate({ data: { niche: aiNiche } }, {
      onSuccess: (result) => {
        setAiResult(result.keywords);
      },
      onError: () => toast({ title: "AI suggestion failed", variant: "destructive" }),
    });
  };

  const filtered = (keywords ?? []).filter(k =>
    !search || k.keyword.toLowerCase().includes(search.toLowerCase())
  );

  const difficultyColor = (d: number | null | undefined) => {
    if (!d) return "";
    if (d >= 70) return "text-red-600 dark:text-red-400";
    if (d >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Keywords</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your SEO keyword rankings</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={aiOpen} onOpenChange={setAiOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline" size="sm"
                data-testid="button-ai-suggest"
                disabled={aiDisabled}
                title={aiDisabled ? "AI is disabled — enable in Settings" : undefined}
              >
                <Sparkles className="h-4 w-4 mr-1" /> AI Suggest
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>AI Keyword Suggestions</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Your niche</label>
                  <Input
                    data-testid="input-ai-niche"
                    className="mt-1"
                    placeholder="e.g. health & fitness"
                    value={aiNiche}
                    onChange={e => setAiNiche(e.target.value)}
                  />
                </div>
                <Button data-testid="button-get-suggestions" onClick={handleAiSuggest} disabled={suggestMutation.isPending || !aiNiche.trim()} className="w-full">
                  {suggestMutation.isPending ? "Generating..." : "Get Suggestions"}
                </Button>
                {aiResult.length > 0 && (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {aiResult.map((kw, i) => (
                      <div key={i} data-testid={`suggestion-keyword-${i}`} className="p-3 border rounded-md text-sm">
                        <p className="font-semibold">{kw.keyword}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{kw.intent}</Badge>
                          <Badge variant="outline" className="text-xs">{kw.estimatedDifficulty}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{kw.notes}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-keyword">
                <Plus className="h-4 w-4 mr-1" /> Add Keyword
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Keyword</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="websiteId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <Select value={String(field.value ?? "")} onValueChange={v => field.onChange(parseInt(v))}>
                        <FormControl><SelectTrigger data-testid="select-keyword-website"><SelectValue placeholder="Select website" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(websites ?? []).map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="keyword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Keyword</FormLabel>
                      <FormControl><Input {...field} data-testid="input-keyword" placeholder="best running shoes" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-3 gap-3">
                    <FormField control={form.control} name="currentRank" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rank</FormLabel>
                        <FormControl><Input {...field} type="number" data-testid="input-keyword-rank" placeholder="5" value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="searchVolume" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Volume</FormLabel>
                        <FormControl><Input {...field} type="number" data-testid="input-keyword-volume" placeholder="1000" value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="difficulty" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty</FormLabel>
                        <FormControl><Input {...field} type="number" data-testid="input-keyword-difficulty" placeholder="45" value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger data-testid="select-keyword-status"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="tracking">Tracking</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea {...field} data-testid="input-keyword-notes" placeholder="Optional..." value={field.value ?? ""} rows={2} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" data-testid="button-submit-keyword" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Adding..." : "Add Keyword"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input data-testid="input-search-keywords" className="pl-8" placeholder="Search keywords..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{search ? "No keywords match" : "No keywords tracked yet"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Keyword</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Rank</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Volume</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Difficulty</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(kw => (
                    <tr key={kw.id} data-testid={`row-keyword-${kw.id}`} className="border-b last:border-0 hover:bg-muted/20 group">
                      <td className="px-4 py-3 font-medium">{kw.keyword}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{kw.currentRank ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{kw.searchVolume?.toLocaleString() ?? "—"}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${difficultyColor(kw.difficulty)}`}>{kw.difficulty ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={kw.status === "tracking" ? "default" : "secondary"} className="text-xs">{kw.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" data-testid={`button-delete-keyword-${kw.id}`} onClick={() => handleDelete(kw.id)} disabled={deleteMutation.isPending}>
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
