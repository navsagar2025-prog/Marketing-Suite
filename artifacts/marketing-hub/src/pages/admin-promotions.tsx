import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Pencil, Megaphone, Calendar } from "lucide-react";
import { apiFetch, type Promotion } from "@/lib/catalog-api";

interface Editor {
  id?: number;
  kind: "banner" | "popup";
  title: string; body: string; imageUrl: string;
  ctaLabel: string; ctaUrl: string; ctaColor: string;
  audience: "all" | "loggedIn";
  startsAtLocal: string; endsAtLocal: string;
  active: boolean;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyEditor(): Editor {
  return { kind: "banner", title: "", body: "", imageUrl: "", ctaLabel: "Learn more", ctaUrl: "/", ctaColor: "#2563eb", audience: "all", startsAtLocal: toLocalInput(new Date().toISOString()), endsAtLocal: "", active: true };
}

function fromPromo(p: Promotion): Editor {
  return { id: p.id, kind: p.kind, title: p.title, body: p.body, imageUrl: p.imageUrl ?? "", ctaLabel: p.ctaLabel ?? "", ctaUrl: p.ctaUrl ?? "", ctaColor: p.ctaColor, audience: p.audience, startsAtLocal: toLocalInput(p.startsAt), endsAtLocal: toLocalInput(p.endsAt), active: p.active };
}

function statusFor(p: Promotion): { label: string; cls: string } {
  if (!p.active) return { label: "Inactive", cls: "bg-gray-200 text-gray-800" };
  const now = Date.now();
  const start = new Date(p.startsAt).getTime();
  const end = p.endsAt ? new Date(p.endsAt).getTime() : Infinity;
  if (now < start) return { label: "Scheduled", cls: "bg-amber-100 text-amber-800" };
  if (now > end) return { label: "Ended", cls: "bg-gray-200 text-gray-800" };
  return { label: "Live", cls: "bg-green-100 text-green-800" };
}

export default function AdminPromotionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editor, setEditor] = useState<Editor | null>(null);

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["admin-promotions"],
    queryFn: () => apiFetch<Promotion[]>("/admin/promotions"),
  });

  const saveMut = useMutation({
    mutationFn: (e: Editor) => {
      const body = {
        kind: e.kind, title: e.title, body: e.body, imageUrl: e.imageUrl || null,
        ctaLabel: e.ctaLabel || null, ctaUrl: e.ctaUrl || null, ctaColor: e.ctaColor,
        audience: e.audience,
        startsAt: e.startsAtLocal ? new Date(e.startsAtLocal).toISOString() : null,
        endsAt: e.endsAtLocal ? new Date(e.endsAtLocal).toISOString() : null,
        active: e.active,
      };
      return e.id
        ? apiFetch<Promotion>(`/admin/promotions/${e.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiFetch<Promotion>(`/admin/promotions`, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["admin-promotions"] }); qc.invalidateQueries({ queryKey: ["promotions-active"] }); toast({ title: "Promotion saved", description: p.title }); setEditor(fromPromo(p)); },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/promotions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-promotions"] }); setEditor(null); toast({ title: "Deleted" }); },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="h-6 w-6" /> Promotions</h1>
          <p className="text-sm text-muted-foreground">Schedule banners and popups across the public marketing site.</p>
        </div>
        <Button size="sm" onClick={() => setEditor(emptyEditor())}><Plus className="h-4 w-4 mr-1" /> New Promotion</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All promotions ({promos.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> :
            promos.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No promotions yet.</p> :
            <div className="divide-y">
              {promos.map(p => {
                const s = statusFor(p);
                return (
                  <div key={p.id} className="flex items-center gap-3 py-3">
                    <Badge variant="outline" className="capitalize">{p.kind}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{p.title}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                        <Badge variant="outline" className="text-xs">{p.audience === "all" ? "All visitors" : "Logged in"}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.startsAt).toLocaleString()} → {p.endsAt ? new Date(p.endsAt).toLocaleString() : "∞"}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditor(fromPromo(p))}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${p.title}"?`)) deleteMut.mutate(p.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                );
              })}
            </div>
          }
        </CardContent>
      </Card>

      <Dialog open={!!editor} onOpenChange={open => !open && setEditor(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editor?.id ? "Edit Promotion" : "New Promotion"}</DialogTitle></DialogHeader>
          {editor && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <select className="w-full h-9 rounded-md border px-2 text-sm bg-background" value={editor.kind} onChange={e => setEditor({ ...editor, kind: e.target.value as "banner" | "popup" })}>
                  <option value="banner">Top banner</option>
                  <option value="popup">Popup (once per session)</option>
                </select>
              </div>
              <div>
                <Label>Audience</Label>
                <select className="w-full h-9 rounded-md border px-2 text-sm bg-background" value={editor.audience} onChange={e => setEditor({ ...editor, audience: e.target.value as "all" | "loggedIn" })}>
                  <option value="all">All visitors</option>
                  <option value="loggedIn">Logged-in users only</option>
                </select>
              </div>
              <div className="col-span-2"><Label>Title</Label><Input value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })} /></div>
              <div className="col-span-2"><Label>Body</Label><Textarea rows={3} value={editor.body} onChange={e => setEditor({ ...editor, body: e.target.value })} /></div>
              <div className="col-span-2"><Label>Image URL (popup only)</Label><Input value={editor.imageUrl} onChange={e => setEditor({ ...editor, imageUrl: e.target.value })} placeholder="https://…" /></div>
              <div><Label>CTA label</Label><Input value={editor.ctaLabel} onChange={e => setEditor({ ...editor, ctaLabel: e.target.value })} placeholder="Learn more" /></div>
              <div><Label>CTA URL</Label><Input value={editor.ctaUrl} onChange={e => setEditor({ ...editor, ctaUrl: e.target.value })} placeholder="/products" /></div>
              <div><Label>CTA color</Label><Input type="color" value={editor.ctaColor} onChange={e => setEditor({ ...editor, ctaColor: e.target.value })} /></div>
              <div className="flex items-end gap-2"><label className="flex items-center gap-2 text-sm"><Switch checked={editor.active} onCheckedChange={v => setEditor({ ...editor, active: v })} /> Active</label></div>
              <div><Label>Starts at</Label><Input type="datetime-local" value={editor.startsAtLocal} onChange={e => setEditor({ ...editor, startsAtLocal: e.target.value })} /></div>
              <div><Label>Ends at (optional)</Label><Input type="datetime-local" value={editor.endsAtLocal} onChange={e => setEditor({ ...editor, endsAtLocal: e.target.value })} /></div>
              <div className="col-span-2 border rounded p-3 bg-muted/30">
                <div className="text-xs font-medium text-muted-foreground mb-2">Live preview</div>
                {editor.kind === "banner" ? (
                  <div className="rounded p-3 text-white text-sm flex items-center justify-between gap-3" style={{ background: editor.ctaColor }}>
                    <span className="font-medium">{editor.title || "Banner title"}</span>
                    {editor.ctaLabel && <a href={editor.ctaUrl || "#"} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs">{editor.ctaLabel}</a>}
                  </div>
                ) : (
                  <div className="rounded border bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 p-4 max-w-sm mx-auto shadow">
                    {editor.imageUrl && <img src={editor.imageUrl} alt="" className="rounded mb-2 max-h-40 object-cover w-full" />}
                    <div className="font-bold mb-1">{editor.title || "Popup title"}</div>
                    <div className="text-sm mb-3 whitespace-pre-wrap">{editor.body || "Popup body"}</div>
                    {editor.ctaLabel && <a className="inline-block px-3 py-1.5 rounded text-white text-sm" style={{ background: editor.ctaColor }} href={editor.ctaUrl || "#"}>{editor.ctaLabel}</a>}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
            <Button disabled={!editor?.title || saveMut.isPending} onClick={() => editor && saveMut.mutate(editor)}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
