import { useState, useEffect } from "react";
import { Settings, Key, CheckCircle, AlertCircle, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [falApiKey, setFalApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data: settings, isLoading, refetch } = useGetSettings();
  const updateMutation = useUpdateSettings();

  const isConfigured = settings?.falApiKeyConfigured === true;

  const handleSave = () => {
    if (!falApiKey.trim()) return;
    updateMutation.mutate(
      { data: { falApiKey: falApiKey.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Fal.ai API key saved", description: "You can now generate images and videos." });
          setFalApiKey("");
          refetch();
        },
        onError: () => toast({ title: "Failed to save API key", variant: "destructive" }),
      }
    );
  };

  const handleRemove = () => {
    updateMutation.mutate(
      { data: { falApiKey: null } },
      {
        onSuccess: () => {
          toast({ title: "Fal.ai API key removed" });
          refetch();
        },
        onError: () => toast({ title: "Failed to remove API key", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure integrations and API keys</p>
      </div>

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
                  isConfigured ? (
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
          {isConfigured && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted border text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-muted-foreground">An API key is currently saved. Enter a new key below to replace it.</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={handleRemove}
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
                type={showKey ? "text" : "password"}
                placeholder={isConfigured ? "Enter new key to replace current one" : "fal_xxxxxxxxxxxxxxxx"}
                value={falApiKey}
                onChange={e => setFalApiKey(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
                className="pr-20"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? "hide" : "show"}
              </button>
            </div>
            <Button
              data-testid="button-save-fal-key"
              onClick={handleSave}
              disabled={!falApiKey.trim() || updateMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              {updateMutation.isPending ? "Saving..." : "Save Key"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Your API key is set as the <code className="font-mono">FAL_KEY</code> environment variable on the server and never exposed to the browser.
            For persistence across server restarts, add <code className="font-mono">FAL_KEY</code> to your environment secrets directly.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">AI Models Used</CardTitle>
              <CardDescription className="mt-1">Models used for media generation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Image Generation</span>
              <span className="font-mono text-xs">fal-ai/flux/schnell</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Video Generation</span>
              <span className="font-mono text-xs">fal-ai/kling-video/v2.1</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
