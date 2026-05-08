import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Sparkles, Calendar, Image as ImageIcon, Pencil, Star, ExternalLink } from "lucide-react";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  seoTitle: string | null;
  seoDescription: string | null;
  readingTime: number;
  featured: boolean;
  featuredImage: string | null;
  featuredInRss: boolean;
  featuredOrder: number;
  status: string;
  publishedAt: string;
}

const apiBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); msg = j.error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadge(post: BlogPost): { label: string; cls: string } {
  if (post.status === "draft") return { label: "Draft", cls: "bg-gray-200 text-gray-800" };
  if (post.status === "scheduled") {
    const ms = new Date(post.publishedAt).getTime() - Date.now();
    const hours = Math.max(0, Math.round(ms / 3_600_000));
    const days = Math.round(hours / 24);
    const rel = days >= 1 ? `in ${days} day${days === 1 ? "" : "s"}` : hours >= 1 ? `in ${hours} hr${hours === 1 ? "" : "s"}` : "soon";
    return { label: `Scheduled · ${rel}`, cls: "bg-amber-100 text-amber-800" };
  }
  return { label: "Published", cls: "bg-green-100 text-green-800" };
}

interface EditorState {
  id?: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tagsCsv: string;
  author: string;
  seoTitle: string;
  seoDescription: string;
  readingTime: number;
  featured: boolean;
  featuredImage: string;
  featuredInRss: boolean;
  featuredOrder: number;
  status: string;
  publishedAtLocal: string;
}

function emptyEditor(): EditorState {
  return {
    title: "", slug: "", excerpt: "", content: "", category: "General",
    tagsCsv: "", author: "Marketing Team", seoTitle: "", seoDescription: "",
    readingTime: 5, featured: false, featuredImage: "", featuredInRss: false, featuredOrder: 0,
    status: "published", publishedAtLocal: toLocalInput(new Date().toISOString()),
  };
}

function fromPost(p: BlogPost): EditorState {
  return {
    id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.content,
    category: p.category, tagsCsv: p.tags.join(", "), author: p.author,
    seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "",
    readingTime: p.readingTime, featured: p.featured, featuredImage: p.featuredImage ?? "",
    featuredInRss: p.featuredInRss, featuredOrder: p.featuredOrder,
    status: p.status, publishedAtLocal: toLocalInput(p.publishedAt),
  };
}

