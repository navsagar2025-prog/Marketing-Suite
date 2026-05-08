import { useEffect } from "react";
import { useLocation } from "wouter";
import { isMarketingRoute } from "@/lib/marketing-routes";

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
    if (!isMarketingRoute(location)) return;
    post("/api/track/pageview", { path: location, referrer: document.referrer || null });
  }, [location]);

  useEffect(() => {
    if (!isMarketingRoute(location)) return;
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
