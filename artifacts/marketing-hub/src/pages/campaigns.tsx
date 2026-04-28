import { useState, useEffect } from "react";
import { Plus, Megaphone, Sparkles, Trash2, Search, ImageIcon, Send, Users, Settings, Mail, Eye, EyeOff, List, ChevronDown, ChevronUp, Pencil, PlayCircle, PauseCircle } from "lucide-react";
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
  useListSequences,
  useCreateSequence,
  useUpdateSequence,
  useDeleteSequence,
  useGenerateSequence,
  getListSequencesQueryKey,
} from "@workspace/api-client-react";
import type { ListSequencesResponseItem, CreateSequenceBody } from "@workspace/api-client-react";
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

function renderMarkdownPreview(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-muted px-1 rounded text-xs'>$1</code>")
    .replace(/^### (.+)$/gm, "<h3 class='text-sm font-semibold mt-2'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-base font-semibold mt-3'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-lg font-bold mt-3'>$1</h1>")
    .replace(/^[*-] (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/\n/g, "<br/>");
}

type SequenceStep = { subject: string; body: string; delayDays: number };
type SequenceTrigger = { type: "status" | "score" | "source"; value: string | number };

function SequenceCard({
  seq,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  seq: ListSequencesResponseItem;
  onEdit: (seq: ListSequencesResponseItem) => void;
  onDelete: (id: number) => void;
  onToggleActive: (seq: ListSequencesResponseItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const steps = (seq.stepsJson ?? []) as SequenceStep[];
  const trigger = seq.trigger as SequenceTrigger;

  const triggerLabel = () => {
    if (trigger.type === "status") return `Lead status = "${trigger.value}"`;
    if (trigger.type === "score") return `Lead score >= ${trigger.value}`;
    if (trigger.type === "source") return `Lead source = "${trigger.value}"`;
    return String(trigger.value);
  };

  return (
    <Card data-testid={`card-sequence-${seq.id}`} className="group hover:shadow-sm transition-shadow">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{seq.name}</p>
              <Badge variant={seq.active ? "default" : "secondary"} className="text-xs">
                {seq.active ? "Active" : "Paused"}
              </Badge>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {steps.length} step{steps.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Trigger: <span className="font-medium text-foreground">{triggerLabel()}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost" size="sm"
              className="h-7 px-2 opacity-0 group-hover:opacity-100 text-xs"
              data-testid={`button-toggle-sequence-${seq.id}`}
              onClick={() => onToggleActive(seq)}
              title={seq.active ? "Pause sequence" : "Activate sequence"}
            >
              {seq.active
                ? <PauseCircle className="h-3.5 w-3.5 text-muted-foreground" />
                : <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 px-2 opacity-0 group-hover:opacity-100 text-xs"
              data-testid={`button-edit-sequence-${seq.id}`}
              onClick={() => onEdit(seq)}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              data-testid={`button-delete-sequence-${seq.id}`}
              onClick={() => onDelete(seq.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
        {steps.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide steps" : "Show steps"}
            </button>
            {expanded && (
              <div className="mt-2 space-y-2 pl-2 border-l-2 border-border">
                {steps.map((step, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-foreground">Step {i + 1}</span>
                      <span className="text-muted-foreground">
                        {step.delayDays === 0 ? "Immediately" : `After ${step.delayDays} day${step.delayDays !== 1 ? "s" : ""}`}
                      </span>
                    </div>
                    <p className="font-medium">{step.subject}</p>
                    <p className="text-muted-foreground line-clamp-2">{step.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SequenceDialog({
  open,
  onOpenChange,
  editSeq,
  aiDisabled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editSeq: ListSequencesResponseItem | null;
  aiDisabled: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateSequence();
  const updateMutation = useUpdateSequence();
  const generateMutation = useGenerateSequence();

  const isEdit = !!editSeq;

  const [name, setName] = useState(editSeq?.name ?? "");
  const [triggerType, setTriggerType] = useState<"status" | "score" | "source">((editSeq?.trigger as SequenceTrigger | undefined)?.type ?? "status");
  const [triggerValue, setTriggerValue] = useState(String((editSeq?.trigger as SequenceTrigger | undefined)?.value ?? "new"));
  const [active, setActive] = useState(editSeq?.active ?? true);
  const [steps, setSteps] = useState<SequenceStep[]>((editSeq?.stepsJson as SequenceStep[] | undefined) ?? []);

  const [aiGoal, setAiGoal] = useState("");
  const [aiAudience, setAiAudience] = useState("");
  const [aiOpen, setAiOpen] = useState(false);

  const reset = (seq?: ListSequencesResponseItem | null) => {
    setName(seq?.name ?? "");
    setTriggerType((seq?.trigger as SequenceTrigger | undefined)?.type ?? "status");
    setTriggerValue(String((seq?.trigger as SequenceTrigger | undefined)?.value ?? "new"));
    setActive(seq?.active ?? true);
    setSteps((seq?.stepsJson as SequenceStep[] | undefined) ?? []);
    setAiGoal("");
    setAiAudience("");
    setAiOpen(false);
  };

  useEffect(() => {
    if (open) {
      reset(editSeq);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editSeq?.id]);

  const handleOpen = (v: boolean) => {
    if (!v) reset(null);
    onOpenChange(v);
  };

  const addStep = () => setSteps(s => [...s, { subject: "", body: "", delayDays: s.length === 0 ? 0 : 3 }]);
  const removeStep = (i: number) => setSteps(s => s.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: keyof SequenceStep, value: string | number) => {
    setSteps(s => s.map((step, idx) => idx === i ? { ...step, [field]: value } : step));
  };

  const handleAiGenerate = () => {
    if (!aiGoal.trim() || !aiAudience.trim()) return;
    generateMutation.mutate(
      { data: { goal: aiGoal.trim(), audience: aiAudience.trim(), stepCount: 4 } },
      {
        onSuccess: (r) => {
          setName(r.name);
          setSteps(r.steps as SequenceStep[]);
          setAiOpen(false);
          toast({ title: "Sequence generated", description: `${r.steps.length} steps created` });
        },
        onError: () => toast({ title: "AI generation failed", variant: "destructive" }),
      }
    );
  };

  const handleSave = () => {
    if (!name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (!triggerValue.trim()) { toast({ title: "Trigger value is required", variant: "destructive" }); return; }
    const trigger: SequenceTrigger = {
      type: triggerType,
      value: triggerType === "score" ? Number(triggerValue) : triggerValue,
    };
    const payload = { name: name.trim(), trigger, stepsJson: steps, active };

    if (isEdit && editSeq) {
      updateMutation.mutate(
        { id: editSeq.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSequencesQueryKey() });
            toast({ title: "Sequence updated" });
            handleOpen(false);
          },
          onError: () => toast({ title: "Failed to update sequence", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { data: payload as CreateSequenceBody },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSequencesQueryKey() });
            toast({ title: "Sequence created" });
            handleOpen(false);
          },
          onError: () => toast({ title: "Failed to create sequence", variant: "destructive" }),
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Sequence" : "Create Sequence"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              data-testid="input-sequence-name"
              className="mt-1"
              placeholder="Qualified Lead Nurture"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Trigger type</label>
              <Select value={triggerType} onValueChange={v => setTriggerType(v as "status" | "score" | "source")}>
                <SelectTrigger data-testid="select-trigger-type" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Lead status</SelectItem>
                  <SelectItem value="score">Lead score</SelectItem>
                  <SelectItem value="source">Lead source</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">
                {triggerType === "status" ? "Status value" : triggerType === "score" ? "Min score" : "Source value"}
              </label>
              {triggerType === "status" ? (
                <Select value={triggerValue} onValueChange={setTriggerValue}>
                  <SelectTrigger data-testid="select-trigger-value" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["new", "contacted", "qualified", "converted", "lost"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : triggerType === "source" ? (
                <Select value={triggerValue} onValueChange={setTriggerValue}>
                  <SelectTrigger data-testid="select-trigger-value" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["organic", "paid", "social", "direct", "referral"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  data-testid="input-trigger-value"
                  type="number"
                  className="mt-1"
                  placeholder="70"
                  value={triggerValue}
                  onChange={e => setTriggerValue(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Email Steps</label>
            <div className="flex gap-2">
              {!aiDisabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="button-ai-generate-sequence"
                  onClick={() => setAiOpen(v => !v)}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  AI Generate
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" data-testid="button-add-step" onClick={addStep}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Step
              </Button>
            </div>
          </div>

          {aiOpen && (
            <div className="p-3 border rounded-md space-y-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">AI will generate email steps based on your goal and audience.</p>
              <div>
                <label className="text-xs font-medium">Goal</label>
                <Input
                  data-testid="input-ai-sequence-goal"
                  className="mt-1"
                  placeholder="Convert qualified leads into paying customers"
                  value={aiGoal}
                  onChange={e => setAiGoal(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Target audience</label>
                <Input
                  data-testid="input-ai-sequence-audience"
                  className="mt-1"
                  placeholder="Small business owners interested in SEO tools"
                  value={aiAudience}
                  onChange={e => setAiAudience(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full"
                data-testid="button-ai-generate-steps"
                onClick={handleAiGenerate}
                disabled={generateMutation.isPending || !aiGoal.trim() || !aiAudience.trim()}
              >
                {generateMutation.isPending ? "Generating..." : "Generate Steps"}
              </Button>
            </div>
          )}

          {steps.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-md">
              No steps yet. Add a step or use AI Generate.
            </p>
          ) : (
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="p-3 border rounded-md space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">STEP {i + 1}</span>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Delay (days)</label>
                      <Input
                        data-testid={`input-step-${i}-delay`}
                        type="number"
                        min={0}
                        className="w-16 h-6 text-xs"
                        value={step.delayDays}
                        onChange={e => updateStep(i, "delayDays", parseInt(e.target.value) || 0)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeStep(i)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Subject</label>
                    <Input
                      data-testid={`input-step-${i}-subject`}
                      className="mt-1"
                      placeholder="Email subject line"
                      value={step.subject}
                      onChange={e => updateStep(i, "subject", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Body</label>
                    <Textarea
                      data-testid={`input-step-${i}-body`}
                      className="mt-1"
                      placeholder="Email body..."
                      value={step.body}
                      rows={4}
                      onChange={e => updateStep(i, "body", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="seq-active"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="h-4 w-4"
              data-testid="checkbox-sequence-active"
            />
            <label htmlFor="seq-active" className="text-sm">Active (enroll matching leads automatically)</label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
            <Button data-testid="button-save-sequence" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Sequence"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SequencesTab({ aiDisabled }: { aiDisabled: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sequences, isLoading } = useListSequences();
  const deleteMutation = useDeleteSequence();
  const updateMutation = useUpdateSequence();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSeq, setEditSeq] = useState<ListSequencesResponseItem | null>(null);

  const handleEdit = (seq: ListSequencesResponseItem) => {
    setEditSeq(seq);
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this sequence?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSequencesQueryKey() }),
      onError: () => toast({ title: "Failed to delete sequence", variant: "destructive" }),
    });
  };

  const handleToggleActive = (seq: ListSequencesResponseItem) => {
    updateMutation.mutate(
      { id: seq.id, data: { active: !seq.active } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSequencesQueryKey() });
          toast({ title: seq.active ? "Sequence paused" : "Sequence activated" });
        },
        onError: () => toast({ title: "Failed to update sequence", variant: "destructive" }),
      }
    );
  };

  const handleNewOpen = () => {
    setEditSeq(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Automated email drip campaigns triggered by lead conditions</p>
        <Button size="sm" data-testid="button-new-sequence" onClick={handleNewOpen}>
          <Plus className="h-4 w-4 mr-1" /> New Sequence
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (sequences ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <List className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No sequences yet</p>
          <p className="text-xs mt-1">Create a sequence to automatically nurture leads over time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(sequences ?? []).map(seq => (
            <SequenceCard
              key={seq.id}
              seq={seq}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}

      <SequenceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editSeq={editSeq}
        aiDisabled={aiDisabled}
      />
    </div>
  );
}

export default function Campaigns() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "sequences">("campaigns");
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
  const [composePreview, setComposePreview] = useState(false);

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
    { query: { enabled: !!composeCampaignId && composeOpen && composeStatuses.length > 0, queryKey: getGetCampaignRecipientsQueryKey(composeCampaignId ?? 0, recipientParams) } }
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
        {activeTab === "campaigns" && (
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
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-border">
        <button
          type="button"
          data-testid="tab-campaigns"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === "campaigns"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("campaigns")}
        >
          Campaigns
        </button>
        <button
          type="button"
          data-testid="tab-sequences"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === "sequences"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("sequences")}
        >
          Sequences
        </button>
      </div>

      {activeTab === "sequences" ? (
        <SequencesTab aiDisabled={aiDisabled} />
      ) : (
        <>
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
                            title="Compose & send email to leads"
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
        </>
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

          {!emailConfigured ? (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 p-4 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Email provider not configured</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">Connect an email service (SendGrid, Resend, Mailgun, SMTP, or Mailchimp Mandrill) before sending campaigns.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
                <Link href="/settings" onClick={() => setComposeOpen(false)}>
                  <Button data-testid="button-go-to-email-settings">
                    <Settings className="h-4 w-4 mr-1" /> Go to Settings
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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

              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input
                  data-testid="input-compose-subject"
                  className="mt-1"
                  placeholder="Email subject line"
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">Body</label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
                    onClick={() => setComposePreview(v => !v)}
                  >
                    {composePreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {composePreview ? "Edit" : "Preview"}
                  </button>
                </div>
                {composePreview ? (
                  <div
                    className="min-h-[200px] p-3 border rounded-md bg-muted/20 text-sm overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(composeBody) }}
                  />
                ) : (
                  <Textarea
                    data-testid="input-compose-body"
                    placeholder="Email body (supports Markdown)..."
                    value={composeBody}
                    onChange={e => setComposeBody(e.target.value)}
                    rows={8}
                  />
                )}
                <p className="text-xs text-muted-foreground">Supports basic Markdown. Click Preview to see how it renders.</p>
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
