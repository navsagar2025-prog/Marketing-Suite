export const apiBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json() as { error?: string }; msg = j.error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface Brand { id: number; name: string; slug: string; logoUrl: string | null; websiteUrl: string | null; description: string | null; }
export interface ProductImage { id: number; url: string; alt: string | null; sortOrder: number; }
export interface Product {
  id: number; name: string; slug: string; description: string; shortDescription: string | null;
  price: string | null; brandId: number | null; category: string;
  features: Array<{ key: string; value: string }> | unknown[];
  heroImage: string | null; active: boolean; createdAt: string;
  images?: ProductImage[]; brand?: Brand | null; jsonLd?: unknown;
}
export interface GalleryImage {
  id: number; galleryType: string; url: string; caption: string | null;
  categoryTag: string | null; locationTag: string | null; sortOrder: number; createdAt: string;
}
export interface Promotion {
  id: number; kind: "banner" | "popup"; title: string; body: string; imageUrl: string | null;
  ctaLabel: string | null; ctaUrl: string | null; ctaColor: string;
  audience: "all" | "loggedIn"; startsAt: string; endsAt: string | null; active: boolean;
}
