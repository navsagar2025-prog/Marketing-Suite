import { useState } from "react";
import { Plus, Megaphone, Sparkles, Trash2, Search, ImageIcon, Send, Users } from "lucide-react";
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
  useListCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
  useGenerateCampaignCopy,
  useListWebsites,
  useGetSettings,
  useGetEmailProviderSettings,
  useSendCampaignEmail,
  useGetCampaignRecipients,
  getGetCampaignRecipientsQueryKey,
  getListCampaignsQueryKey,
} from "@workspace/api-client-react";
import { AiMediaDialog } from "@/components/AiMediaDialog";
import { Link } from "wouter";

const createSchema = z.object({
  websiteId: z.coerce.number().min(1, "Website is required"),
  name: z.string().min(1, "Name is required"),
  type: z.enum(["organic", "paid", "email", "social"]).default("organic"),
  goal: z.string().min(1, "Goal is required"),
  budget: z.coerce.number().optional().nullable(),
  status: z.enum(["planning", "active", "paused", "completed"]).default("planning"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type CreateForm = z.infer<typeof createSchema>;

const statusVariant = (s: string): "default" | "outline" | "secondary" => {
  if (s === "active") return "default";
  if (s === "planning") return "outline";
  return "secondary";
};

const typeColor: Record<string, string> = {
  organic: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  paid: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  email: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  social: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

interface CampaignContext { id: number; websiteId: number | null }

export default function Campaigns() {
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMediaOpen, setAiMediaOpen] = useState(false);
  const [mediaCampaignCtx, setMediaCampaignCtx] = useState<CampaignContext | null>(null);
  const [search, setSearch] = useState("");
  const [aiGoal, setAiGoal] = useState("");
  const [aiProduct, setAiProduct] = useState("");
  const [aiResult, setAiResult] = useState("");

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeCampaignId, setComposeCampaignId] = useState<number | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeStatuses, setComposeStatuses] = useState<string[]>(["new", "contacted", "qualified"]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: campaigns, isLoading } = useListCampaigns();
  const { data: websites } = useListWebsites();
  const createMutation = useCreateCampaign();
  const deleteMutation = useDeleteCampaign();
  const generateMutation = useGenerateCampaignCopy();
  const { data: settings } = useGetSettings();
  const { data: emailProviderSettings } = useGetEmailProviderSettings();
  const sendMutation = useSendCampaignEmail();
  const recipientParams = { statuses: composeStatuses.join(",") };
  const { data: recipientPreview } = useGetCampaignRecipients(
    composeCampaignId ?? 0,
    recipientParams,
    { query: { enabled: !!composeCampaignId && composeOpen, queryKey: getGetCampaignRecipientsQueryKey(composeCampaignId ?? 0, recipientParams) } }
  );
  const aiProvider = settings?.aiProvider ?? "replit";
  const aiDisabled = settings !== undefined && (!settings.aiEnabled || (aiProvider !== "replit" && !settings.aiApiKeyConfigured));
  const falDisabled = settings !== undefined && !settings.falApiKeyConfigured;
  const emailConfigured = !!emailProviderSettings?.provider;

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", type: "organic", goal: "", status: "planning", notes: "" },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({ data: data as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        toast({ title: "Campaign created" });
        form.reset();
        setOpen(false);
      },
      onError: () => toast({ title: "Failed to create campaign", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() }),
    });
  };

  const handleGenerate = () => {
    if (!aiGoal.trim() || !aiProduct.trim()) return;
    generateMutation.mutate({ data: { campaignGoal: aiGoal, product: aiProduct } }, {
      onSuccess: (r) => setAiResult(r.content),
      onError: () => toast({ title: "Generation failed", variant: "destructive" }),
    });
  };

  const openCompose = (campaignId: number) => {
    setComposeCampaignId(campaignId);
    setComposeSubject("");
    setComposeBody("");
    setComposeStatuses(["new", "contacted", "qualified"]);
    setComposeOpen(true);
  };

  const handleSend = () => {
    if (!composeCampaignId || !composeSubject.trim() || !composeBody.trim()) return;
    sendMutation.mutate(
      {
        id: composeCampaignId,
        data: { subject: composeSubject.trim(), body: composeBody.trim(), recipientStatuses: composeStatuses },
      },
      {
        onSuccess: (r) => {
          toast({ title: `Sent to ${r.sent} recipient${r.sent !== 1 ? "s" : ""}` });
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
          setComposeOpen(false);
        },
        onError: (err) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const toggleStatus = (s: string) => {
    setComposeStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const filtered = (campaigns ?? []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.goal.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and track all marketing campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            data-testid="button-ai-generate-image"
            onClick={() => setAiMediaOpen(true)}
            disabled={falDisabled}
            title={falDisabled ? "Fal API key not configured — add it in Settings" : undefined}
          >
            <ImageIcon className="h-4 w-4 mr-1" /> Generate Media
          </Button>
          <Dialog open={aiOpen} onOpenChange={setAiOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline" size="sm"
                data-testid="button-ai-campaign-copy"
                disabled={aiDisabled}
                title={aiDisabled ? "AI is disabled — enable in Settings" : undefined}
              >
                <Sparkles className="h-4 w-4 mr-1" /> AI Copy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>AI Campaign Copy Generator</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Campaign Goal</label>
                  <Input data-testid="input-ai-goal" className="mt-1" placeholder="Drive signups for free trial" value={aiGoal} onChange={e => setAiGoal(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Product/Service</label>
                  <Input data-testid="input-ai-product" className="mt-1" placeholder="SEO analytics tool" value={aiProduct} onChange={e => setAiProduct(e.target.value)} />
                </div>
                <Button data-testid="button-generate-copy" onClick={handleGenerate} disabled={generateMutation.isPending || !aiGoal.trim() || !aiProduct.trim()} className="w-full">
                  {generateMutation.isPending ? "Generating..." : "Generate Copy"}
                </Button>
                {aiResult && (
                  <div className="p-3 bg-muted rounded-md max-h-60 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-campaign-copy">{aiResult}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-campaign"><Plus className="h-4 w-4 mr-1" /> New Campaign</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="websiteId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <Select value={String(field.value ?? "")} onValueChange={v => field.onChange(parseInt(v))}>
                        <FormControl><SelectTrigger data-testid="select-campaign-website"><SelectValue placeholder="Select website" /></SelectTrigger></FormControl>
                        <SelectContent>{(websites ?? []).map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Name</FormLabel>
                      <FormControl><Input {...field} data-testid="input-campaign-name" placeholder="Q1 Organic Growth" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger data-testid="select-campaign-type"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="organic">Organic</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="social">Social</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger data-testid="select-campaign-status"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="goal" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal</FormLabel>
                      <FormControl><Input {...field} data-testid="input-campaign-goal" placeholder="Increase organic traffic by 30%" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="budget" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget ($)</FormLabel>
                      <FormControl><Input {...field} type="number" data-testid="input-campaign-budget" placeholder="5000" value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea {...field} data-testid="input-campaign-notes" placeholder="Optional notes..." value={field.value ?? ""} rows={2} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" data-testid="button-submit-campaign" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Campaign"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input data-testid="input-search-campaigns" className="pl-8" placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? "No campaigns match" : "No campaigns yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <Card key={c.id} data-testid={`card-campaign-${c.id}`} className="group hover:shadow-sm transition-shadow">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${typeColor[c.type] ?? ""}`}>{c.type}</span>
                      <Badge variant={statusVariant(c.status)} className="text-xs">{c.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{c.goal}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      {c.budget && <span>Budget: <span className="font-medium text-foreground">${parseFloat(String(c.budget)).toLocaleString()}</span></span>}
                      {c.impressions && <span>Impressions: <span className="font-medium text-foreground">{c.impressions.toLocaleString()}</span></span>}
                      {c.clicks && <span>Clicks: <span className="font-medium text-foreground">{c.clicks.toLocaleString()}</span></span>}
                      {c.conversions && <span>Conversions: <span className="font-medium text-foreground">{c.conversions.toLocaleString()}</span></span>}
                      {c.sentCount != null && c.sentCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          Sent: <span className="font-medium text-foreground">{c.sentCount.toLocaleString()}</span>
                          {c.sentAt && <span className="text-muted-foreground/60">({new Date(c.sentAt).toLocaleDateString()})</span>}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.type === "email" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 opacity-0 group-hover:opacity-100 text-xs"
                        data-testid={`button-send-campaign-${c.id}`}
                        title={emailConfigured ? "Compose & send email" : "Configure email provider in Settings first"}
                        disabled={!emailConfigured}
                        onClick={() => openCompose(c.id)}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" /> Send
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 opacity-0 group-hover:opacity-100 text-xs"
                      data-testid={`button-generate-media-campaign-${c.id}`}
                      onClick={() => { setMediaCampaignCtx({ id: c.id, websiteId: c.websiteId ?? null }); setAiMediaOpen(true); }}
                    >
                      <ImageIcon className="h-3.5 w-3.5 mr-1" /> Media
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" data-testid={`button-delete-campaign-${c.id}`} onClick={() => handleDelete(c.id, c.name)} disabled={deleteMutation.isPending}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AiMediaDialog
        open={aiMediaOpen}
        onOpenChange={(v) => { setAiMediaOpen(v); if (!v) setMediaCampaignCtx(null); }}
        campaignId={mediaCampaignCtx?.id ?? null}
        websiteId={mediaCampaignCtx?.websiteId ?? null}
        onSelect={() => {
          const campaign = filtered.find(c => c.id === mediaCampaignCtx?.id);
          toast({
            title: "Media attached to campaign",
            description: campaign ? `Saved to "${campaign.name}" — view in Media Library.` : "Media saved to campaign.",
          });
        }}
      />

      {/* Compose & Send Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Compose Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Recipient filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Send to leads with status</label>
                {recipientPreview !== undefined && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-recipient-count">
                    <Users className="h-3.5 w-3.5" />
                    {recipientPreview.count} recipient{recipientPreview.count !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {["new", "contacted", "qualified", "converted", "lost"].map(s => (
                  <button
                    key={s}
                    type="button"
                    data-testid={`button-status-filter-${s}`}
                    onClick={() => toggleStatus(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      composeStatuses.includes(s)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Subject</label>
              <Input
                data-testid="input-compose-subject"
                placeholder="Your email subject..."
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
              />
            </div>

            {/* Body */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                data-testid="input-compose-body"
                placeholder="Write your email message here..."
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                rows={8}
              />
              <p className="text-xs text-muted-foreground">Plain text. HTML is supported.</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
              <Button
                data-testid="button-confirm-send"
                onClick={handleSend}
                disabled={!composeSubject.trim() || !composeBody.trim() || composeStatuses.length === 0 || sendMutation.isPending}
              >
                <Send className="h-4 w-4 mr-1" />
                {sendMutation.isPending ? "Sending..." : `Send${recipientPreview ? ` to ${recipientPreview.count}` : ""}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
