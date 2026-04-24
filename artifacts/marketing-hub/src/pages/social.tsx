import { useState } from "react";
import { Plus, Sparkles, Trash2, Calendar, MessageSquare, ImageIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Camera, Twitter, Briefcase, Youtube } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useListSocialPosts,
  useCreateSocialPost,
  useDeleteSocialPost,
  useGenerateSocialPost,
  useListWebsites,
  useGetSettings,
  getListSocialPostsQueryKey,
} from "@workspace/api-client-react";
import type { MediaAsset } from "@workspace/api-client-react";
import { AiMediaDialog } from "@/components/AiMediaDialog";

const PLATFORMS = [
  { value: "facebook", label: "Facebook", Icon: MessageCircle },
  { value: "instagram", label: "Instagram", Icon: Camera },
  { value: "twitter", label: "Twitter/X", Icon: Twitter },
  { value: "linkedin", label: "LinkedIn", Icon: Briefcase },
  { value: "youtube", label: "YouTube", Icon: Youtube },
];

const STATUS_OPTIONS = ["draft", "scheduled", "published"];

const createSchema = z.object({
  websiteId: z.coerce.number().min(1, "Website is required"),
  platform: z.string().min(1, "Platform is required"),
  content: z.string().min(1, "Content is required"),
  status: z.enum(["draft", "scheduled", "published"]).default("draft"),
  scheduledAt: z.string().optional().nullable(),
  mediaUrl: z.string().url().optional().nullable(),
  campaignId: z.coerce.number().optional().nullable(),
});

type CreateForm = z.infer<typeof createSchema>;

const platformIcon = (platform: string) => {
  const found = PLATFORMS.find(p => p.value === platform);
  if (!found) return <MessageSquare className="h-4 w-4" />;
  const { Icon } = found;
  return <Icon className="h-4 w-4" />;
};

const statusColor = (status: string) => {
  if (status === "published") return "default";
  if (status === "scheduled") return "outline";
  return "secondary";
};

export default function Social() {
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMediaOpen, setAiMediaOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiPlatform, setAiPlatform] = useState("instagram");
  const [aiResult, setAiResult] = useState("");
  const [activePlatform, setActivePlatform] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: websites } = useListWebsites();
  const { data: posts, isLoading } = useListSocialPosts(activePlatform !== "all" ? { platform: activePlatform } : undefined, {
    query: { queryKey: getListSocialPostsQueryKey(activePlatform !== "all" ? { platform: activePlatform } : undefined) }
  });
  const createMutation = useCreateSocialPost();
  const deleteMutation = useDeleteSocialPost();
  const generateMutation = useGenerateSocialPost();
  const { data: settings } = useGetSettings();
  const aiDisabled = settings !== undefined && settings.aiEnabled === false;

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { platform: "instagram", status: "draft", content: "" },
  });

  const formWebsiteId = form.watch("websiteId") ?? null;

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({ data: data as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSocialPostsQueryKey() });
        toast({ title: "Post created" });
        form.reset();
        setOpen(false);
      },
      onError: () => toast({ title: "Failed to create post", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSocialPostsQueryKey() }),
    });
  };

  const handleGenerate = () => {
    if (!aiTopic.trim()) return;
    generateMutation.mutate({ data: { platform: aiPlatform, topic: aiTopic } }, {
      onSuccess: (result) => setAiResult(result.content),
      onError: () => toast({ title: "Generation failed", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Social Media</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage posts across all platforms</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            data-testid="button-ai-generate-image"
            onClick={() => setAiMediaOpen(true)}
            disabled={aiDisabled}
            title={aiDisabled ? "AI is disabled — enable in Settings" : undefined}
          >
            <ImageIcon className="h-4 w-4 mr-1" /> Generate Media
          </Button>
          <Dialog open={aiOpen} onOpenChange={setAiOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline" size="sm"
                data-testid="button-ai-generate-post"
                disabled={aiDisabled}
                title={aiDisabled ? "AI is disabled — enable in Settings" : undefined}
              >
                <Sparkles className="h-4 w-4 mr-1" /> AI Generate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>AI Post Generator</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Platform</label>
                  <Select value={aiPlatform} onValueChange={setAiPlatform}>
                    <SelectTrigger data-testid="select-ai-platform" className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Topic</label>
                  <Input data-testid="input-ai-topic" className="mt-1" placeholder="e.g. 5 tips for better sleep" value={aiTopic} onChange={e => setAiTopic(e.target.value)} />
                </div>
                <Button data-testid="button-generate-post" onClick={handleGenerate} disabled={generateMutation.isPending || !aiTopic.trim()} className="w-full">
                  {generateMutation.isPending ? "Generating..." : "Generate Post"}
                </Button>
                {aiResult && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-ai-result">{aiResult}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-post"><Plus className="h-4 w-4 mr-1" /> New Post</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Post</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="websiteId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <Select value={String(field.value ?? "")} onValueChange={v => field.onChange(parseInt(v))}>
                        <FormControl><SelectTrigger data-testid="select-post-website"><SelectValue placeholder="Select website" /></SelectTrigger></FormControl>
                        <SelectContent>{(websites ?? []).map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="platform" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Platform</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger data-testid="select-post-platform"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger data-testid="select-post-status"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="content" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl><Textarea {...field} data-testid="input-post-content" rows={4} placeholder="Write your post..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule At (optional)</FormLabel>
                      <FormControl><Input {...field} type="datetime-local" data-testid="input-post-scheduled-at" value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="mediaUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Media URL (optional)</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input {...field} data-testid="input-post-media-url" placeholder="https://... or generate above" value={field.value ?? ""} onChange={e => field.onChange(e.target.value || null)} />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => { setOpen(false); setAiMediaOpen(true); }}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      {field.value && (
                        <img src={field.value} alt="Preview" className="mt-1 rounded-md max-h-32 object-contain border" />
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" data-testid="button-submit-post" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Post"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Platform tabs */}
      <Tabs value={activePlatform} onValueChange={setActivePlatform}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          {PLATFORMS.map(p => (
            <TabsTrigger key={p.value} value={p.value} data-testid={`tab-${p.value}`}>{p.label}</TabsTrigger>
          ))}
        </TabsList>

        {["all", ...PLATFORMS.map(p => p.value)].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : (posts ?? []).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No posts yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(posts ?? []).map(post => (
                  <Card key={post.id} data-testid={`card-post-${post.id}`} className="group">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="text-muted-foreground mt-0.5 shrink-0">{platformIcon(post.platform)}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm whitespace-pre-wrap line-clamp-3">{post.content}</p>
                            {post.scheduledAt && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(post.scheduledAt).toLocaleDateString()} {new Date(post.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={statusColor(post.status) as "default" | "outline" | "secondary"} className="text-xs">{post.status}</Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" data-testid={`button-delete-post-${post.id}`} onClick={() => handleDelete(post.id)} disabled={deleteMutation.isPending}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <AiMediaDialog
        open={aiMediaOpen}
        websiteId={formWebsiteId ? Number(formWebsiteId) : null}
        onOpenChange={setAiMediaOpen}
        onSelect={(asset: MediaAsset) => {
          form.setValue("mediaUrl", asset.url);
          setAiMediaOpen(false);
          setOpen(true);
        }}
      />
    </div>
  );
}
