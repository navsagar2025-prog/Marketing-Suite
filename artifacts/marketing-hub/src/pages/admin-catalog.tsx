import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Pencil, Sparkles, Package, Tag, Image as ImageIcon } from "lucide-react";
import { apiFetch, type Brand, type Product, type ProductImage } from "@/lib/catalog-api";

interface BrandEditor { id?: number; name: string; slug: string; logoUrl: string; websiteUrl: string; description: string; }
function emptyBrand(): BrandEditor { return { name: "", slug: "", logoUrl: "", websiteUrl: "", description: "" }; }

interface FeatureRow { key: string; value: string; }
interface ProductEditor {
  id?: number;
  name: string; slug: string; description: string; shortDescription: string;
  price: string; brandId: string; category: string;
  features: FeatureRow[];
  images: ProductImage[];
  heroImage: string;
  active: boolean;
}
function emptyProduct(): ProductEditor {
  return { name: "", slug: "", description: "", shortDescription: "", price: "", brandId: "", category: "General", features: [], images: [], heroImage: "", active: true };
}
function fromProduct(p: Product): ProductEditor {
  const featuresArr = Array.isArray(p.features) ? p.features as FeatureRow[] : [];
  return {
    id: p.id, name: p.name, slug: p.slug, description: p.description, shortDescription: p.shortDescription ?? "",
    price: p.price ?? "", brandId: p.brandId?.toString() ?? "", category: p.category,
    features: featuresArr.filter(f => f && typeof f === "object" && "key" in f).map(f => ({ key: String(f.key ?? ""), value: String(f.value ?? "") })),
    images: p.images ?? [], heroImage: p.heroImage ?? "", active: p.active,
  };
}

function BrandsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editor, setEditor] = useState<BrandEditor | null>(null);
  const { data: brands = [], isLoading } = useQuery({ queryKey: ["admin-brands"], queryFn: () => apiFetch<Brand[]>("/admin/brands") });

  const saveMut = useMutation({
    mutationFn: (b: BrandEditor) => {
      const body = { name: b.name, slug: b.slug || undefined, logoUrl: b.logoUrl || null, websiteUrl: b.websiteUrl || null, description: b.description || null };
      return b.id
        ? apiFetch<Brand>(`/admin/brands/${b.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiFetch<Brand>(`/admin/brands`, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-brands"] }); qc.invalidateQueries({ queryKey: ["public-brands"] }); setEditor(null); toast({ title: "Brand saved" }); },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/brands/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-brands"] }); toast({ title: "Brand deleted" }); },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" /> Brands ({brands.length})</CardTitle>
        <Button size="sm" onClick={() => setEditor(emptyBrand())}><Plus className="h-4 w-4 mr-1" /> New Brand</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> :
          brands.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No brands yet.</p> :
          <div className="divide-y">
            {brands.map(b => (
              <div key={b.id} className="flex items-center gap-3 py-3">
                {b.logoUrl ? <img src={b.logoUrl} alt="" className="h-10 w-10 object-contain rounded border bg-white" /> : <div className="h-10 w-10 rounded border flex items-center justify-center bg-muted"><Tag className="h-4 w-4" /></div>}
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground">/{b.slug} {b.websiteUrl && `· ${b.websiteUrl}`}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditor({ id: b.id, name: b.name, slug: b.slug, logoUrl: b.logoUrl ?? "", websiteUrl: b.websiteUrl ?? "", description: b.description ?? "" })}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${b.name}"?`)) deleteMut.mutate(b.id); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        }
      </CardContent>
      <Dialog open={!!editor} onOpenChange={open => !open && setEditor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editor?.id ? "Edit Brand" : "New Brand"}</DialogTitle></DialogHeader>
          {editor && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={editor.slug} onChange={e => setEditor({ ...editor, slug: e.target.value })} placeholder="auto from name" /></div>
              <div><Label>Logo URL</Label><Input value={editor.logoUrl} onChange={e => setEditor({ ...editor, logoUrl: e.target.value })} /></div>
              <div><Label>Website</Label><Input value={editor.websiteUrl} onChange={e => setEditor({ ...editor, websiteUrl: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea rows={3} value={editor.description} onChange={e => setEditor({ ...editor, description: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
            <Button disabled={!editor?.name || saveMut.isPending} onClick={() => editor && saveMut.mutate(editor)}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ProductsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editor, setEditor] = useState<ProductEditor | null>(null);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", search],
    queryFn: () => apiFetch<{ products: Product[]; total: number }>(`/admin/products${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
  const { data: brands = [] } = useQuery({ queryKey: ["admin-brands"], queryFn: () => apiFetch<Brand[]>("/admin/brands") });
  const products = data?.products ?? [];

  const saveMut = useMutation({
    mutationFn: async (p: ProductEditor) => {
      const body = {
        name: p.name, slug: p.slug || undefined,
        description: p.description, shortDescription: p.shortDescription || null,
        price: p.price || null, brandId: p.brandId ? Number(p.brandId) : null,
        category: p.category, features: p.features.filter(f => f.key.trim()),
        images: p.images.map((im, i) => ({ url: im.url, alt: im.alt, sortOrder: i })),
        heroImage: p.heroImage || null, active: p.active,
      };
      return p.id
        ? apiFetch<Product>(`/admin/products/${p.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiFetch<Product>(`/admin/products`, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["admin-products"] }); qc.invalidateQueries({ queryKey: ["public-products"] }); setEditor(fromProduct(p)); toast({ title: "Product saved", description: p.name }); },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); setEditor(null); toast({ title: "Product deleted" }); },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const heroMut = useMutation({
    mutationFn: (id: number) => apiFetch<{ imageUrl: string }>(`/admin/products/${id}/generate-hero`, { method: "POST" }),
    onSuccess: (r) => { setEditor(prev => prev ? { ...prev, heroImage: r.imageUrl } : prev); qc.invalidateQueries({ queryKey: ["admin-products"] }); toast({ title: "Hero image generated" }); },
    onError: (e: Error) => toast({ title: "Hero generation failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Products ({data?.total ?? 0})</CardTitle>
          <Button size="sm" onClick={() => setEditor(emptyProduct())}><Plus className="h-4 w-4 mr-1" /> New Product</Button>
        </div>
        <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs mt-2" />
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> :
          products.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No products yet.</p> :
          <div className="divide-y">
            {products.map(p => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                {p.heroImage ? <img src={p.heroImage} alt="" className="h-12 w-12 object-cover rounded border" /> : <div className="h-12 w-12 rounded border flex items-center justify-center bg-muted"><ImageIcon className="h-4 w-4" /></div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{p.name}</span>
                    {!p.active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">/{p.slug} · {p.category}{p.price ? ` · ${p.price}` : ""}</div>
                </div>
                <Button variant="outline" size="sm" onClick={async () => { const full = await apiFetch<Product>(`/admin/products/${p.id}`); setEditor(fromProduct(full)); }}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        }
      </CardContent>
      <Dialog open={!!editor} onOpenChange={open => !open && setEditor(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editor?.id ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
          {editor && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Name</Label><Input value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={editor.slug} onChange={e => setEditor({ ...editor, slug: e.target.value })} placeholder="auto" /></div>
                <div><Label>Category</Label><Input value={editor.category} onChange={e => setEditor({ ...editor, category: e.target.value })} /></div>
                <div><Label>Price</Label><Input value={editor.price} onChange={e => setEditor({ ...editor, price: e.target.value })} placeholder="$99 or 99.00" /></div>
                <div>
                  <Label>Brand</Label>
                  <select className="w-full h-9 rounded-md border px-2 text-sm bg-background" value={editor.brandId} onChange={e => setEditor({ ...editor, brandId: e.target.value })}>
                    <option value="">No brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><Label>Short description</Label><Input value={editor.shortDescription} onChange={e => setEditor({ ...editor, shortDescription: e.target.value })} /></div>
                <div className="col-span-2"><Label>Full description</Label><Textarea rows={5} value={editor.description} onChange={e => setEditor({ ...editor, description: e.target.value })} /></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Features</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditor({ ...editor, features: [...editor.features, { key: "", value: "" }] })}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                </div>
                {editor.features.length === 0 && <p className="text-xs text-muted-foreground">No features. Add key/value pairs (e.g. "Color"/"Black", "Material"/"Aluminum").</p>}
                {editor.features.map((f, i) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <Input placeholder="Key" value={f.key} onChange={e => { const nf = [...editor.features]; nf[i] = { ...nf[i], key: e.target.value }; setEditor({ ...editor, features: nf }); }} />
                    <Input placeholder="Value" value={f.value} onChange={e => { const nf = [...editor.features]; nf[i] = { ...nf[i], value: e.target.value }; setEditor({ ...editor, features: nf }); }} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditor({ ...editor, features: editor.features.filter((_, j) => j !== i) })}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
              <div>
                <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Hero image</Label>
                <div className="flex gap-2">
                  <Input value={editor.heroImage} onChange={e => setEditor({ ...editor, heroImage: e.target.value })} placeholder="https://…" />
                  <Button type="button" variant="outline" disabled={!editor.id || heroMut.isPending} onClick={() => editor.id && heroMut.mutate(editor.id)}>
                    {heroMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} <span className="ml-1">Generate</span>
                  </Button>
                </div>
                {!editor.id && <p className="text-xs text-muted-foreground mt-1">Save first, then generate.</p>}
                {editor.heroImage && <img src={editor.heroImage} alt="" className="mt-2 max-h-48 rounded border" />}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Additional images (paste URLs, one per line)</Label>
                </div>
                <Textarea
                  rows={3}
                  value={editor.images.map(im => im.url).join("\n")}
                  onChange={e => {
                    const urls = e.target.value.split("\n").map(s => s.trim()).filter(Boolean);
                    setEditor({ ...editor, images: urls.map((url, i) => ({ id: 0, url, alt: null, sortOrder: i })) });
                  }}
                  placeholder="https://…&#10;https://…"
                />
                {editor.images.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {editor.images.map((im, i) => <img key={i} src={im.url} alt="" className="h-16 w-16 object-cover rounded border" />)}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editor.active} onCheckedChange={v => setEditor({ ...editor, active: v })} /> Active (visible on public site)</label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
            <Button disabled={!editor?.name || saveMut.isPending} onClick={() => editor && saveMut.mutate(editor)}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function AdminCatalogPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6" /> Catalog</h1>
        <p className="text-sm text-muted-foreground">Manage your product catalog and brands.</p>
      </div>
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-4"><ProductsTab /></TabsContent>
        <TabsContent value="brands" className="mt-4"><BrandsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
