import { useState } from "react";
import { Settings, Key, CheckCircle, AlertCircle, Save, Brain, RefreshCw, ToggleLeft, ToggleRight, ChevronDown, Gauge, RotateCcw, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings, useUpdateSettings, useTestAiConnection, useGetAdminUsage, getGetAdminUsageQueryKey, useUpdateUsageLimits, useResetUserUsage, useGetEmailProviderSettings, useUpdateEmailProviderSettings, useTestEmailConnection } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type EmailProvider = "smtp" | "sendgrid" | "mailgun" | "resend" | "mailchimp";

const EMAIL_PROVIDERS: { value: EmailProvider; label: string; usesApiKey: boolean; description: string }[] = [
  { value: "smtp", label: "SMTP (Generic)", usesApiKey: false, description: "Any SMTP server — Gmail, Outlook, custom." },
  { value: "sendgrid", label: "SendGrid", usesApiKey: true, description: "Twilio SendGrid API." },
  { value: "mailgun", label: "Mailgun", usesApiKey: true, description: "Mailgun sending API." },
  { value: "resend", label: "Resend", usesApiKey: true, description: "Resend.com — modern email API." },
  { value: "mailchimp", label: "Mailchimp (Mandrill)", usesApiKey: true, description: "Mandrill transactional API — requires a paid Mailchimp plan. For audience list-based sends, use Mailchimp's native campaign tools instead." },
];

type AiProvider = "replit" | "openai" | "anthropic" | "perplexity" | "gemini";

const FAL_IMAGE_MODELS: Array<{ value: string; label: string }> = [
  { value: "fal-ai/flux/schnell", label: "FLUX Schnell (Fast)" },
  { value: "fal-ai/flux/dev", label: "FLUX Dev (Balanced)" },
  { value: "fal-ai/flux-pro", label: "FLUX Pro (Best quality)" },
  { value: "fal-ai/flux-realism", label: "FLUX Realism (Photorealistic)" },
  { value: "fal-ai/stable-diffusion-v35-large", label: "Stable Diffusion 3.5 Large" },
];

const FAL_VIDEO_MODELS: Array<{ value: string; label: string }> = [
  { value: "fal-ai/kling-video/v2.1/standard/text-to-video", label: "Kling v2.1 Standard" },
  { value: "fal-ai/kling-video/v2.1/pro/text-to-video", label: "Kling v2.1 Pro" },
  { value: "fal-ai/kling-video/v1.6/standard/text-to-video", label: "Kling v1.6 Standard" },
  { value: "fal-ai/minimax/video-01", label: "MiniMax Video-01" },
  { value: "fal-ai/runway-gen4/turbo/text-to-video", label: "Runway Gen4" },
];

const PROVIDERS: { value: AiProvider; label: string; requiresKey: boolean; description: string }[] = [
  { value: "replit", label: "Replit Default (Free)", requiresKey: false, description: "Built-in AI proxy — no API key required." },
  { value: "openai", label: "OpenAI (ChatGPT)", requiresKey: true, description: "GPT-4, GPT-4o, and newer OpenAI models." },
  { value: "anthropic", label: "Anthropic (Claude)", requiresKey: true, description: "Claude 3.5 Sonnet and other Anthropic models." },
  { value: "perplexity", label: "Perplexity AI", requiresKey: true, description: "Sonar models with real-time web search." },
  { value: "gemini", label: "Google Gemini", requiresKey: true, description: "Gemini 1.5 Pro, Flash, and 2.0 models." },
];

