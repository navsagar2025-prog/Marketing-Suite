import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Key, CheckCircle, AlertCircle, Trash2, Loader2, Eye, EyeOff } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ByokStatus = {
  byokEnabled: boolean;
  byokProvider: string | null;
  hasKey: boolean;
};

const BYOK_PROVIDERS = [
  { value: "openai", label: "OpenAI (ChatGPT)", placeholder: "sk-..." },
  { value: "anthropic", label: "Anthropic (Claude)", placeholder: "sk-ant-..." },
  { value: "gemini", label: "Google Gemini", placeholder: "AIza..." },
  { value: "perplexity", label: "Perplexity AI", placeholder: "pplx-..." },
];

async function fetchByok(token: string): Promise<ByokStatus> {
  const res = await fetch(`${BASE}/api/settings/byok`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load BYOK settings");
  return res.json();
}

async function saveByok(token: string, provider: string, apiKey: string): Promise<ByokStatus> {
  const res = await fetch(`${BASE}/api/settings/byok`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ provider, apiKey }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to save key");
  return data;
}

async function removeByok(token: string): Promise<ByokStatus> {
  const res = await fetch(`${BASE}/api/settings/byok`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to remove key");
  return data;
}

export function ByokCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const token = localStorage.getItem("auth_token") ?? "";

  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data: byok, isLoading } = useQuery({
    queryKey: ["byok-status"],
    queryFn: () => fetchByok(token),
  });

  const saveMutation = useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      saveByok(token, provider, key),
    onSuccess: () => {
      toast({ title: "AI key saved", description: "Your personal AI key is now active." });
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["byok-status"] });
    },
    onError: (e: Error) => toast({ title: "Failed to save key", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeByok(token),
    onSuccess: () => {
      toast({ title: "AI key removed", description: "Falling back to platform AI." });
      qc.invalidateQueries({ queryKey: ["byok-status"] });
    },
    onError: (e: Error) => toast({ title: "Failed to remove key", description: e.message, variant: "destructive" }),
  });

  const providerInfo = BYOK_PROVIDERS.find(p => p.value === (byok?.byokProvider ?? selectedProvider));

  return (
    <Card data-testid="card-byok">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-amber-500/10">
            <Key className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">Bring Your Own AI Key</CardTitle>
              {!isLoading && byok?.byokEnabled && byok.hasKey ? (
                <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-600">
                  Active — {BYOK_PROVIDERS.find(p => p.value === byok.byokProvider)?.label ?? byok.byokProvider}
                </Badge>
              ) : !isLoading ? (
                <Badge variant="secondary" className="text-xs">Not configured</Badge>
              ) : null}
            </div>
            <CardDescription className="mt-1">
              Connect your own OpenAI, Anthropic, Gemini, or Perplexity key. Your AI calls route through your
              key — no monthly AI generation cap applies. Available on Growth &amp; Agency plans.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {byok?.byokEnabled && byok.hasKey && (
          <div className="flex items-center gap-3 p-3 rounded-md border bg-green-500/5 border-green-500/20">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Your {BYOK_PROVIDERS.find(p => p.value === byok.byokProvider)?.label ?? byok.byokProvider} key is active
              </p>
              <p className="text-xs text-green-600/70 dark:text-green-500/70">
                All AI features are routing through your personal API key. No usage counted against your plan.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive shrink-0"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">AI Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {BYOK_PROVIDERS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setSelectedProvider(p.value)}
                  className={`flex items-center gap-2 p-2.5 rounded-md border text-left text-sm transition-colors ${
                    selectedProvider === p.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="font-medium text-xs">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <div className="relative">
              <Input
                data-testid="input-byok-api-key"
                type={showKey ? "text" : "password"}
                placeholder={providerInfo?.placeholder ?? "Your API key"}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="pr-16 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your key is stored securely. It is never exposed to other users or in API responses.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              data-testid="button-save-byok"
              onClick={() => saveMutation.mutate({ provider: selectedProvider, key: apiKey })}
              disabled={saveMutation.isPending || !apiKey.trim()}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Key className="h-4 w-4 mr-1" />}
              {byok?.hasKey ? "Replace Key" : "Save Key"}
            </Button>
            {byok?.byokEnabled && byok.hasKey && (
              <Button
                variant="outline"
                data-testid="button-remove-byok"
                className="text-destructive hover:text-destructive border-destructive/30"
                onClick={() => removeMutation.mutate()}
                disabled={removeMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove Key
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-md bg-muted/40 border text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
          <span>
            BYOK is available on <strong>Growth and Agency plans</strong>. On Starter, platform AI limits still apply.
            Your key is used only for your account — other users are not affected.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
