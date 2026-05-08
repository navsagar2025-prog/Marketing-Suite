const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

export const trackGa4Event = (name: string, params?: Record<string, unknown>): void => {
  try {
    fetch(`${apiBase}/api/track/ga4`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ events: [{ name, params: params ?? {} }] }),
    }).catch(() => {});
  } catch {}
};