const PROVIDER_MODELS: Record<AiProvider, string[]> = {
  replit: ["gpt-4.1", "gpt-4.1-mini"],
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o4-mini"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-opus-4-5", "claude-3-haiku-20240307"],
  perplexity: ["llama-3.1-sonar-large-128k-online", "llama-3.1-sonar-small-128k-online", "llama-3.1-sonar-huge-128k-online"],
  gemini: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
};

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Fal.ai state
  const [falApiKey, setFalApiKey] = useState("");
  const [showFalKey, setShowFalKey] = useState(false);
  const [selectedImageModel, setSelectedImageModel] = useState<string | null>(null);
  const [selectedVideoModel, setSelectedVideoModel] = useState<string | null>(null);

  // AI provider state
  const [selectedProvider, setSelectedProvider] = useState<AiProvider | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [aiApiKey, setAiApiKey] = useState("");
  const [showAiKey, setShowAiKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Usage limit editing state
  const [limitEdits, setLimitEdits] = useState<{ text?: string; image?: string; video?: string }>({});

  // Email provider state
  const [emailProvider, setEmailProvider] = useState<EmailProvider | null>(null);
  const [emailFromAddress, setEmailFromAddress] = useState("");
  const [emailFromName, setEmailFromName] = useState("");
  const [emailApiKey, setEmailApiKey] = useState("");
  const [emailAudienceId, setEmailAudienceId] = useState("");
  const [emailMailchimpSendMode, setEmailMailchimpSendMode] = useState<"direct" | "sync_and_send" | "sync_only">("direct");
  const [emailSmtpHost, setEmailSmtpHost] = useState("");
  const [emailSmtpPort, setEmailSmtpPort] = useState("587");
  const [emailSmtpUser, setEmailSmtpUser] = useState("");
  const [emailSmtpPass, setEmailSmtpPass] = useState("");
  const [testEmailTo, setTestEmailTo] = useState("");
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [emailDirty, setEmailDirty] = useState(false);

  const { data: settings, isLoading, refetch } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const testMutation = useTestAiConnection();
  const { data: adminUsage, refetch: refetchAdminUsage } = useGetAdminUsage({ query: { enabled: isAdmin, queryKey: getGetAdminUsageQueryKey() } });
  const updateLimitsMutation = useUpdateUsageLimits();
  const resetUsageMutation = useResetUserUsage();
  const { data: emailSettings, refetch: refetchEmailSettings } = useGetEmailProviderSettings();
  const updateEmailMutation = useUpdateEmailProviderSettings();
  const testEmailMutation = useTestEmailConnection();

  const activeEmailProvider = (emailProvider ?? emailSettings?.provider ?? null) as EmailProvider | null;
  const activeProviderInfo = EMAIL_PROVIDERS.find(p => p.value === activeEmailProvider);

  const isFalConfigured = settings?.falApiKeyConfigured === true;
  const currentImageModel = selectedImageModel ?? settings?.falImageModel ?? FAL_IMAGE_MODELS[0].value;
  const currentVideoModel = selectedVideoModel ?? settings?.falVideoModel ?? FAL_VIDEO_MODELS[0].value;

  const currentProvider = (selectedProvider ?? settings?.aiProvider ?? "replit") as AiProvider;
  const currentModel = selectedModel ?? settings?.aiModel ?? PROVIDER_MODELS[currentProvider]?.[0] ?? "";
  const currentEnabled = settings?.aiEnabled ?? true;
  const isAiKeyConfigured = settings?.aiApiKeyConfigured === true;
  const providerInfo = PROVIDERS.find(p => p.value === currentProvider);
  const availableModels = PROVIDER_MODELS[currentProvider] ?? [];

  const handleSaveFal = () => {
    if (!falApiKey.trim()) return;
    updateMutation.mutate(
      { data: { falApiKey: falApiKey.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Fal.ai API key saved" });
          setFalApiKey("");
          refetch();
        },
        onError: () => toast({ title: "Failed to save API key", variant: "destructive" }),
      }
    );
  };

  const handleImageModelChange = (model: string) => {
    setSelectedImageModel(model);
    updateMutation.mutate(
      { data: { falImageModel: model } },
      {
        onSuccess: () => { toast({ title: "Image model updated" }); refetch(); },
        onError: () => toast({ title: "Failed to update image model", variant: "destructive" }),
      }
    );
  };

  const handleVideoModelChange = (model: string) => {
    setSelectedVideoModel(model);
    updateMutation.mutate(
      { data: { falVideoModel: model } },
      {
        onSuccess: () => { toast({ title: "Video model updated" }); refetch(); },
        onError: () => toast({ title: "Failed to update video model", variant: "destructive" }),
      }
    );
  };

  const handleRemoveFal = () => {
    updateMutation.mutate(
      { data: { falApiKey: null } },
      {
        onSuccess: () => { toast({ title: "Fal.ai API key removed" }); refetch(); },
        onError: () => toast({ title: "Failed to remove API key", variant: "destructive" }),
      }
    );
  };

  const handleToggleAi = () => {
    updateMutation.mutate(
      { data: { aiEnabled: !currentEnabled } },
      {
        onSuccess: () => {
          toast({ title: currentEnabled ? "AI features disabled" : "AI features enabled" });
          refetch();
        },
        onError: () => toast({ title: "Failed to update AI status", variant: "destructive" }),
      }
    );
  };

  const handleSaveAiConfig = () => {
    const body: Record<string, unknown> = {
      aiProvider: currentProvider,
      aiModel: currentModel,
    };
    if (aiApiKey.trim()) {
      body.aiApiKey = aiApiKey.trim();
    }
    updateMutation.mutate(
      { data: body as Parameters<typeof updateMutation.mutate>[0]["data"] },
      {
        onSuccess: () => {
          toast({ title: "AI configuration saved" });
          setAiApiKey("");
          setSelectedProvider(null);
          setSelectedModel(null);
          refetch();
        },
        onError: () => toast({ title: "Failed to save AI configuration", variant: "destructive" }),
      }
    );
  };

  const handleRemoveAiKey = () => {
    updateMutation.mutate(
      { data: { aiApiKey: null } as Parameters<typeof updateMutation.mutate>[0]["data"] },
      {
        onSuccess: () => { toast({ title: "AI API key removed" }); refetch(); },
        onError: () => toast({ title: "Failed to remove key", variant: "destructive" }),
      }
    );
  };

  const handleTestAi = () => {
    setTestResult(null);
    testMutation.mutate(undefined, {
      onSuccess: (data) => {
        setTestResult({ success: data.success, message: data.message });
      },
      onError: () => setTestResult({ success: false, message: "Request failed. Check server logs." }),
    });
  };

  const hasUnsavedChanges = selectedProvider !== null || selectedModel !== null || aiApiKey.trim() !== "";

  const handleSaveLimits = () => {
    const body: { text?: number; image?: number; video?: number } = {};
    if (limitEdits.text !== undefined) body.text = parseInt(limitEdits.text, 10);
    if (limitEdits.image !== undefined) body.image = parseInt(limitEdits.image, 10);
    if (limitEdits.video !== undefined) body.video = parseInt(limitEdits.video, 10);
    if (Object.keys(body).length === 0) return;
    updateLimitsMutation.mutate(
      { data: body },
      {
        onSuccess: () => {
          toast({ title: "Usage limits updated" });
          setLimitEdits({});
          refetchAdminUsage();
        },
        onError: () => toast({ title: "Failed to update limits", variant: "destructive" }),
      }
    );
  };

  const handleResetUsage = (userId: number, type: string) => {
    resetUsageMutation.mutate(
      { data: { userId, type } },
      {
        onSuccess: () => {
          toast({ title: `${type} usage reset` });
          refetchAdminUsage();
        },
        onError: () => toast({ title: "Failed to reset usage", variant: "destructive" }),
      }
    );
  };

  const handleSaveEmailProvider = () => {
    const body: Record<string, unknown> = {};
    if (emailProvider) body.provider = emailProvider;
    const from = emailFromAddress.trim() || emailSettings?.fromAddress;
    if (from) body.fromAddress = from;
    if (emailFromName.trim()) body.fromName = emailFromName.trim();
    if (emailApiKey.trim()) body.apiKey = emailApiKey.trim();
    if (emailAudienceId.trim()) body.audienceId = emailAudienceId.trim();
    if (activeEmailProvider === "mailchimp") body.mailchimpSendMode = emailMailchimpSendMode;
    if (emailSmtpHost.trim()) body.smtpHost = emailSmtpHost.trim();
    if (emailSmtpPort.trim()) body.smtpPort = parseInt(emailSmtpPort.trim(), 10);
    if (emailSmtpUser.trim()) body.smtpUser = emailSmtpUser.trim();
    if (emailSmtpPass.trim()) body.smtpPass = emailSmtpPass.trim();
    if (Object.keys(body).length === 0) return;
    updateEmailMutation.mutate(
      { data: body as Parameters<typeof updateEmailMutation.mutate>[0]["data"] },
      {
        onSuccess: () => {
          toast({ title: "Email provider saved" });
          setEmailApiKey("");
          setEmailSmtpPass("");
          setEmailDirty(false);
          refetchEmailSettings();
        },
        onError: () => toast({ title: "Failed to save email provider", variant: "destructive" }),
      }
    );
  };

  const handleTestEmail = () => {
    setEmailTestResult(null);
    testEmailMutation.mutate(
      { data: { testTo: testEmailTo.trim() } },
      {
        onSuccess: (r) => setEmailTestResult({ success: r.success, message: r.message }),
        onError: () => setEmailTestResult({ success: false, message: "Request failed" }),
      }
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure integrations and API keys</p>
      </div>

      {/* AI Provider Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">AI Provider</CardTitle>
                {!isLoading && (
                  <Badge
                    variant={currentEnabled ? "default" : "secondary"}
                    className="text-xs"
                    data-testid="badge-ai-status"
                  >
                    {currentEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                )}
                {!isLoading && settings && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {PROVIDERS.find(p => p.value === settings.aiProvider)?.label ?? settings.aiProvider}
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1">
                Choose which AI service powers the SEO recommendations, keyword suggestions, and content generation.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable / Disable toggle */}
          <div className="flex items-center justify-between p-3 rounded-md border bg-muted/40">
            <div>
              <p className="text-sm font-medium">AI Features</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentEnabled ? "AI tools are active across the platform." : "AI tools are paused. Enable to restore them."}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              data-testid="button-toggle-ai"
              className="gap-2 text-sm"
              onClick={handleToggleAi}
              disabled={updateMutation.isPending || isLoading}
            >
              {currentEnabled
                ? <><ToggleRight className="h-5 w-5 text-primary" /> Enabled</>
                : <><ToggleLeft className="h-5 w-5 text-muted-foreground" /> Disabled</>
              }
            </Button>
          </div>

          {/* Provider selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <div className="grid gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  data-testid={`button-provider-${p.value}`}
                  onClick={() => {
                    setSelectedProvider(p.value);
                    setSelectedModel(PROVIDER_MODELS[p.value]?.[0] ?? "");
                    setTestResult(null);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${
                    currentProvider === p.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.label}</span>
                      {!p.requiresKey && (
                        <Badge variant="secondary" className="text-xs">Free</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  </div>
                  {currentProvider === p.value && (
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Model selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <div className="relative">
              <select
                data-testid="select-ai-model"
                value={currentModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* API Key input (hidden for replit) */}
          {providerInfo?.requiresKey && (
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              {isAiKeyConfigured && (
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted border text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-muted-foreground text-xs">A key is saved. Enter a new one to replace it.</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive hover:text-destructive text-xs"
                    onClick={handleRemoveAiKey}
                    disabled={updateMutation.isPending}
                    data-testid="button-remove-ai-key"
                  >
                    Remove
                  </Button>
                </div>
              )}
              <div className="relative">
                <Input
                  data-testid="input-ai-api-key"
                  type={showAiKey ? "text" : "password"}
                  placeholder={isAiKeyConfigured ? "Enter new key to replace current one" : "sk-... or your provider key"}
                  value={aiApiKey}
                  onChange={e => setAiApiKey(e.target.value)}
                  className="pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowAiKey(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showAiKey ? "hide" : "show"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your API key is stored as <code className="font-mono">AI_API_KEY</code> on the server and never sent to the browser.
                For persistence across restarts, add it to your environment secrets directly.
              </p>
            </div>
          )}

          {/* Save button + test connection */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              data-testid="button-save-ai-config"
              onClick={handleSaveAiConfig}
              disabled={!hasUnsavedChanges || updateMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              {updateMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
            <Button
              variant="outline"
              data-testid="button-test-ai"
              onClick={handleTestAi}
              disabled={testMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${testMutation.isPending ? "animate-spin" : ""}`} />
              {testMutation.isPending ? "Testing..." : "Test Connection"}
            </Button>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-md text-sm border ${
              testResult.success
                ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300"
                : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
            }`} data-testid="text-test-result">
              {testResult.success
                ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              }
              <span>{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fal.ai API Key */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Fal.ai API Key</CardTitle>
                {!isLoading && (
                  isFalConfigured ? (
                    <Badge variant="default" className="text-xs gap-1">
                      <CheckCircle className="h-3 w-3" /> Configured
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                      <AlertCircle className="h-3 w-3" /> Not configured
                    </Badge>
                  )
                )}
              </div>
              <CardDescription className="mt-1">
                Required for AI image and video generation. Get your key at{" "}
                <a
                  href="https://fal.ai/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  fal.ai/dashboard
                </a>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFalConfigured && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted border text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-muted-foreground">An API key is currently saved. Enter a new key below to replace it.</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={handleRemoveFal}
                disabled={updateMutation.isPending}
                data-testid="button-remove-fal-key"
              >
                Remove
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                data-testid="input-fal-api-key"
                type={showFalKey ? "text" : "password"}
                placeholder={isFalConfigured ? "Enter new key to replace current one" : "fal_xxxxxxxxxxxxxxxx"}
                value={falApiKey}
                onChange={e => setFalApiKey(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveFal()}
                className="pr-20"
              />
              <button
                type="button"
                onClick={() => setShowFalKey(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showFalKey ? "hide" : "show"}
              </button>
            </div>
            <Button
              data-testid="button-save-fal-key"
              onClick={handleSaveFal}
              disabled={!falApiKey.trim() || updateMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              {updateMutation.isPending ? "Saving..." : "Save Key"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Your API key is stored as <code className="font-mono">FAL_KEY</code> on the server and never sent to the browser.
            For persistence across restarts, add it to your environment secrets directly.
          </p>
        </CardContent>
      </Card>

      {/* Media generation model selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Media Generation Models</CardTitle>
              <CardDescription className="mt-1">Select which Fal.ai models are used for image and video generation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Image Generation Model</label>
              <div className="relative">
                <select
                  data-testid="select-fal-image-model"
                  value={currentImageModel}
                  onChange={e => handleImageModelChange(e.target.value)}
                  disabled={updateMutation.isPending}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  {FAL_IMAGE_MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground font-mono">{currentImageModel}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Video Generation Model</label>
              <div className="relative">
                <select
                  data-testid="select-fal-video-model"
                  value={currentVideoModel}
                  onChange={e => handleVideoModelChange(e.target.value)}
                  disabled={updateMutation.isPending}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  {FAL_VIDEO_MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground font-mono">{currentVideoModel}</p>
            </div>
        </CardContent>
      </Card>

      {/* Email Provider */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">Email Provider</CardTitle>
                {emailSettings?.provider ? (
                  <Badge variant="default" className="text-xs gap-1">
                    <CheckCircle className="h-3 w-3" /> {EMAIL_PROVIDERS.find(p => p.value === emailSettings.provider)?.label ?? emailSettings.provider}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Not configured</Badge>
                )}
              </div>
              <CardDescription className="mt-1">Connect an email service to send campaigns directly to your leads</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <div className="grid gap-2">
              {EMAIL_PROVIDERS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  data-testid={`button-email-provider-${p.value}`}
                  onClick={() => { setEmailProvider(p.value); setEmailDirty(true); setEmailTestResult(null); }}
                  className={`flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${
                    activeEmailProvider === p.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  </div>
                  {activeEmailProvider === p.value && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* From address */}
          {activeEmailProvider && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">From Address</label>
                <Input
                  data-testid="input-email-from-address"
                  type="email"
                  placeholder={emailSettings?.fromAddress || "hello@yourdomain.com"}
                  value={emailFromAddress}
                  onChange={e => { setEmailFromAddress(e.target.value); setEmailDirty(true); }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">From Name (optional)</label>
                <Input
                  data-testid="input-email-from-name"
                  placeholder={emailSettings?.fromName || "Your Company"}
                  value={emailFromName}
                  onChange={e => { setEmailFromName(e.target.value); setEmailDirty(true); }}
                />
              </div>
            </div>
          )}

          {/* API key fields for non-SMTP */}
          {activeEmailProvider && activeProviderInfo?.usesApiKey && (
            <div className="space-y-1">
              <label className="text-sm font-medium">API Key</label>
              {emailSettings?.apiKeyConfigured && !emailApiKey && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-md bg-muted border mb-1">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  A key is saved. Enter a new one to replace it.
                </div>
              )}
              <Input
                data-testid="input-email-api-key"
                type="password"
                placeholder={emailSettings?.apiKeyConfigured ? "Enter new key to replace" : "Paste your API key"}
                value={emailApiKey}
                onChange={e => { setEmailApiKey(e.target.value); setEmailDirty(true); }}
              />
            </div>
          )}

          {/* Mailchimp Audience List ID + Send Mode */}
          {activeEmailProvider === "mailchimp" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Audience List ID <span className="font-normal text-muted-foreground">(optional)</span></label>
                <Input
                  data-testid="input-email-mailchimp-audience-id"
                  placeholder={emailSettings?.audienceId || "e.g. abc123def"}
                  value={emailAudienceId}
                  onChange={e => { setEmailAudienceId(e.target.value); setEmailDirty(true); }}
                />
                <p className="text-xs text-muted-foreground">
                  Find your List ID in Mailchimp under Audience &rarr; Settings &rarr; Audience name and defaults.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Send Mode</label>
                <div className="flex flex-col gap-1.5" data-testid="mailchimp-send-mode">
                  {[
                    { value: "direct", label: "Send via Mandrill only", desc: "No audience sync — emails are sent directly through Mandrill." },
                    { value: "sync_and_send", label: "Sync to list and send", desc: "Leads are added to the Mailchimp audience, then emailed via Mandrill." },
                    { value: "sync_only", label: "Sync to list only", desc: "Leads are added to the Mailchimp audience only — no email is sent." },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted/40 transition-colors">
                      <input
                        type="radio"
                        name="mailchimp-send-mode"
                        value={opt.value}
                        checked={(emailMailchimpSendMode || emailSettings?.mailchimpSendMode || "direct") === opt.value}
                        onChange={() => { setEmailMailchimpSendMode(opt.value as "direct" | "sync_and_send" | "sync_only"); setEmailDirty(true); }}
                        className="mt-0.5 shrink-0"
                      />
                      <div>
                        <span className="text-sm font-medium">{opt.label}</span>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {(emailMailchimpSendMode === "sync_only" || (!emailMailchimpSendMode && emailSettings?.mailchimpSendMode === "sync_only")) && !emailAudienceId && !emailSettings?.audienceId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">An Audience List ID is required for Sync to list only mode.</p>
                )}
              </div>
            </div>
          )}

          {/* SMTP fields */}
          {activeEmailProvider === "smtp" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">SMTP Host</label>
                  <Input
                    data-testid="input-email-smtp-host"
                    placeholder={emailSettings?.smtpHost || "smtp.gmail.com"}
                    value={emailSmtpHost}
                    onChange={e => { setEmailSmtpHost(e.target.value); setEmailDirty(true); }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Port</label>
                  <Input
                    data-testid="input-email-smtp-port"
                    type="number"
                    placeholder={String(emailSettings?.smtpPort ?? 587)}
                    value={emailSmtpPort}
                    onChange={e => { setEmailSmtpPort(e.target.value); setEmailDirty(true); }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Username</label>
                  <Input
                    data-testid="input-email-smtp-user"
                    placeholder={emailSettings?.smtpUser || "your@email.com"}
                    value={emailSmtpUser}
                    onChange={e => { setEmailSmtpUser(e.target.value); setEmailDirty(true); }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Password / App Password</label>
                  {emailSettings?.smtpPassConfigured && !emailSmtpPass && (
                    <p className="text-xs text-muted-foreground">Password is saved.</p>
                  )}
                  <Input
                    data-testid="input-email-smtp-pass"
                    type="password"
                    placeholder={emailSettings?.smtpPassConfigured ? "Enter new password to replace" : "SMTP password"}
                    value={emailSmtpPass}
                    onChange={e => { setEmailSmtpPass(e.target.value); setEmailDirty(true); }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          {activeEmailProvider && (
            <Button
              data-testid="button-save-email-provider"
              onClick={handleSaveEmailProvider}
              disabled={!emailDirty || updateEmailMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              {updateEmailMutation.isPending ? "Saving..." : "Save Email Provider"}
            </Button>
          )}

          {/* Test email */}
          {emailSettings?.provider && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium">Test Connection</p>
              <div className="flex gap-2">
                <Input
                  data-testid="input-test-email-to"
                  type="email"
                  placeholder="your@email.com"
                  value={testEmailTo}
                  onChange={e => setTestEmailTo(e.target.value)}
                  className="flex-1"
                />
                <Button
                  data-testid="button-test-email"
                  variant="outline"
                  onClick={handleTestEmail}
                  disabled={!testEmailTo.trim() || testEmailMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${testEmailMutation.isPending ? "animate-spin" : ""}`} />
                  {testEmailMutation.isPending ? "Sending..." : "Send Test"}
                </Button>
              </div>
              {emailTestResult && (
                <div className={`flex items-start gap-2 p-3 rounded-md text-sm border ${emailTestResult.success ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300" : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300"}`} data-testid="text-email-test-result">
                  {emailTestResult.success ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                  <span>{emailTestResult.message}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin: AI Usage Overview */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Gauge className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">AI Usage Limits &amp; Overview</CardTitle>
                <CardDescription className="mt-1">Monthly per-user quotas for AI text, image, and video generation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Limit editors */}
            {adminUsage && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Monthly limits (applies to all users)</p>
                <div className="grid grid-cols-3 gap-3">
                  {(["text", "image", "video"] as const).map(type => (
                    <div key={type} className="space-y-1">
                      <label className="text-xs text-muted-foreground capitalize">{type}</label>
                      <Input
                        data-testid={`input-limit-${type}`}
                        type="number"
                        min={0}
                        value={limitEdits[type] ?? String(adminUsage.limits[type])}
                        onChange={e => setLimitEdits(prev => ({ ...prev, [type]: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <Button
                  data-testid="button-save-limits"
                  size="sm"
                  onClick={handleSaveLimits}
                  disabled={updateLimitsMutation.isPending || Object.keys(limitEdits).length === 0}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {updateLimitsMutation.isPending ? "Saving..." : "Save Limits"}
                </Button>
              </div>
            )}

            {/* Per-user usage table */}
            {adminUsage?.users && adminUsage.users.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">This month&apos;s usage by user</p>
                <div className="space-y-3">
                  {adminUsage.users.map(userRow => (
                    <div key={userRow.userId} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{userRow.username}</span>
                        <Badge variant="outline" className="text-xs">{userRow.role}</Badge>
                      </div>
                      <div className="space-y-1.5">
                        {userRow.usage.map(entry => {
                          const pct = entry.limit > 0 ? Math.min(100, Math.round((entry.used / entry.limit) * 100)) : 0;
                          const isNear = pct >= 80;
                          const isExhausted = pct >= 100;
                          return (
                            <div key={entry.type} className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground capitalize w-12 shrink-0">{entry.type}</span>
                                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      isExhausted ? "bg-destructive" : isNear ? "bg-amber-400" : "bg-primary/60"
                                    )}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className={cn("text-xs w-16 text-right tabular-nums shrink-0", isExhausted ? "text-destructive font-semibold" : isNear ? "text-amber-600" : "text-muted-foreground")}>
                                  {entry.used}/{entry.limit}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                                  title={`Reset ${entry.type} usage for ${userRow.username}`}
                                  data-testid={`button-reset-${userRow.userId}-${entry.type}`}
                                  onClick={() => handleResetUsage(userRow.userId, entry.type)}
                                  disabled={resetUsageMutation.isPending || entry.used === 0}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!adminUsage && (
              <p className="text-sm text-muted-foreground">Loading usage data...</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
