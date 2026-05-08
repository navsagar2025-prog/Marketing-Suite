import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, type GalleryImage } from "@/lib/catalog-api";

export function HomeSlider() {
  const { data } = useQuery({
    queryKey: ["gallery", "slider"],
    queryFn: () => apiFetch<GalleryImage[]>("/api/gallery?type=slider"),
    staleTime: 60_000,
  });
  const images = data ?? [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % images.length), 5000);
    return () => clearInterval(t);
  }, [images.length]);

  if (!images.length) return null;
  const current = images[idx]!;
  return (
    <div className="relative w-full h-64 sm:h-80 overflow-hidden bg-muted">
      <img
        key={current.id}
        src={current.url}
        alt={current.caption ?? ""}
        className="w-full h-full object-cover transition-opacity duration-700"
      />
      {current.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white p-4">
          <p className="text-sm font-medium">{current.caption}</p>
        </div>
      )}
      {images.length > 1 && (
        <div className="absolute bottom-2 right-2 flex gap-1">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-2 w-2 rounded-full ${i === idx ? "bg-white" : "bg-white/40"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
