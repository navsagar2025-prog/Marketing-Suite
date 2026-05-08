import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch, type GalleryImage } from "@/lib/catalog-api";

function GalleryGrid({ type }: { type: "main" | "secondary" }) {
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const { data: images = [], isLoading } = useQuery({
    queryKey: ["public-gallery", type],
    queryFn: () => apiFetch<GalleryImage[]>(`/gallery?type=${type}`),
  });
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null);

  const categories = useMemo(() => Array.from(new Set(images.map(i => i.categoryTag).filter(Boolean) as string[])), [images]);
  const locations = useMemo(() => Array.from(new Set(images.map(i => i.locationTag).filter(Boolean) as string[])), [images]);
  const filtered = images.filter(i => (!category || i.categoryTag === category) && (!location || i.locationTag === location));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="h-9 rounded-md border px-2 text-sm bg-background" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="h-9 rounded-md border px-2 text-sm bg-background" value={location} onChange={e => setLocation(e.target.value)}>
          <option value="">All locations</option>
          {locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No images yet.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(img => (
            <button key={img.id} onClick={() => setLightbox(img)} className="block aspect-square overflow-hidden rounded border hover:shadow-md transition">
              <img src={img.url} alt={img.caption ?? ""} className="h-full w-full object-cover hover:scale-105 transition" />
            </button>
          ))}
        </div>
      )}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightbox(null)}>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.caption ?? ""} className="w-full max-h-[80vh] object-contain rounded" />
            {(lightbox.caption || lightbox.categoryTag || lightbox.locationTag) && (
              <div className="bg-white/90 dark:bg-gray-900/90 rounded mt-2 p-3 text-sm">
                {lightbox.caption && <div className="font-medium">{lightbox.caption}</div>}
                <div className="text-xs text-muted-foreground">{[lightbox.categoryTag, lightbox.locationTag].filter(Boolean).join(" · ")}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Slider() {
  const { data: images = [] } = useQuery({
    queryKey: ["public-gallery", "slider"],
    queryFn: () => apiFetch<GalleryImage[]>("/gallery?type=slider"),
  });
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % images.length), 5000);
    return () => clearInterval(t);
  }, [images.length]);

  if (images.length === 0) return null;
  const img = images[idx];
  return (
    <div className="relative w-full aspect-[16/6] overflow-hidden rounded-lg border bg-muted">
      <img key={img.id} src={img.url} alt={img.caption ?? ""} className="absolute inset-0 w-full h-full object-cover" />
      {img.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-3 text-sm">{img.caption}</div>}
      {images.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={() => setIdx(i => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"><ChevronRight className="h-5 w-5" /></button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/40"}`} />)}
          </div>
        </>
      )}
    </div>
  );
}

export default function GalleryPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><ImageIcon className="h-7 w-7" /> Gallery</h1>
        <p className="text-muted-foreground">Browse our photo galleries.</p>
      </div>
      <Slider />
      <Tabs defaultValue="main">
        <TabsList>
          <TabsTrigger value="main">Main</TabsTrigger>
          <TabsTrigger value="secondary">Secondary</TabsTrigger>
        </TabsList>
        <TabsContent value="main" className="mt-4"><GalleryGrid type="main" /></TabsContent>
        <TabsContent value="secondary" className="mt-4"><GalleryGrid type="secondary" /></TabsContent>
      </Tabs>
    </div>
  );
}
