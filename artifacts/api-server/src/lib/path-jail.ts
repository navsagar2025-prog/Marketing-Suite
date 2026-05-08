import path from "node:path";

export function resolveSafePath(baseDir: string, candidate: string): string {
  const normalizedBase = path.resolve(baseDir);
  const target = path.resolve(normalizedBase, candidate);
  const rel = path.relative(normalizedBase, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path escapes base directory");
  }
  return target;
}

export function isPathInside(baseDir: string, candidate: string): boolean {
  try {
    resolveSafePath(baseDir, candidate);
    return true;
  } catch {
    return false;
  }
}

export function safeZipEntryName(name: string): string {
  if (!name) throw new Error("Empty zip entry name");
  if (name.includes("\0")) throw new Error("Null byte in zip entry name");
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) {
    throw new Error("Absolute zip entry path not allowed");
  }
  const parts = normalized.split("/").filter(Boolean);
  for (const part of parts) {
    if (part === "..") throw new Error("Zip entry traverses parent directory");
  }
  return parts.join("/");
}
