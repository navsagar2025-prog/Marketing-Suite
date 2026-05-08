import { useEffect } from "react";
import { useLocation } from "wouter";
import { isTrackablePublicRoute } from "@/lib/marketing-routes";
import { trackGa4Event } from "@/lib/ga4";

const HEARTBEAT_MS = 30_000;
const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

const post = (path: string, body: unknown): void => {
  try {
    fetch(`${apiBase}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      keepalive: true,
    }).catch(() => {});
  } catch {}
};

export function PageViewTracker(): null {
  const [location] = useLocation();

  useEffect(() => {
    if (!isTrackablePublicRoute(location)) return;
    post("/api/track/pageview", { path: location, referrer: document.referrer || null });
    trackGa4Event("page_view", { page_location: window.location.href, page_path: location, page_referrer: document.referrer || undefined });
  }, [location]);

  useEffect(() => {
    if (!isTrackablePublicRoute(location)) return;
    const beat = (): void => {
      if (document.visibilityState !== "visible") return;
      post("/api/track/heartbeat", {});
    };
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [location]);

  return null;
}
