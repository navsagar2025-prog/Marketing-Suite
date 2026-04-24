import { useState } from "react";
import { Settings, Key, CheckCircle, AlertCircle, Save, Brain, RefreshCw, ToggleLeft, ToggleRight, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings, useUpdateSettings, useTestAiConnection } from "@workspace/api-client-react";

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

  const { data: settings, isLoading, refetch } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const testMutation = useTestAiConnection();

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
    </div>
  );
}
