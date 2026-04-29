import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2, ExternalLink, Link2, Plus, CheckCheck, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface UtmLink {
  id: number;
  destinationUrl: string;
  source: string;
  medium: string;
  campaign: string;
  term: string | null;
  content: string | null;
  label: string | null;
  clicks: number;
  createdAt: string;
}

function buildUtmUrl(fields: {
  destinationUrl: string;
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
}): string {
  if (!fields.destinationUrl || !fields.source || !fields.medium || !fields.campaign) return "";
  try {
    const url = new URL(fields.destinationUrl);
    if (fields.source) url.searchParams.set("utm_source", fields.source);
    if (fields.medium) url.searchParams.set("utm_medium", fields.medium);
    if (fields.campaign) url.searchParams.set("utm_campaign", fields.campaign);
    if (fields.term) url.searchParams.set("utm_term", fields.term);
    if (fields.content) url.searchParams.set("utm_content", fields.content);
    return url.toString();
  } catch {
    return "";
  }
}

export default function UtmBuilderPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<number | "preview" | null>(null);

  const [form, setForm] = useState({
    destinationUrl: "",
    source: "",
    medium: "",
    campaign: "",
    term: "",
    content: "",
    label: "",
  });

  const previewUrl = useMemo(() => buildUtmUrl(form), [form]);

  const { data: links = [], isLoading } = useQuery<UtmLink[]>({
    queryKey: ["utm-links"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/utm-links`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch UTM links");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`${BASE}/api/utm-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          destinationUrl: data.destinationUrl,
          source: data.source,
          medium: data.medium,
          campaign: data.campaign,
          term: data.term || undefined,
          content: data.content || undefined,
          label: data.label || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create UTM link");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utm-links"] });
      setForm({ destinationUrl: "", source: "", medium: "", campaign: "", term: "", content: "", label: "" });
      toast({ title: "Link saved", description: "Your UTM link has been saved to history." });
    },
    onError: () => toast({ title: "Error", description: "Could not save the link.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/utm-links/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["utm-links"] }),
    onError: () => toast({ title: "Error", description: "Could not delete link.", variant: "destructive" }),
  });

  function copyToClipboard(text: string, key: number | "preview") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function getFullUrl(link: UtmLink): string {
    return buildUtmUrl({
      destinationUrl: link.destinationUrl,
      source: link.source,
      medium: link.medium,
      campaign: link.campaign,
      term: link.term ?? "",
      content: link.content ?? "",
    });
  }

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);

  const isValid = form.destinationUrl && form.source && form.medium && form.campaign;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Link2 className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">UTM Link Builder</h1>
          <p className="text-sm text-muted-foreground">Generate campaign-tagged URLs and track clicks</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Links</p>
            <p className="text-2xl font-bold mt-1">{links.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Clicks</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-2xl font-bold">{totalClicks}</p>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Sources</p>
            <p className="text-2xl font-bold mt-1">
              {new Set(links.map((l) => l.source)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Builder Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Build a New UTM Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Destination URL <span className="text-destructive">*</span></Label>
              <Input
                placeholder="https://yoursite.com/landing-page"
                value={form.destinationUrl}
                onChange={(e) => setForm((f) => ({ ...f, destinationUrl: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Campaign Source <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. google, newsletter"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Campaign Medium <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. cpc, email, social"
                value={form.medium}
                onChange={(e) => setForm((f) => ({ ...f, medium: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Campaign Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. spring-sale-2025"
                value={form.campaign}
                onChange={(e) => setForm((f) => ({ ...f, campaign: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Campaign Term <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="e.g. seo+tools"
                value={form.term}
                onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Campaign Content <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="e.g. banner-a, cta-blue"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Link Label <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="e.g. Q1 Google Ads"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
          </div>

          {/* Live Preview */}
          {previewUrl && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Generated URL</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => copyToClipboard(previewUrl, "preview")}
                >
                  {copied === "preview" ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "preview" ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-xs font-mono break-all text-foreground/80">{previewUrl}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!isValid || createMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Save Link
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved Links</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
          ) : links.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Link2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No links yet. Build your first UTM link above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((link) => {
                const fullUrl = getFullUrl(link);
                return (
                  <div
                    key={link.id}
                    className="rounded-lg border bg-card p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {link.label && (
                          <span className="font-medium text-sm">{link.label}</span>
                        )}
                        <Badge variant="secondary" className="text-xs">{link.source}</Badge>
                        <Badge variant="outline" className="text-xs">{link.medium}</Badge>
                        <Badge variant="outline" className="text-xs">{link.campaign}</Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MousePointerClick className="h-3 w-3" />
                          {link.clicks} click{link.clicks !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground truncate max-w-xl" title={fullUrl}>
                        {fullUrl}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Copy URL"
                        onClick={() => copyToClipboard(fullUrl, link.id)}
                      >
                        {copied === link.id
                          ? <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                          : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Open URL"
                        onClick={() => window.open(fullUrl, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Delete"
                        onClick={() => deleteMutation.mutate(link.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
