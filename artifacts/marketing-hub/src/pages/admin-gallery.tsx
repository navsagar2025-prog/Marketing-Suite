import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus, Image as ImageIcon, Pencil } from "lucide-react";
import { apiFetch, type GalleryImage } from "@/lib/catalog-api";

const TYPES: Array<{ value: "main" | "secondary" | "slider"; label: string; help: string }> = [
  { value: "main", label: "Main Gallery", help: "Primary visitor-facing gallery shown on /gallery." },
  { value: "secondary", label: "Secondary Gallery", help: "Supplementary gallery for archives or campaigns." },
  { value: "slider", label: "Homepage Slider", help: "Auto-rotating carousel on the homepage hero area." },
];

function GalleryTab({ type }: { type: "main" | "secondary" | "slider" }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<GalleryImage | null>(null);
  const [bulkUrls, setBulkUrls] = useState("");
  const [caption, setCaption] = useState("");
  const [categoryTag, setCategoryTag] = useState("");
  const [locationTag, setLocationTag] = useState("");

  const { data: images = [], isLoading } = useQuery({
    queryKey: ["admin-gallery", type],
    queryFn: () => apiFetch<GalleryImage[]>(`/admin/gallery?type=${type}`),
  });

  const addMut = useMutation({
    mutationFn: () => apiFetch(`/admin/gallery`, {
      method: "POST",
      body: JSON.stringify({
        galleryType: type,
        urls: bulkUrls.split("\n").map(s => s.trim()).filter(Boolean),
        caption: caption || null, categoryTag: categoryTag || null, locationTag: locationTag || null,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gallery", type] });
      qc.invalidateQueries({ queryKey: ["public-gallery"] });
      setAdding(false); setBulkUrls(""); setCaption(""); setCategoryTag(""); setLocationTag("");
      toast({ title: "Images added" });
    },
    onError: (e: Error) => toast({ title: "Add failed", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (img: GalleryImage) => apiFetch(`/admin/gallery/${img.id}`, {
      method: "PATCH",
      body: JSON.stringify({ caption: img.caption, categoryTag: img.categoryTag, locationTag: img.locationTag, sortOrder: img.sortOrder }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-gallery", type] }); setEditing(null); toast({ title: "Updated" }); },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/gallery/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-gallery", type] }); toast({ title: "Deleted" }); },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const meta = TYPES.find(t => t.value === type)!;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{meta.label} ({images.length})</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{meta.help}</p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" /> Add Images</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> :
          images.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No images yet.</p> :
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map(img => (
              <div key={img.id} className="border rounded overflow-hidden group relative">
                <img src={img.url} alt={img.caption ?? ""} className="aspect-square object-cover w-full" />
                <div className="p-2 text-xs">
                  {img.caption && <div className="font-medium truncate">{img.caption}</div>}
                  <div className="text-muted-foreground truncate">{[img.categoryTag, img.locationTag].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => setEditing(img)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => { if (confirm("Delete image?")) deleteMut.mutate(img.id); }}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        }
      </CardContent>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add to {meta.label}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Image URLs (one per line)</Label>
              <Textarea rows={6} value={bulkUrls} onChange={e => setBulkUrls(e.target.value)} placeholder="https://…&#10;https://…" />
              <p className="text-xs text-muted-foreground mt-1">Paste multiple image URLs to bulk-add. They share the same caption / tags below.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Caption</Label><Input value={caption} onChange={e => setCaption(e.target.value)} /></div>
              <div><Label>Category tag</Label><Input value={categoryTag} onChange={e => setCategoryTag(e.target.value)} placeholder="e.g. Outdoor" /></div>
              <div><Label>Location tag</Label><Input value={locationTag} onChange={e => setLocationTag(e.target.value)} placeholder="e.g. NYC" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button disabled={!bulkUrls.trim() || addMut.isPending} onClick={() => addMut.mutate()}>
              {addMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Image</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <img src={editing.url} alt="" className="max-h-48 rounded border mx-auto" />
              <div><Label>Caption</Label><Input value={editing.caption ?? ""} onChange={e => setEditing({ ...editing, caption: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Category tag</Label><Input value={editing.categoryTag ?? ""} onChange={e => setEditing({ ...editing, categoryTag: e.target.value })} /></div>
                <div><Label>Location tag</Label><Input value={editing.locationTag ?? ""} onChange={e => setEditing({ ...editing, locationTag: e.target.value })} /></div>
              </div>
              <div><Label>Sort order</Label><Input type="number" value={editing.sortOrder} onChange={e => setEditing({ ...editing, sortOrder: Number(e.target.value) })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={updateMut.isPending} onClick={() => editing && updateMut.mutate(editing)}>
              {updateMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function AdminGalleryPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ImageIcon className="h-6 w-6" /> Galleries</h1>
        <p className="text-sm text-muted-foreground">Curate the three image galleries shown across the public site.</p>
      </div>
      <Tabs defaultValue="main">
        <TabsList>
          {TYPES.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
        {TYPES.map(t => (
          <TabsContent key={t.value} value={t.value} className="mt-4"><GalleryTab type={t.value} /></TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
