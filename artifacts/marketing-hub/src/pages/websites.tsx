import { useState } from "react";
import { Link } from "wouter";
import PlanLimitWarning from "@/components/PlanLimitWarning";
import { Plus, Globe, ExternalLink, Trash2, Search, Loader2, Sparkles, CheckCircle, X, Rocket, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useListWebsites,
  useCreateWebsite,
  useDeleteWebsite,
  useDetectWebsite,
  getListWebsitesQueryKey,
  useGetSettings,
  useUpdateSettings,
  useGetBillingMe,
  getGetSettingsQueryKey,
  getGetBillingMeQueryKey,
} from "@workspace/api-client-react";

const urlOnlySchema = z.object({
  url: z.string().url("Must be a valid URL"),
});

const createSchema = z.object({
  name: z.string().optional().nullable(),
  url: z.string().url("Must be a valid URL"),
  niche: z.string().optional().nullable(),
  seoScore: z.coerce.number().min(0).max(100).optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: z.string().optional().nullable(),
});

type UrlOnlyForm = z.infer<typeof urlOnlySchema>;
type CreateForm = z.infer<typeof createSchema>;

const WEBSITE_TIP_KEY = "tip_first_website_dismissed";

export default function Websites() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"url" | "details">("url");
  const [search, setSearch] = useState("");
  const [tipDismissedLocal, setTipDismissedLocal] = useState(() => localStorage.getItem(WEBSITE_TIP_KEY) === "true");
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: websites, isLoading } = useListWebsites();
  const { data: settings } = useGetSettings();
  const { data: billing } = useGetBillingMe({ query: { queryKey: getGetBillingMeQueryKey() } });
  const updateSettingsMutation = useUpdateSettings();
  const createMutation = useCreateWebsite();
  const deleteMutation = useDeleteWebsite();
  const detectMutation = useDetectWebsite();

  const serverDismissedTips = settings?.dismissedTips ?? null;
  const tipDismissed = tipDismissedLocal || (serverDismissedTips?.includes(WEBSITE_TIP_KEY) ?? false);

  const urlForm = useForm<UrlOnlyForm>({
    resolver: zodResolver(urlOnlySchema),
    defaultValues: { url: "" },
  });

  const detailForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", url: "", niche: "", status: "active", notes: "", seoScore: null },
  });

  const onDetect = (data: UrlOnlyForm) => {
    detectMutation.mutate({ data: { url: data.url } }, {
      onSuccess: (info) => {
        detailForm.setValue("url", data.url);
        detailForm.setValue("name", info.name || "");
        detailForm.setValue("niche", info.niche || "");
        if (info.seoScore != null) detailForm.setValue("seoScore", info.seoScore);
        if (info.description) detailForm.setValue("notes", info.description);
        setStep("details");
      },
      onError: () => {
        detailForm.setValue("url", data.url);
        detailForm.setValue("name", new URL(data.url).hostname.replace("www.", ""));
        setStep("details");
      },
    });
  };

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({ data: data as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWebsitesQueryKey() });
        toast({ title: "Website added" });
        detailForm.reset();
        urlForm.reset();
        setStep("url");
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

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      setStep("url");
      urlForm.reset();
      detailForm.reset();
    }
  };

  const dismissTip = () => {
    localStorage.setItem(WEBSITE_TIP_KEY, "true");
    setTipDismissedLocal(true);
    const current = serverDismissedTips ?? [];
    if (!current.includes(WEBSITE_TIP_KEY)) {
      updateSettingsMutation.mutate(
        { data: { dismissedTips: [...current, WEBSITE_TIP_KEY] } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() }) },
      );
    }
  };

  const filtered = (websites ?? []).filter(w =>
    !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.url.toLowerCase().includes(search.toLowerCase())
  );

  const showFirstWebsiteTip = !tipDismissed && (websites ?? []).length === 1;

  const isStarterPlan = billing?.plan === "starter";
  const websiteCount = (websites ?? []).length;
  const websiteLimit = billing?.limits?.websites ?? 1;
  const isAtWebsiteLimit = isStarterPlan && websiteCount >= websiteLimit;

  const handleAddWebsiteClick = () => {
    if (isAtWebsiteLimit) {
      setLimitModalOpen(true);
    } else {
      setOpen(true);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Websites</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your website portfolio</p>
        </div>
        <Button data-testid="button-add-website" size="sm" onClick={handleAddWebsiteClick}>
          <Plus className="h-4 w-4 mr-1" /> Add Website
        </Button>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Website</DialogTitle>
            </DialogHeader>

            {step === "url" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter your website URL and we'll automatically detect the name, niche, and SEO score.
                </p>
                <Form {...urlForm}>
                  <form onSubmit={urlForm.handleSubmit(onDetect)} className="space-y-4">
                    <FormField control={urlForm.control} name="url" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website URL</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-website-url" placeholder="https://example.com" autoFocus />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button
                      type="submit"
                      data-testid="button-detect-website"
                      className="w-full"
                      disabled={detectMutation.isPending}
                    >
                      {detectMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing URL...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" /> Analyze & Continue</>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-xs"
                      onClick={() => {
                        const url = urlForm.getValues("url");
                        detailForm.setValue("url", url);
                        setStep("details");
                      }}
                    >
                      Skip auto-detect, fill manually
                    </Button>
                  </form>
                </Form>
              </div>
            ) : (
              <div className="space-y-4">
                {detectMutation.isSuccess && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 px-3 py-2 rounded-md">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>Auto-detected niche and SEO score from your URL</span>
                  </div>
                )}
                <Form {...detailForm}>
                  <form onSubmit={detailForm.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={detailForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name <span className="text-muted-foreground text-xs font-normal">(auto-detected if blank)</span></FormLabel>
                        <FormControl><Input {...field} data-testid="input-website-name" placeholder="My Blog" value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={detailForm.control} name="url" render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL</FormLabel>
                        <FormControl><Input {...field} data-testid="input-website-url-detail" placeholder="https://example.com" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={detailForm.control} name="niche" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Niche <span className="text-muted-foreground text-xs font-normal">(auto-detected if blank)</span></FormLabel>
                        <FormControl><Input {...field} data-testid="input-website-niche" placeholder="Health & Fitness" value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={detailForm.control} name="seoScore" render={({ field }) => (
                        <FormItem>
                          <FormLabel>SEO Score (0-100)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              data-testid="input-website-seo-score"
                              placeholder="Auto-detected"
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={detailForm.control} name="status" render={({ field }) => (
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
                    <FormField control={detailForm.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl><Textarea {...field} data-testid="input-website-notes" placeholder="Optional notes..." value={field.value ?? ""} rows={2} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setStep("url")}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        data-testid="button-submit-website"
                        className="flex-1"
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? "Adding..." : "Add Website"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Website limit modal for Starter plan */}
      <Dialog open={limitModalOpen} onOpenChange={setLimitModalOpen}>
        <DialogContent data-testid="modal-website-limit">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Website limit reached
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Your <strong>Starter plan</strong> includes{" "}
              <strong>1 website</strong>. You've already added {websiteCount}{" "}
              {websiteCount === 1 ? "website" : "websites"}.
            </p>
            <p className="text-sm text-muted-foreground">
              Upgrade to <strong>Growth</strong> to track up to 5 websites, or go{" "}
              <strong>Agency</strong> for unlimited websites.
            </p>
            <div className="flex gap-2 pt-1">
              <Link href="/pricing" className="flex-1">
                <Button className="w-full" data-testid="button-go-to-pricing">
                  <Zap className="h-4 w-4 mr-1" /> View Plans
                </Button>
              </Link>
              <Button variant="outline" onClick={() => setLimitModalOpen(false)}>
                Maybe later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* First website tip */}
      {showFirstWebsiteTip && (
        <div
          data-testid="banner-first-website-tip"
          className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
        >
          <Rocket className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-medium text-primary">Great!</span>{" "}
            <span className="text-foreground">Now run an audit to get your SEO score</span>{" "}
            <Link href={`/websites/${(websites ?? [])[0]?.id}`} className="text-primary font-medium underline underline-offset-2 hover:no-underline">
              Run audit →
            </Link>
          </div>
          <button
            data-testid="button-dismiss-first-website-tip"
            onClick={dismissTip}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Dismiss tip"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <PlanLimitWarning billing={billing} metric="websites" />

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-state-websites">
          <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-sm text-foreground">{search ? "No websites match your search" : "Add your first website"}</p>
          {!search && (
            <>
              <p className="text-xs mt-1.5 max-w-xs mx-auto leading-relaxed">
                Connect a website to start tracking keywords, auditing performance, and monitoring your SEO health score.
              </p>
              <Button size="sm" className="mt-4" onClick={() => setDialogOpen(true)} data-testid="empty-cta-add-website">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Website
              </Button>
            </>
          )}
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
