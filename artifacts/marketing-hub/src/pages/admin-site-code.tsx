import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, AlertTriangle, Code2 } from "lucide-react";
import { apiFetch } from "@/lib/catalog-api";

interface SiteCode { headHtml: string; bodyHtml: string }

export default function AdminSiteCodePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SiteCode>({
    queryKey: ["admin-site-code"],
    queryFn: () => apiFetch<SiteCode>("/admin/site-code"),
  });

  const [headHtml, setHeadHtml] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  useEffect(() => {
    if (data) { setHeadHtml(data.headHtml); setBodyHtml(data.bodyHtml); }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => apiFetch<SiteCode>("/admin/site-code", {
      method: "PUT",
      body: JSON.stringify({ headHtml, bodyHtml }),
    }),
    onSuccess: () => {
      toast({ title: "Saved", description: "Custom code is live on every public page." });
      qc.invalidateQueries({ queryKey: ["admin-site-code"] });
      qc.invalidateQueries({ queryKey: ["public-site-code"] });
    },
    onError: (err) => toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Code2 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Custom Site Code</h1>
          <p className="text-sm text-muted-foreground">Inject HTML/JavaScript into every public marketing page (Google Tag Manager, pixels, chat scripts, etc.).</p>
        </div>
      </div>

      <Card className="border-amber-300 bg-amber-50/40">
        <CardContent className="flex gap-3 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-amber-900">
            <strong>Security warning:</strong> Anything you paste here runs in every visitor's browser. Only paste code from sources you trust. Malicious scripts can steal data, hijack sessions, or deface your site.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{`<head>`} snippets</CardTitle>
          <CardDescription>Loaded inside the document head. Good place for analytics, GTM, fonts, meta tags. Max 50,000 chars.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="head-html" className="sr-only">Head HTML</Label>
          <Textarea
            id="head-html"
            value={headHtml}
            onChange={(e) => setHeadHtml(e.target.value)}
            data-testid="textarea-head-html"
            rows={10}
            className="font-mono text-xs"
            placeholder="<!-- Paste your <script>, <meta>, or <link> tags here -->"
          />
          <div className="text-xs text-muted-foreground mt-2">{headHtml.length.toLocaleString()} / 50,000 characters</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>End-of-{`<body>`} snippets</CardTitle>
          <CardDescription>Loaded just before the closing body tag. Good for chat widgets, conversion pixels, deferred scripts. Max 50,000 chars.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="body-html" className="sr-only">Body HTML</Label>
          <Textarea
            id="body-html"
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            data-testid="textarea-body-html"
            rows={10}
            className="font-mono text-xs"
            placeholder="<!-- Paste body-end scripts here -->"
          />
          <div className="text-xs text-muted-foreground mt-2">{bodyHtml.length.toLocaleString()} / 50,000 characters</div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          data-testid="button-save-site-code"
        >
          {saveMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save changes
        </Button>
        <Button
          variant="outline"
          onClick={() => { if (data) { setHeadHtml(data.headHtml); setBodyHtml(data.bodyHtml); } }}
          disabled={saveMut.isPending}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