export default function AdminBlogPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-blog", search, statusFilter],
    queryFn: () => {
      const u = new URLSearchParams();
      if (search) u.set("search", search);
      if (statusFilter) u.set("status", statusFilter);
      return apiFetch<{ posts: BlogPost[]; total: number }>(`/admin/blog?${u.toString()}`);
    },
  });

  const posts = data?.posts ?? [];

  const saveMut = useMutation({
    mutationFn: (state: EditorState) => {
      const body = {
        title: state.title,
        slug: state.slug || undefined,
        excerpt: state.excerpt,
        content: state.content,
        category: state.category,
        tags: state.tagsCsv.split(",").map(t => t.trim()).filter(Boolean),
        author: state.author,
        seoTitle: state.seoTitle || null,
        seoDescription: state.seoDescription || null,
        readingTime: state.readingTime,
        featured: state.featured,
        featuredImage: state.featuredImage || null,
        featuredInRss: state.featuredInRss,
        featuredOrder: state.featuredOrder,
        status: state.status,
        publishedAt: state.publishedAtLocal ? new Date(state.publishedAtLocal).toISOString() : null,
      };
      if (state.id) {
        return apiFetch<BlogPost>(`/admin/blog/${state.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      return apiFetch<BlogPost>(`/admin/blog`, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (post) => {
      toast({ title: editor?.id ? "Post updated" : "Post created", description: `${post.title} · ${post.status}` });
      qc.invalidateQueries({ queryKey: ["admin-blog"] });
      setEditor(fromPost(post));
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch<{ success: boolean }>(`/admin/blog/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["admin-blog"] });
      setEditor(null);
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const featureRssMut = useMutation({
    mutationFn: ({ id, featuredInRss, featuredOrder }: { id: number; featuredInRss?: boolean; featuredOrder?: number }) =>
      apiFetch<BlogPost>(`/admin/blog/${id}/featured-rss`, { method: "PATCH", body: JSON.stringify({ featuredInRss, featuredOrder }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog"] }),
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const heroMut = useMutation({
    mutationFn: (id: number) => apiFetch<{ post: BlogPost; imageUrl: string }>(`/admin/blog/${id}/generate-hero`, { method: "POST" }),
    onSuccess: (r) => {
      toast({ title: "Hero image generated" });
      setEditor(prev => prev ? { ...prev, featuredImage: r.imageUrl } : prev);
      qc.invalidateQueries({ queryKey: ["admin-blog"] });
    },
    onError: (e: Error) => toast({ title: "Hero generation failed", description: e.message, variant: "destructive" }),
  });

  const featuredCount = posts.filter(p => p.featuredInRss).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Pencil className="h-6 w-6" /> Blog Editor</h1>
          <p className="text-sm text-muted-foreground">Schedule posts, curate the RSS feed, and generate AI hero images.</p>
        </div>
        <div className="flex gap-2">
          <a href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/rss.xml`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> View RSS</Button>
          </a>
          <Button size="sm" onClick={() => setEditor(emptyEditor())}><Plus className="h-4 w-4 mr-1" /> New Post</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Posts ({data?.total ?? 0})</CardTitle>
          <div className="flex gap-2 mt-2">
            <Input placeholder="Search title or slug…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            <select className="h-9 rounded-md border px-2 text-sm bg-background" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
            </select>
            <Badge variant="outline">{featuredCount}/5 RSS featured</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No posts found.</p>
          ) : (
            <div className="divide-y">
              {posts.map(p => {
                const sb = statusBadge(p);
                return (
                  <div key={p.id} className="flex items-center gap-3 py-3">
                    {p.featuredImage ? (
                      <img src={p.featuredImage} alt="" className="h-12 w-20 object-cover rounded border" />
                    ) : (
                      <div className="h-12 w-20 bg-muted rounded border flex items-center justify-center text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{p.title}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sb.cls}`}>{sb.label}</span>
                        {p.featuredInRss && <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100"><Star className="h-3 w-3 mr-1" />RSS #{p.featuredOrder}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">/{p.slug} · {p.category} · {new Date(p.publishedAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs">
                        <Switch
                          checked={p.featuredInRss}
                          onCheckedChange={(v) => featureRssMut.mutate({ id: p.id, featuredInRss: v })}
                        />
                        <span className="text-muted-foreground">RSS</span>
                      </div>
                      {p.featuredInRss && (
                        <Input
                          type="number"
                          className="w-16 h-8"
                          value={p.featuredOrder}
                          onChange={(e) => featureRssMut.mutate({ id: p.id, featuredOrder: Number(e.target.value) })}
                        />
                      )}
                      <Button variant="outline" size="sm" onClick={() => setEditor(fromPost(p))}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${p.title}"?`)) deleteMut.mutate(p.id); }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editor} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editor?.id ? "Edit Post" : "New Post"}</DialogTitle>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Title</Label>
                  <Input value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })} />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={editor.slug} onChange={e => setEditor({ ...editor, slug: e.target.value })} placeholder="auto from title" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={editor.category} onChange={e => setEditor({ ...editor, category: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Excerpt</Label>
                  <Textarea rows={2} value={editor.excerpt} onChange={e => setEditor({ ...editor, excerpt: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Content (HTML)</Label>
                  <Textarea rows={10} value={editor.content} onChange={e => setEditor({ ...editor, content: e.target.value })} className="font-mono text-xs" />
                </div>
                <div>
                  <Label>Author</Label>
                  <Input value={editor.author} onChange={e => setEditor({ ...editor, author: e.target.value })} />
                </div>
                <div>
                  <Label>Tags (comma separated)</Label>
                  <Input value={editor.tagsCsv} onChange={e => setEditor({ ...editor, tagsCsv: e.target.value })} />
                </div>
                <div>
                  <Label>SEO Title</Label>
                  <Input value={editor.seoTitle} onChange={e => setEditor({ ...editor, seoTitle: e.target.value })} />
                </div>
                <div>
                  <Label>Reading Time (min)</Label>
                  <Input type="number" value={editor.readingTime} onChange={e => setEditor({ ...editor, readingTime: Number(e.target.value) })} />
                </div>
                <div className="col-span-2">
                  <Label>SEO Description</Label>
                  <Textarea rows={2} value={editor.seoDescription} onChange={e => setEditor({ ...editor, seoDescription: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Publish at (local time)</Label>
                  <Input type="datetime-local" value={editor.publishedAtLocal} onChange={e => setEditor({ ...editor, publishedAtLocal: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Set a future time to schedule. Leaving status as "draft" keeps it unpublished regardless.</p>
                </div>
                <div>
                  <Label>Status override</Label>
                  <select className="w-full h-9 rounded-md border px-2 text-sm bg-background" value={editor.status} onChange={e => setEditor({ ...editor, status: e.target.value })}>
                    <option value="published">Auto (publish/schedule by date)</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 text-sm"><Switch checked={editor.featured} onCheckedChange={(v) => setEditor({ ...editor, featured: v })} /> Site featured</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={editor.featuredInRss} onCheckedChange={(v) => setEditor({ ...editor, featuredInRss: v })} /> RSS featured</label>
                </div>
                <div className="col-span-2">
                  <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Featured image URL</Label>
                  <div className="flex gap-2">
                    <Input value={editor.featuredImage} onChange={e => setEditor({ ...editor, featuredImage: e.target.value })} placeholder="https://…" />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!editor.id || heroMut.isPending}
                      onClick={() => editor.id && heroMut.mutate(editor.id)}
                    >
                      {heroMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      <span className="ml-1">Generate hero image</span>
                    </Button>
                  </div>
                  {!editor.id && <p className="text-xs text-muted-foreground mt-1">Save the post first, then generate.</p>}
                  {editor.featuredImage && (
                    <img src={editor.featuredImage} alt="" className="mt-2 max-h-48 rounded border" />
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
            <Button disabled={!editor?.title || saveMut.isPending} onClick={() => editor && saveMut.mutate(editor)}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
