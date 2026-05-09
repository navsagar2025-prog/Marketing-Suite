import geoip from "geoip-lite";

const cache = new Map<string, { country: string | null; expires: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 5000;

const normalizeIp = (ip: string | undefined | null): string | null => {
  if (!ip) return null;
  let v = String(ip).trim();
  if (v.startsWith("::ffff:")) v = v.slice(7);
  if (v === "::1" || v === "127.0.0.1" || v.startsWith("10.") || v.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(v)) {
    return null;
  }
  return v;
};

export const lookupCountry = (ip: string | undefined | null): string | null => {
  const v = normalizeIp(ip);
  if (!v) return null;
  const now = Date.now();
  const hit = cache.get(v);
  if (hit && hit.expires > now) return hit.country;
  let country: string | null = null;
  try {
    const r = geoip.lookup(v);
    country = r?.country ?? null;
  } catch {
    country = null;
  }
  if (cache.size >= CACHE_MAX) {
    const cutoff = now;
    for (const [k, val] of cache) {
      if (val.expires < cutoff) cache.delete(k);
      if (cache.size < CACHE_MAX) break;
    }
    if (cache.size >= CACHE_MAX) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  }
  cache.set(v, { country, expires: now + CACHE_TTL_MS });
  return country;
};
