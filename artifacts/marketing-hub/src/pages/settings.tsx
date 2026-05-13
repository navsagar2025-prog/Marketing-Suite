import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Settings, Key, CheckCircle, AlertCircle, Save, Brain, RefreshCw, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Gauge, RotateCcw, Mail, Target, CreditCard, Activity, XCircle, ShieldCheck, ShieldOff, Lock, Zap, ArrowUpRight, Search, Bell, Tag, Webhook, Send, Copy, Check, ExternalLink, BarChart3, Link2, MessageCircle, Camera, Twitter, Briefcase, Youtube, CheckCircle2, Loader2 } from "lucide-react";
import { ByokCard } from "@/components/ByokCard";
import { SessionsCard } from "@/components/SessionsCard";
import { CouponManagementCard } from "@/components/CouponManagementCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings, useUpdateSettings, useTestAiConnection, useGetAdminUsage, getGetAdminUsageQueryKey, useUpdateUsageLimits, useResetUserUsage, useGetEmailProviderSettings, useUpdateEmailProviderSettings, useTestEmailConnection, useGetLeadScoringConfig, useUpdateLeadScoringConfig, useRecalculateLeadScores, getGetLeadScoringConfigQueryKey, useGetPaymentSettings, useUpdatePaymentSettings, useTestPaymentConnection, getGetPaymentSettingsQueryKey, useGetWebhookEvents, getGetWebhookEventsQueryKey, useGetBillingMe, getGetBillingMeQueryKey, useListWebsites, useGetGoogleIntegrationStatus, useDisconnectGoogleIntegration, getGetGoogleIntegrationStatusQueryKey, useSetGa4Property } from "@workspace/api-client-react";
import type { Website } from "@workspace/api-client-react";
import { useAuth, usePermissions } from "@/contexts/AuthContext";
import { ALL_MODULES, MODULE_LABELS } from "@workspace/api-zod";
import { cn } from "@/lib/utils";

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  growth: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700",
  agency: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-700",
};

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const isNear = !unlimited && pct >= 80;
  const isExhausted = !unlimited && pct >= 100;
  const fmt = (n: number) => n.toLocaleString("en-IN");
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={cn("tabular-nums", isExhausted ? "text-destructive font-semibold" : isNear ? "text-amber-600" : "text-muted-foreground")}>
          {unlimited ? `${fmt(used)} / ∞` : `${fmt(used)} / ${fmt(limit)}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", isExhausted ? "bg-destructive" : isNear ? "bg-amber-400" : "bg-primary/70")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

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

const GSC_TOKEN_KEY = "auth_token";

async function fetchGoogleAuthUrl(websiteId: number): Promise<string | null> {
  const token = localStorage.getItem(GSC_TOKEN_KEY);
  if (!token) return null;
  const res = await fetch(`/api/integrations/google/auth?websiteId=${websiteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.authUrl ?? null;
}

const TOKEN_KEY = "auth_token";
function authHeader() { return { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}` }; }

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function NotificationSettingsCard() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/settings/notifications`, { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<{ rankAlertsEnabled: boolean; rankAlertsEmailTo: string }>;
    },
  });

  useEffect(() => {
    if (data) { setEnabled(data.rankAlertsEnabled); setEmailTo(data.rankAlertsEmailTo); }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE_URL}/api/settings/notifications`, {
        method: "PATCH",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ rankAlertsEnabled: enabled, rankAlertsEmailTo: emailTo }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => { toast({ title: "Notification settings saved" }); setDirty(false); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-muted"><Bell className="h-4 w-4" /></div>
          <div>
            <CardTitle className="text-base">Rank Change Notifications</CardTitle>
            <CardDescription className="mt-0.5">Get a daily email digest when keyword rankings change significantly (±5 positions).</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="h-10 rounded-md bg-muted animate-pulse" />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Daily rank alert emails</p>
                <p className="text-xs text-muted-foreground">Sent at 02:00 UTC after the daily rank snapshot</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Enable daily rank alert emails"
                data-testid="rank-alerts-toggle"
                onClick={() => { setEnabled(v => !v); setDirty(true); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {enabled ? <ToggleRight className="h-8 w-8 text-primary" /> : <ToggleLeft className="h-8 w-8" />}
              </button>
            </div>

            {enabled && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Send alerts to</label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={emailTo}
                  onChange={e => { setEmailTo(e.target.value); setDirty(true); }}
                />
                <p className="text-xs text-muted-foreground">The email address that receives the daily rank change digest.</p>
              </div>
            )}

            {dirty && (
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WebhooksCard() {
  const { toast } = useToast();
  const [slackUrl, setSlackUrl] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [dirty, setDirty] = useState(false);
  const [testing, setTesting] = useState<"slack" | "discord" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["webhook-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/settings/webhooks`, { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<{ slackWebhookUrl: string; discordWebhookUrl: string }>;
    },
  });

  useEffect(() => {
    if (data) { setSlackUrl(data.slackWebhookUrl); setDiscordUrl(data.discordWebhookUrl); }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE_URL}/api/settings/webhooks`, {
        method: "PATCH",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ slackWebhookUrl: slackUrl, discordWebhookUrl: discordUrl }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => { toast({ title: "Webhook settings saved" }); setDirty(false); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const sendTest = async (kind: "slack" | "discord", url: string) => {
    if (!url) {
      toast({ title: "Enter a URL first", variant: "destructive" });
      return;
    }
    setTesting(kind);
    try {
      const res = await fetch(`${BASE_URL}/api/settings/webhooks/test`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ kind, url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Webhook test failed");
      }
      toast({ title: `${kind === "slack" ? "Slack" : "Discord"} test sent — check your channel!` });
    } catch (err) {
      toast({ title: "Test failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-muted"><Webhook className="h-4 w-4" /></div>
          <div>
            <CardTitle className="text-base">Slack & Discord Webhooks</CardTitle>
            <CardDescription className="mt-0.5">Push rank changes and audit results to your team chat. Both channels get notified together.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="h-10 rounded-md bg-muted animate-pulse" />
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium">Slack Incoming Webhook URL</label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackUrl}
                  onChange={e => { setSlackUrl(e.target.value); setDirty(true); }}
                  data-testid="input-slack-webhook"
                />
                <Button size="sm" variant="outline" onClick={() => sendTest("slack", slackUrl)} disabled={testing === "slack"} data-testid="button-test-slack">
                  {testing === "slack" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Create one in your Slack workspace under Apps → Incoming Webhooks.</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Discord Webhook URL</label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordUrl}
                  onChange={e => { setDiscordUrl(e.target.value); setDirty(true); }}
                  data-testid="input-discord-webhook"
                />
                <Button size="sm" variant="outline" onClick={() => sendTest("discord", discordUrl)} disabled={testing === "discord"} data-testid="button-test-discord">
                  {testing === "discord" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Create one in your Discord channel under Edit Channel → Integrations → Webhooks.</p>
            </div>
            {dirty && (
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-webhooks">
                {saveMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleSetupGuide({ websites }: { websites: Website[] }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const firstWebsite = websites[0];
  const { data: status } = useGetGoogleIntegrationStatus(firstWebsite?.id ?? 0, {
    query: {
      queryKey: getGetGoogleIntegrationStatusQueryKey(firstWebsite?.id ?? 0),
      enabled: !!firstWebsite,
    },
  });

  if (!firstWebsite || status?.configured) return null;

  const redirectUri = status?.redirectUri ?? `${window.location.origin}/api/integrations/google/callback`;

  const handleCopy = () => {
    navigator.clipboard.writeText(redirectUri).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm font-medium">Google OAuth setup required</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-3 py-3 space-y-4 bg-muted/20">
          {/* Step 1 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</span>
              <p className="text-sm font-medium">Create a Google Cloud project and enable APIs</p>
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              If you don't already have a project, create one first:
            </p>
            <div className="ml-7">
              <a
                href="https://console.cloud.google.com/projectcreate"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                Create a new Google Cloud project
              </a>
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              Then enable both of these APIs inside your project:
            </p>
            <div className="ml-7 space-y-1">
              <a
                href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                Google Search Console API
              </a>
              <a
                href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                Google Analytics Data API
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</span>
              <p className="text-sm font-medium">Create OAuth 2.0 credentials</p>
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              Go to{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                APIs & Services → Credentials
              </a>
              {" "}and create an <strong>OAuth 2.0 Client ID</strong> (type: Web application).
              Add the following as an authorized redirect URI:
            </p>
            <div className="ml-7 flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-2.5 py-1.5 text-xs font-mono break-all">{redirectUri}</code>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 shrink-0"
                onClick={handleCopy}
                type="button"
                title="Copy redirect URI"
              >
                {copied
                  ? <Check className="h-3.5 w-3.5 text-green-500" />
                  : <Copy className="h-3.5 w-3.5" />
                }
              </Button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</span>
              <p className="text-sm font-medium">Add credentials as secrets</p>
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> from the OAuth client you created. Open the <strong>Secrets panel</strong> (the lock icon in the left sidebar of your Replit workspace) and add these two secrets:
            </p>
            <div className="ml-7 rounded bg-muted px-2.5 py-2 font-mono text-xs space-y-0.5">
              <div><span className="text-primary">GOOGLE_CLIENT_ID</span>=your-client-id.apps.googleusercontent.com</div>
              <div><span className="text-primary">GOOGLE_CLIENT_SECRET</span>=your-client-secret</div>
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              Optionally, if your production domain differs from your Replit dev domain, also set:
            </p>
            <div className="ml-7 rounded bg-muted px-2.5 py-2 font-mono text-xs">
              <span className="text-primary">GOOGLE_REDIRECT_URI</span>=https://your-production-domain/api/integrations/google/callback
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              After saving the secrets, restart the API server. The Connect Google button will appear for each website below. You can update these secrets at any time without affecting existing connections.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function GscWebsiteRow({ website }: { website: Website }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: status, isLoading } = useGetGoogleIntegrationStatus(website.id, {
    query: { queryKey: getGetGoogleIntegrationStatusQueryKey(website.id) },
  });
  const disconnectMutation = useDisconnectGoogleIntegration();
  const setPropertyMutation = useSetGa4Property();
  const [ga4Input, setGa4Input] = useState("");

  useEffect(() => {
    setGa4Input(status?.ga4PropertyId ?? "");
  }, [status?.ga4PropertyId]);

  const handleConnect = async () => {
    if (!status?.configured) {
      toast({ title: "Google OAuth not configured", description: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.", variant: "destructive" });
      return;
    }
    const authUrl = await fetchGoogleAuthUrl(website.id);
    if (!authUrl) {
      toast({ title: "Failed to initiate Google sign-in", description: "Please try again.", variant: "destructive" });
      return;
    }
    window.location.href = authUrl;
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate(
      { websiteId: website.id },
      {
        onSuccess: () => {
          toast({ title: "Google Search Console disconnected" });
          qc.invalidateQueries({ queryKey: getGetGoogleIntegrationStatusQueryKey(website.id) });
        },
        onError: () => toast({ title: "Failed to disconnect", variant: "destructive" }),
      }
    );
  };

  const handleSaveGa4 = () => {
    setPropertyMutation.mutate(
      { websiteId: website.id, data: { ga4PropertyId: ga4Input.trim() || null } },
      {
        onSuccess: () => {
          toast({ title: "GA4 property ID saved" });
          qc.invalidateQueries({ queryKey: getGetGoogleIntegrationStatusQueryKey(website.id) });
        },
        onError: () => toast({ title: "Failed to save GA4 property ID", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="border rounded-md px-3 py-2.5 space-y-2">
      {status?.connected && status.expired && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">Google access expired — data may be stale</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2 shrink-0 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            onClick={handleConnect}
          >
            Reconnect
          </Button>
        </div>
      )}
      {status?.connected && !status.expired && (status.missingScopesCount ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="text-xs text-blue-800 dark:text-blue-300 font-medium">New permissions available — reconnect to unlock new features</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2 shrink-0 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
            onClick={handleConnect}
          >
            Upgrade
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{website.url}</p>
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Checking status…</p>
          ) : status?.connected ? (
            <>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {status.expired ? (
                  <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                ) : (
                  <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                )}
                <span className={`text-xs font-medium ${status.expired ? "text-amber-600 dark:text-amber-400" : "text-green-600"}`}>
                  {status.expired ? "Access expired" : "Connected"}
                </span>
                {status.email && <span className="text-xs text-muted-foreground">· {status.email}</span>}
                {status.propertyUrl && <span className="text-xs text-muted-foreground truncate">· {status.propertyUrl}</span>}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 font-medium">
                  <Search className="h-2.5 w-2.5 shrink-0" />
                  Search Console
                </span>
                {status.scopesIncludeAnalytics ? (
                  <span className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 font-medium">
                    <BarChart3 className="h-2.5 w-2.5 shrink-0" />
                    Analytics
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-medium">
                    <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                    Analytics missing
                  </span>
                )}
                {!status.scopesIncludeAnalytics && (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Reconnect to add
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5">
              <XCircle className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Not connected</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status?.connected ? (
            <>
              <Link href={`/websites/${website.id}?tab=search-performance`}>
                <Button size="sm" variant="outline" className="text-xs h-7 px-2">View data</Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
              >
                Disconnect
              </Button>
            </>
          ) : status?.configured ? (
            <Button size="sm" className="text-xs h-7 px-2" onClick={handleConnect} disabled={isLoading}>
              Connect Google (GSC + GA4)
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground italic">Setup required ↑</span>
          )}
        </div>
      </div>
      {status?.connected && (
        <div className="pt-1.5 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">GA4 Property ID</p>
          <div className="flex gap-2 items-center">
            <Input
              value={ga4Input}
              onChange={e => setGa4Input(e.target.value)}
              placeholder="e.g. 123456789"
              className="h-7 text-xs flex-1"
            />
            <Button
              size="sm"
              className="h-7 px-2 text-xs shrink-0"
              onClick={handleSaveGa4}
              disabled={setPropertyMutation.isPending}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Find it in GA4 → Admin → Property settings. Used in the Analytics dashboard.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Social Accounts Card (used in Integrations tab) ───────────────────────────
const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook", Icon: MessageCircle },
  { value: "instagram", label: "Instagram", Icon: Camera },
  { value: "twitter", label: "Twitter/X", Icon: Twitter },
  { value: "linkedin", label: "LinkedIn", Icon: Briefcase },
  { value: "youtube", label: "YouTube", Icon: Youtube },
];

const socialApiBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

type SocialAccountRow = {
  id: number;
  platform: string;
  platformUsername: string | null;
  platformPageName: string | null;
  createdAt: string;
};

type SocialPlatformStatus = { configured: boolean; signupUrl: string; devDocsUrl: string };

function SocialAccountsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<SocialAccountRow[]>({
    queryKey: ["social-accounts"],
    queryFn: async () => {
      const res = await fetch(`${socialApiBase}/integrations/social/accounts`);
      if (!res.ok) throw new Error("Failed to load social accounts");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: statusMap = {} } = useQuery<Record<string, SocialPlatformStatus>>({
    queryKey: ["social-status"],
    queryFn: async () => {
      const res = await fetch(`${socialApiBase}/integrations/social/status`);
      if (!res.ok) throw new Error("Failed to load social status");
      return res.json();
    },
    staleTime: 60_000,
  });

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform);
    try {
      const res = await fetch(`${socialApiBase}/integrations/social/${platform}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      toast({ title: `${platform} account disconnected` });
    } catch {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <Card data-testid="card-social-integration">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-muted">
            <Link2 className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">Social Media Accounts</CardTitle>
            <CardDescription className="mt-0.5">
              Connect your social accounts via OAuth to enable direct publishing from the Social Media page.
              Each platform requires a free developer app — see the setup guides below.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {accountsLoading ? (
          <div className="space-y-2">
            {SOCIAL_PLATFORMS.map(p => <div key={p.value} className="h-12 rounded-md bg-muted animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {SOCIAL_PLATFORMS.map(({ value, label, Icon }) => {
              const account = accounts.find(a => a.platform === value);
              const ps = statusMap[value];
              const configured = ps?.configured ?? false;

              return (
                <div key={value} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      {account ? (
                        <p className="text-xs text-muted-foreground truncate">
                          {account.platformPageName ?? account.platformUsername ?? "Connected"}
                        </p>
                      ) : configured ? (
                        <p className="text-xs text-muted-foreground">Not connected</p>
                      ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                          Credentials not configured —{" "}
                          <a href={ps?.devDocsUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                            setup guide
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {account ? (
                      <>
                        <Badge variant="default" className="text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Connected
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={disconnecting === value}
                          onClick={() => handleDisconnect(value)}
                        >
                          {disconnecting === value ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
                        </Button>
                      </>
                    ) : configured ? (
                      <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                        <a href={`${socialApiBase}/integrations/social/${value}/connect`}>
                          Connect
                        </a>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                        <a href={ps?.signupUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                          Create app <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground pt-1">
          Required environment variables:{" "}
          <code className="bg-muted px-1 rounded text-xs">TWITTER_CLIENT_ID/SECRET</code>{", "}
          <code className="bg-muted px-1 rounded text-xs">LINKEDIN_CLIENT_ID/SECRET</code>{", "}
          <code className="bg-muted px-1 rounded text-xs">FACEBOOK_APP_ID/SECRET</code>{" "}
          (Instagram uses the same){". "}
          YouTube uses your existing{" "}
          <code className="bg-muted px-1 rounded text-xs">GOOGLE_CLIENT_ID/SECRET</code>.
        </p>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const hasFullAccess = !isAdmin && permissions === null;
  const [settingsTab, setSettingsTab] = useState<"plan" | "ai" | "email" | "webhooks" | "admin" | "integrations" | "security">("plan");

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
  const [emailMailchimpSendMode, setEmailMailchimpSendMode] = useState<"direct" | "sync_and_send" | "sync_only" | null>(null);
  const [emailSmtpHost, setEmailSmtpHost] = useState("");
  const [emailSmtpPort, setEmailSmtpPort] = useState("587");
  const [emailSmtpUser, setEmailSmtpUser] = useState("");
  const [emailSmtpPass, setEmailSmtpPass] = useState("");
  const [testEmailTo, setTestEmailTo] = useState("");
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [emailDirty, setEmailDirty] = useState(false);

  const { data: billing } = useGetBillingMe({ query: { queryKey: getGetBillingMeQueryKey() } });
  const { data: settings, isLoading, refetch } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const testMutation = useTestAiConnection();
  const { data: adminUsage, refetch: refetchAdminUsage } = useGetAdminUsage({ query: { enabled: isAdmin, queryKey: getGetAdminUsageQueryKey() } });
  const updateLimitsMutation = useUpdateUsageLimits();
  const resetUsageMutation = useResetUserUsage();
  const { data: emailSettings, refetch: refetchEmailSettings } = useGetEmailProviderSettings();
  const updateEmailMutation = useUpdateEmailProviderSettings();
  const testEmailMutation = useTestEmailConnection();

  // Lead scoring state
  const [scoringEdits, setScoringEdits] = useState<Record<string, unknown>>({});
  const { data: scoringConfig, refetch: refetchScoringConfig } = useGetLeadScoringConfig({ query: { enabled: isAdmin, queryKey: getGetLeadScoringConfigQueryKey() } });
  const updateScoringMutation = useUpdateLeadScoringConfig();
  const recalculateMutation = useRecalculateLeadScores();

  // Payment state
  type PaymentProvider = "stripe" | "razorpay";
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider | null>(null);
  const [paymentCurrency, setPaymentCurrency] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [showStripeWebhook, setShowStripeWebhook] = useState(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false);
  const [paymentTestResult, setPaymentTestResult] = useState<{ success: boolean; message: string; provider: string } | null>(null);
  const { data: paymentSettings, refetch: refetchPaymentSettings } = useGetPaymentSettings({ query: { enabled: isAdmin, queryKey: getGetPaymentSettingsQueryKey() } });
  const updatePaymentMutation = useUpdatePaymentSettings();
  const { data: websites, isLoading: websitesLoading } = useListWebsites({ query: { enabled: isAdmin } });
  const testPaymentMutation = useTestPaymentConnection();
  const { data: webhookEvents, refetch: refetchWebhookEvents } = useGetWebhookEvents({ query: { enabled: isAdmin, queryKey: getGetWebhookEventsQueryKey() } });

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
    if (activeEmailProvider === "mailchimp") body.mailchimpSendMode = emailMailchimpSendMode ?? emailSettings?.mailchimpSendMode ?? "direct";
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

  const handleSaveScoringConfig = () => {
    if (Object.keys(scoringEdits).length === 0) return;
    updateScoringMutation.mutate(
      { data: activeScoringConfig as Parameters<typeof updateScoringMutation.mutate>[0]["data"] },
      {
        onSuccess: () => {
          toast({ title: "Lead scoring weights saved" });
          setScoringEdits({});
          refetchScoringConfig();
        },
        onError: () => toast({ title: "Failed to save scoring weights", variant: "destructive" }),
      }
    );
  };

  const handleRecalculateScores = () => {
    recalculateMutation.mutate(undefined, {
      onSuccess: (data) => {
        toast({ title: `Scores recalculated — ${data.updated} leads updated` });
      },
      onError: () => toast({ title: "Failed to recalculate scores", variant: "destructive" }),
    });
  };

  const activeScoringConfig = {
    source: { ...((scoringConfig?.source ?? {})), ...((scoringEdits as { source?: object })?.source ?? {}) },
    status: { ...((scoringConfig?.status ?? {})), ...((scoringEdits as { status?: object })?.status ?? {}) },
    valueTier: { ...((scoringConfig?.valueTier ?? {})), ...((scoringEdits as { valueTier?: object })?.valueTier ?? {}) },
    recencyBonus: (scoringEdits as { recencyBonus?: number })?.recencyBonus ?? scoringConfig?.recencyBonus ?? 10,
  };

  const setScoringWeight = (category: string, key: string, value: number) => {
    setScoringEdits(prev => ({
      ...prev,
      [category]: { ...(prev[category] as object ?? {}), [key]: value },
    }));
  };

  const activePaymentProvider = (paymentProvider ?? paymentSettings?.provider ?? null) as PaymentProvider | null;
  const STRIPE_CURRENCIES = [
    { value: "usd", label: "USD — US Dollar" },
    { value: "gbp", label: "GBP — British Pound" },
    { value: "eur", label: "EUR — Euro" },
  ];
  const RAZORPAY_CURRENCIES = [
    { value: "inr", label: "INR — Indian Rupee" },
  ];
  const CURRENCIES = activePaymentProvider === "razorpay" ? RAZORPAY_CURRENCIES
    : activePaymentProvider === "stripe" ? STRIPE_CURRENCIES
    : [...STRIPE_CURRENCIES, { value: "inr", label: "INR — Indian Rupee" }];

  const handleSavePayment = () => {
    const body: Record<string, string> = {};
    if (paymentProvider) body.provider = paymentProvider;
    const cur = paymentCurrency.trim() || paymentSettings?.currency;
    if (cur) body.currency = cur;
    if (stripePublishableKey.trim()) body.stripePublishableKey = stripePublishableKey.trim();
    if (stripeSecretKey.trim()) body.stripeSecretKey = stripeSecretKey.trim();
    if (stripeWebhookSecret.trim()) body.stripeWebhookSecret = stripeWebhookSecret.trim();
    if (razorpayKeyId.trim()) body.razorpayKeyId = razorpayKeyId.trim();
    if (razorpayKeySecret.trim()) body.razorpayKeySecret = razorpayKeySecret.trim();
    if (Object.keys(body).length === 0) return;
    updatePaymentMutation.mutate(
      { data: body as Parameters<typeof updatePaymentMutation.mutate>[0]["data"] },
      {
        onSuccess: () => {
          toast({ title: "Payment settings saved" });
          setStripeSecretKey(""); setStripeWebhookSecret(""); setRazorpayKeySecret("");
          setPaymentProvider(null); setPaymentCurrency("");
          setStripePublishableKey(""); setRazorpayKeyId("");
          refetchPaymentSettings();
        },
        onError: () => toast({ title: "Failed to save payment settings", variant: "destructive" }),
      }
    );
  };

  const handleTestPayment = () => {
    setPaymentTestResult(null);
    testPaymentMutation.mutate(undefined, {
      onSuccess: (r) => {
        setPaymentTestResult({ success: r.success, message: r.message, provider: r.provider });
        toast({
          title: r.success ? "Connection verified" : "Connection failed",
          description: r.message,
          variant: r.success ? "default" : "destructive",
        });
      },
      onError: () => {
        setPaymentTestResult({ success: false, message: "Request failed", provider: "" });
        toast({ title: "Connection failed", description: "Could not reach the payment provider.", variant: "destructive" });
      },
    });
  };

  const SETTINGS_TABS = [
    { id: "plan" as const, label: "Plan & Account" },
    { id: "ai" as const, label: "AI" },
    { id: "email" as const, label: "Email" },
    { id: "integrations" as const, label: "Integrations" },
    { id: "security" as const, label: "Security" },
    ...(isAdmin ? [{ id: "webhooks" as const, label: "Webhooks" }] : []),
    ...(isAdmin ? [{ id: "admin" as const, label: "Admin" }] : []),
  ];

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure integrations and API keys</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b -mb-2">
        {SETTINGS_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSettingsTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              settingsTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={settingsTab === "plan" ? "space-y-6" : "hidden"}>
      {/* Billing & Plan */}
      <Card data-testid="card-billing-plan">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-violet-500/10">
              <Zap className="h-5 w-5 text-violet-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">Billing &amp; Plan</CardTitle>
                {billing && (
                  <Badge
                    data-testid="badge-current-plan"
                    variant="outline"
                    className={cn("text-xs capitalize font-semibold border", PLAN_COLORS[billing.plan])}
                  >
                    {billing.planName}
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-0.5">
                Your current subscription and monthly usage
              </CardDescription>
            </div>
            <Button
              data-testid="button-change-plan"
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => setLocation("/pricing")}
            >
              {billing?.plan === "agency" ? "View Plans" : "Upgrade Plan"}
              <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {billing ? (
            <>
              {/* Plan summary */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{billing.planName} Plan</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(billing.monthlyPrice)}/month
                  </p>
                </div>
                <Badge variant="outline" className={cn("text-xs capitalize font-semibold border", PLAN_COLORS[billing.plan])}>
                  {billing.planName}
                </Badge>
              </div>

              {/* Usage meters */}
              <div className="space-y-3">
                <p className="text-sm font-medium">This month&apos;s usage</p>
                <div className="space-y-3 rounded-lg border px-4 py-3">
                  <UsageMeter
                    label="Websites"
                    used={billing.usage.websites}
                    limit={billing.limits.websites}
                  />
                  <UsageMeter
                    label="Keywords tracked"
                    used={billing.usage.keywords}
                    limit={billing.limits.keywords}
                  />
                  <UsageMeter
                    label="Campaigns"
                    used={billing.usage.campaigns}
                    limit={billing.limits.campaigns}
                  />
                  <UsageMeter
                    label="AI generations"
                    used={billing.usage.aiGenerations}
                    limit={billing.limits.aiGenerations}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading billing information...</p>
          )}
        </CardContent>
      </Card>

      {/* My Access — shown only to staff users, not admins */}
      {!isAdmin && (
        <Card data-testid="card-my-access">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-indigo-500/10">
                <Lock className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <CardTitle className="text-base">My Access</CardTitle>
                <CardDescription className="mt-0.5">
                  {hasFullAccess
                    ? "You have full access to all modules."
                    : permissions && permissions.length === 0
                    ? "You don't have access to any modules yet. Contact an admin."
                    : "The modules you can access in this workspace."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hasFullAccess ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Full access — all modules enabled
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_MODULES.map((mod) => {
                  const granted = permissions?.includes(mod) ?? false;
                  return (
                    <div
                      key={mod}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                        granted
                          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                          : "border-border bg-muted/30 opacity-60"
                      )}
                    >
                      {granted ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <ShieldOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className={cn("font-medium", granted ? "text-foreground" : "text-muted-foreground")}>
                        {MODULE_LABELS[mod]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      </div>

      <div className={settingsTab === "ai" ? "space-y-6" : "hidden"}>
      {/* Bring Your Own AI Key */}
      <ByokCard />

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

      <div className={settingsTab === "email" ? "space-y-6" : "hidden"}>
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
                        checked={(emailMailchimpSendMode ?? emailSettings?.mailchimpSendMode ?? "direct") === opt.value}
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
                {(emailMailchimpSendMode ?? emailSettings?.mailchimpSendMode ?? "direct") === "sync_only" && !emailAudienceId && !emailSettings?.audienceId && (
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

      </div>

      <div className={settingsTab === "admin" ? "space-y-6" : "hidden"}>
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

      {/* Lead Scoring Configuration */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Lead Scoring</CardTitle>
                <CardDescription className="mt-1">Configure point weights for automatic lead scoring (0–100 scale)</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-recalculate-scores"
                onClick={handleRecalculateScores}
                disabled={recalculateMutation.isPending}
                className="shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recalculateMutation.isPending ? "animate-spin" : ""}`} />
                Recalculate All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Source weights */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Lead Source Points</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { key: "paid", label: "Paid" },
                  { key: "referral", label: "Referral" },
                  { key: "social", label: "Social" },
                  { key: "organic", label: "Organic" },
                  { key: "direct", label: "Direct" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      data-testid={`input-score-source-${key}`}
                      value={(activeScoringConfig.source as Record<string, number>)[key] ?? 0}
                      onChange={e => setScoringWeight("source", key, parseInt(e.target.value) || 0)}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Status weights */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Lead Status Points</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { key: "new", label: "New" },
                  { key: "contacted", label: "Contacted" },
                  { key: "qualified", label: "Qualified" },
                  { key: "converted", label: "Converted" },
                  { key: "lost", label: "Lost" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      data-testid={`input-score-status-${key}`}
                      value={(activeScoringConfig.status as Record<string, number>)[key] ?? 0}
                      onChange={e => setScoringWeight("status", key, parseInt(e.target.value) || 0)}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Value tier weights */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Lead Value Points</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { key: "over1000", label: "Over $1000" },
                  { key: "over500", label: "$500–$1000" },
                  { key: "over100", label: "$100–$500" },
                  { key: "over0", label: "Under $100" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      data-testid={`input-score-value-${key}`}
                      value={(activeScoringConfig.valueTier as Record<string, number>)[key] ?? 0}
                      onChange={e => setScoringWeight("valueTier", key, parseInt(e.target.value) || 0)}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Recency bonus */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Recency Bonus</h3>
              <div className="max-w-[120px] space-y-1">
                <label className="text-xs text-muted-foreground">Points (leads &lt; 7 days old)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  data-testid="input-score-recency"
                  value={activeScoringConfig.recencyBonus}
                  onChange={e => setScoringEdits(prev => ({ ...prev, recencyBonus: parseInt(e.target.value) || 0 }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Weights summary preview */}
            {(() => {
              const src = activeScoringConfig.source as Record<string, number>;
              const sta = activeScoringConfig.status as Record<string, number>;
              const val = activeScoringConfig.valueTier as Record<string, number>;
              const maxSource = Math.max(...Object.values(src).map(Number), 0);
              const maxStatus = Math.max(...Object.values(sta).map(Number), 0);
              const maxValue = Math.max(...Object.values(val).map(Number), 0);
              const maxRecency = Number(activeScoringConfig.recencyBonus) || 0;
              const maxPossible = Math.min(100, maxSource + maxStatus + maxValue + maxRecency);
              return (
                <div className="rounded-md bg-muted/50 border px-4 py-3 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Max possible score with current weights</span>
                  <span className={`font-mono font-bold text-sm ${maxPossible >= 70 ? "text-green-600" : "text-yellow-600"}`}>{maxPossible} / 100</span>
                </div>
              );
            })()}

            <div className="flex justify-end">
              <Button
                data-testid="button-save-scoring-config"
                onClick={handleSaveScoringConfig}
                disabled={Object.keys(scoringEdits).length === 0 || updateScoringMutation.isPending}
                size="sm"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {updateScoringMutation.isPending ? "Saving..." : "Save Weights"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Gateway (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base">Payment Gateway</CardTitle>
                  {paymentSettings?.provider && (
                    <Badge variant="default" className="text-xs capitalize" data-testid="badge-payment-provider">
                      {paymentSettings.provider === "stripe" ? "Stripe" : "Razorpay"} Active
                    </Badge>
                  )}
                  {!paymentSettings?.provider && (
                    <Badge variant="secondary" className="text-xs">Not configured</Badge>
                  )}
                </div>
                <CardDescription className="mt-1">
                  Configure Stripe or Razorpay for payment processing. Keys are encrypted at rest.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Provider selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Active Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {(["stripe", "razorpay"] as PaymentProvider[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    data-testid={`button-payment-provider-${p}`}
                    onClick={() => {
                      setPaymentProvider(p);
                      setPaymentTestResult(null);
                      setPaymentCurrency(p === "razorpay" ? "inr" : "usd");
                    }}
                    className={`flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${
                      activePaymentProvider === p
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">{p === "stripe" ? "Stripe" : "Razorpay"}</span>
                        {p === "razorpay" && <Badge variant="outline" className="text-xs">India</Badge>}
                        {p === "stripe" && <Badge variant="outline" className="text-xs">Global</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p === "stripe" ? "Cards, wallets, subscriptions — worldwide." : "UPI, net banking, cards — India-first."}
                      </p>
                    </div>
                    {activePaymentProvider === p && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Default currency */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Billing Currency</label>
              <div className="relative">
                <select
                  data-testid="select-payment-currency"
                  value={paymentCurrency || paymentSettings?.currency || "usd"}
                  onChange={e => setPaymentCurrency(e.target.value)}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Stripe keys */}
            {activePaymentProvider === "stripe" && (
              <div className="space-y-3 p-4 rounded-md border bg-muted/30">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-xs">Stripe Keys</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Publishable Key</label>
                  <Input
                    data-testid="input-stripe-publishable-key"
                    placeholder={paymentSettings?.stripePublishableKey ? paymentSettings.stripePublishableKey : "pk_live_... or pk_test_..."}
                    value={stripePublishableKey}
                    onChange={e => setStripePublishableKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Public key — safe to include in frontend code.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Secret Key</label>
                  {paymentSettings?.stripeSecretKeyConfigured && (
                    <div className="flex items-center gap-2 p-2 rounded bg-muted border text-xs text-muted-foreground">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      Secret key is saved. Enter a new one to replace it.
                    </div>
                  )}
                  <div className="relative">
                    <Input
                      data-testid="input-stripe-secret-key"
                      type={showStripeSecret ? "text" : "password"}
                      placeholder={paymentSettings?.stripeSecretKeyConfigured ? "Enter new key to replace" : "sk_live_... or sk_test_..."}
                      value={stripeSecretKey}
                      onChange={e => setStripeSecretKey(e.target.value)}
                      className="pr-16"
                    />
                    <button type="button" onClick={() => setShowStripeSecret(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">
                      {showStripeSecret ? "hide" : "show"}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Webhook Secret <span className="text-muted-foreground font-normal">(optional)</span></label>
                  {paymentSettings?.stripeWebhookSecretConfigured && (
                    <div className="flex items-center gap-2 p-2 rounded bg-muted border text-xs text-muted-foreground">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      Webhook secret is saved.
                    </div>
                  )}
                  <div className="relative">
                    <Input
                      data-testid="input-stripe-webhook-secret"
                      type={showStripeWebhook ? "text" : "password"}
                      placeholder="whsec_..."
                      value={stripeWebhookSecret}
                      onChange={e => setStripeWebhookSecret(e.target.value)}
                      className="pr-16"
                    />
                    <button type="button" onClick={() => setShowStripeWebhook(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">
                      {showStripeWebhook ? "hide" : "show"}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Used to verify webhook payloads from Stripe's dashboard.</p>
                </div>
              </div>
            )}

            {/* Razorpay keys */}
            {activePaymentProvider === "razorpay" && (
              <div className="space-y-3 p-4 rounded-md border bg-muted/30">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-xs">Razorpay Keys</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Key ID</label>
                  <Input
                    data-testid="input-razorpay-key-id"
                    placeholder={paymentSettings?.razorpayKeyId ? paymentSettings.razorpayKeyId : "rzp_live_... or rzp_test_..."}
                    value={razorpayKeyId}
                    onChange={e => setRazorpayKeyId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Your Razorpay Key ID (public identifier).</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Key Secret</label>
                  {paymentSettings?.razorpayKeySecretConfigured && (
                    <div className="flex items-center gap-2 p-2 rounded bg-muted border text-xs text-muted-foreground">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      Key secret is saved. Enter a new one to replace it.
                    </div>
                  )}
                  <div className="relative">
                    <Input
                      data-testid="input-razorpay-key-secret"
                      type={showRazorpaySecret ? "text" : "password"}
                      placeholder={paymentSettings?.razorpayKeySecretConfigured ? "Enter new secret to replace" : "Your Razorpay key secret"}
                      value={razorpayKeySecret}
                      onChange={e => setRazorpayKeySecret(e.target.value)}
                      className="pr-16"
                    />
                    <button type="button" onClick={() => setShowRazorpaySecret(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">
                      {showRazorpaySecret ? "hide" : "show"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Save + Test */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                data-testid="button-save-payment"
                onClick={handleSavePayment}
                disabled={updatePaymentMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                {updatePaymentMutation.isPending ? "Saving..." : "Save Payment Settings"}
              </Button>
              <Button
                variant="outline"
                data-testid="button-test-payment"
                onClick={handleTestPayment}
                disabled={testPaymentMutation.isPending || !paymentSettings?.provider}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${testPaymentMutation.isPending ? "animate-spin" : ""}`} />
                {testPaymentMutation.isPending ? "Testing..." : "Test Connection"}
              </Button>
            </div>

            {/* Test result */}
            {paymentTestResult && (
              <div className={`flex items-start gap-2 p-3 rounded-md text-sm border ${
                paymentTestResult.success
                  ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300"
                  : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
              }`} data-testid="text-payment-test-result">
                {paymentTestResult.success
                  ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                }
                <span>{paymentTestResult.message}</span>
              </div>
            )}

            {/* Webhook endpoint info */}
            <div className="space-y-2 p-4 rounded-md border bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Webhook Endpoints</p>
              <p className="text-xs text-muted-foreground">
                Point your payment provider's webhook settings to these URLs. Events will be logged in the Webhook Events section below.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono shrink-0">POST</Badge>
                  <code className="text-xs font-mono text-foreground break-all">/api/webhooks/stripe</code>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono shrink-0">POST</Badge>
                  <code className="text-xs font-mono text-foreground break-all">/api/webhooks/razorpay</code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupon Management (admin only) */}
      {isAdmin && (
        <CouponManagementCard />
      )}

      </div>

      <div className={settingsTab === "security" ? "space-y-6" : "hidden"}>
      <SessionsCard />
      </div>

      <div className={settingsTab === "webhooks" ? "space-y-6" : "hidden"}>
      {/* Outbound webhooks config */}
      {isAdmin && (
        <WebhooksCard />
      )}

      {/* Webhook Events Log */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base">Webhook Events</CardTitle>
                  {webhookEvents && (
                    <Badge variant="secondary" className="text-xs" data-testid="badge-webhook-event-count">
                      {webhookEvents.length} recent
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1">
                  Real-time payment events received from Stripe and Razorpay. The last 100 events are shown.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                title="Refresh events"
                data-testid="button-refresh-webhook-events"
                onClick={() => refetchWebhookEvents()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!webhookEvents && (
              <p className="text-sm text-muted-foreground">Loading events...</p>
            )}
            {webhookEvents && webhookEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No webhook events yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Events will appear here once your payment provider starts sending them to the webhook endpoints above.
                </p>
              </div>
            )}
            {webhookEvents && webhookEvents.length > 0 && (
              <div className="space-y-2" data-testid="list-webhook-events">
                {webhookEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-md border text-sm"
                    data-testid={`webhook-event-${event.id}`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {event.status === "received"
                        ? <CheckCircle className="h-4 w-4 text-green-500" />
                        : <XCircle className="h-4 w-4 text-destructive" />
                      }
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs capitalize shrink-0">
                          {event.provider}
                        </Badge>
                        <span className="font-mono text-xs font-medium truncate">{event.eventType}</span>
                        {event.eventId && (
                          <span className="text-xs text-muted-foreground font-mono truncate">{event.eventId}</span>
                        )}
                      </div>
                      {event.error && (
                        <p className="text-xs text-destructive">{event.error}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {new Date(event.receivedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>

      <div className={settingsTab === "integrations" ? "space-y-6" : "hidden"}>
      {/* Social Media Accounts */}
      <SocialAccountsCard />
      {/* Google Search Console Integration */}
      <Card data-testid="card-google-integration">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-muted">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Google (Search Console + GA4)</CardTitle>
              <CardDescription className="mt-0.5">
                Connect each website via OAuth 2.0 to enable Google Search Console data and GA4 Analytics traffic reports.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAdmin ? (
            <p className="text-sm text-muted-foreground">Contact your administrator to configure Google integrations.</p>
          ) : (
            <>
              {!websitesLoading && websites && websites.length > 0 && (
                <GoogleSetupGuide websites={websites} />
              )}
              {websitesLoading ? (
                <div className="space-y-2">
                  <div className="h-12 rounded-md bg-muted animate-pulse" />
                  <div className="h-12 rounded-md bg-muted animate-pulse" />
                </div>
              ) : !websites || websites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No websites found. Add a website first.</p>
              ) : (
                <div className="space-y-2">
                  {websites.map(site => (
                    <GscWebsiteRow key={site.id} website={site} />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      </div>

      <div className={settingsTab === "admin" ? "space-y-6" : "hidden"}>
      {/* Rank Change Notifications (admin only) */}
      {isAdmin && (
        <>
          <NotificationSettingsCard />
        </>
      )}
      </div>
    </div>
  );
}
