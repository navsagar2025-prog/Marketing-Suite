import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2, ExternalLink, Link2, Plus, CheckCheck, MousePointerClick, Globe } from "lucide-react";
import { HelpTooltip } from "@/components/HelpTooltip";
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
  websiteId: number | null;
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

interface Website {
  id: number;
  name: string;
  url: string;
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
  if (!/^https?:\/\//i.test(fields.destinationUrl)) return "";
  try {
    const url = new URL(fields.destinationUrl);
    url.searchParams.set("utm_source", fields.source);
    url.searchParams.set("utm_medium", fields.medium);
    url.searchParams.set("utm_campaign", fields.campaign);
    if (fields.term) url.searchParams.set("utm_term", fields.term);
    if (fields.content) url.searchParams.set("utm_content", fields.content);
    return url.toString();
  } catch {
    return "";
  }
}

function getApiBase(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

export default function UtmBuilderPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<number | "preview" | "tracked" | null>(null);

  const [form, setForm] = useState({
    destinationUrl: "",
    source: "",
    medium: "",
    campaign: "",
    term: "",
    content: "",
    label: "",
    websiteId: "",
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

  const { data: websites = [] } = useQuery<Website[]>({
    queryKey: ["websites"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/websites`, { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload: Record<string, unknown> = {
        destinationUrl: data.destinationUrl,
        source: data.source,
        medium: data.medium,
        campaign: data.campaign,
      };
      if (data.term) payload.term = data.term;
      if (data.content) payload.content = data.content;
      if (data.label) payload.label = data.label;
      if (data.websiteId) payload.websiteId = parseInt(data.websiteId, 10);

      const res = await fetch(`${BASE}/api/utm-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create UTM link");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utm-links"] });
      setForm({ destinationUrl: "", source: "", medium: "", campaign: "", term: "", content: "", label: "", websiteId: "" });
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

  function copyToClipboard(text: string, key: number | "preview" | "tracked") {
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

  function getTrackedUrl(link: UtmLink): string {
    return `${getApiBase()}/r/${link.id}`;
  }

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const isValid = form.destinationUrl && form.source && form.medium && form.campaign && /^https?:\/\//i.test(form.destinationUrl);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Link2 className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            UTM Link Builder
            <HelpTooltip text="UTM parameters are short tags you add to a URL so analytics tools know where visitors came from. For example, adding ?utm_source=newsletter tells Google Analytics the visitor clicked a link in your email newsletter — not just that they visited." />
          </h1>
          <p className="text-sm text-muted-foreground">Generate campaign-tagged URLs, track clicks via short redirect links</p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Destination URL <span className="text-destructive">*</span></Label>
              <Input
                placeholder="https://yoursite.com/landing-page"
                value={form.destinationUrl}
                onChange={(e) => setForm((f) => ({ ...f, destinationUrl: e.target.value }))}
              />
              {form.destinationUrl && !/^https?:\/\//i.test(form.destinationUrl) && (
                <p className="text-xs text-destructive">URL must start with https:// or http://</p>
              )}
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

          {websites.length > 0 && (
            <div className="space-y-1.5 max-w-xs">
              <Label className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Associated Website <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.websiteId}
                onChange={(e) => setForm((f) => ({ ...f, websiteId: e.target.value }))}
              >
                <option value="">No website</option>
                {websites.map((w) => (
                  <option key={w.id} value={String(w.id)}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Live Preview */}
          {previewUrl && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full UTM URL</p>
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
              <p className="text-xs text-muted-foreground">
                After saving, a short tracked redirect URL will be generated at <span className="font-mono">{getApiBase()}/r/&#123;id&#125;</span>
              </p>
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
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-sm">No links saved yet</p>
              <p className="text-xs mt-2 max-w-xs mx-auto leading-relaxed">
                Fill in the form above to build a UTM link. Once saved, a short tracked redirect URL is generated so you can count exactly how many clicks your campaign receives.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((link) => {
                const fullUrl = getFullUrl(link);
                const trackedUrl = getTrackedUrl(link);
                const website = websites.find((w) => w.id === link.websiteId);
                return (
                  <div
                    key={link.id}
                    className="rounded-lg border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {link.label && (
                            <span className="font-medium text-sm">{link.label}</span>
                          )}
                          <Badge variant="secondary" className="text-xs">{link.source}</Badge>
                          <Badge variant="outline" className="text-xs">{link.medium}</Badge>
                          <Badge variant="outline" className="text-xs">{link.campaign}</Badge>
                          {website && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              {website.name}
                            </span>
                          )}
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
                          title="Delete"
                          onClick={() => deleteMutation.mutate(link.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Tracked redirect URL */}
                    <div className="rounded-md bg-muted/50 px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">Tracked redirect URL (use this in ads/emails)</p>
                        <p className="text-xs font-mono font-medium truncate" title={trackedUrl}>{trackedUrl}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Copy tracked URL"
                          onClick={() => copyToClipboard(trackedUrl, link.id)}
                        >
                          {copied === link.id
                            ? <CheckCheck className="h-3 w-3 text-green-500" />
                            : <Copy className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Open tracked URL"
                          onClick={() => window.open(trackedUrl, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
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
