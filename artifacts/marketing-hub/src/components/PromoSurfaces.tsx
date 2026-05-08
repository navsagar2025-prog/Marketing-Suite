import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { apiFetch, type Promotion } from "@/lib/catalog-api";

const DISMISSED_BANNER_KEY = "promo_banner_dismissed";
const SHOWN_POPUP_KEY = "promo_popup_shown";

function safeUrl(u: string | null): string | null {
  if (!u) return null;
  const s = u.trim();
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

function useActivePromotions(_audience: "all" | "loggedIn") {
  return useQuery({
    queryKey: ["promotions-active"],
    queryFn: () => apiFetch<Promotion[]>(`/promotions/active`),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
}

function dismissedSet(key: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function markDismissed(key: string, id: number): void {
  const s = dismissedSet(key);
  s.add(String(id));
  try { sessionStorage.setItem(key, JSON.stringify(Array.from(s))); } catch { /* ignore */ }
}

export function PromoBanner({ audience }: { audience: "all" | "loggedIn" }) {
  const { data: promos = [] } = useActivePromotions(audience);
  const [tick, setTick] = useState(0);

  const banners = promos.filter(p => p.kind === "banner");
  const dismissed = dismissedSet(DISMISSED_BANNER_KEY);
  const visible = banners.find(p => !dismissed.has(String(p.id)));

  useEffect(() => { setTick(t => t + 1); }, [promos.length]);
  void tick;

  if (!visible) return null;
  const ctaHref = safeUrl(visible.ctaUrl);
  return (
    <div className="w-full text-white text-sm flex items-center justify-center gap-3 px-4 py-2" style={{ background: visible.ctaColor }}>
      <span className="font-medium">{visible.title}</span>
      {visible.body && <span className="opacity-90 hidden sm:inline">— {visible.body}</span>}
      {visible.ctaLabel && ctaHref && (
        <a href={ctaHref} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs whitespace-nowrap">{visible.ctaLabel}</a>
      )}
      <button
        onClick={() => { markDismissed(DISMISSED_BANNER_KEY, visible.id); setTick(t => t + 1); }}
        className="ml-auto opacity-80 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PromoPopup({ audience }: { audience: "all" | "loggedIn" }) {
  const { data: promos = [] } = useActivePromotions(audience);
  const [open, setOpen] = useState<Promotion | null>(null);

  useEffect(() => {
    const popups = promos.filter(p => p.kind === "popup");
    if (popups.length === 0) return;
    const shown = dismissedSet(SHOWN_POPUP_KEY);
    const next = popups.find(p => !shown.has(String(p.id)));
    if (next) {
      const t = setTimeout(() => {
        setOpen(next);
        markDismissed(SHOWN_POPUP_KEY, next.id);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [promos]);

  if (!open) return null;
  const popupHref = safeUrl(open.ctaUrl);
  const popupImg = safeUrl(open.imageUrl);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full overflow-hidden relative" onClick={e => e.stopPropagation()}>
        <button onClick={() => setOpen(null)} className="absolute top-2 right-2 p-1 rounded-full bg-black/40 text-white hover:bg-black/60 z-10" aria-label="Close"><X className="h-4 w-4" /></button>
        {popupImg && <img src={popupImg} alt="" className="w-full max-h-56 object-cover" />}
        <div className="p-5 space-y-3">
          <h3 className="text-lg font-bold">{open.title}</h3>
          {open.body && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{open.body}</p>}
          {open.ctaLabel && popupHref && (
            <a href={popupHref} className="inline-block px-4 py-2 rounded text-white font-medium text-sm" style={{ background: open.ctaColor }}>
              {open.ctaLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
