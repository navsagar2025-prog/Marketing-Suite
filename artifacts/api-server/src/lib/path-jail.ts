import path from "node:path";
import fs from "node:fs/promises";

export const FILES_BASE_DIR = process.env.FILES_BASE_DIR
  ? path.resolve(process.env.FILES_BASE_DIR)
  : path.resolve(process.cwd(), "data", "user-files");

function sanitizeSegment(seg: string): string {
  return seg.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "user";
}

export function userHomeDir(user: { id: number; username: string; homeDir?: string | null }): string {
  if (user.homeDir && user.homeDir.trim()) {
    const parts = user.homeDir
      .split(/[\\/]+/)
      .filter(p => p && p !== "." && p !== "..")
      .map(sanitizeSegment);
    if (parts.length > 0) return path.resolve(FILES_BASE_DIR, ...parts);
  }
  return path.resolve(FILES_BASE_DIR, sanitizeSegment(user.username));
}

export async function ensureHomeDir(home: string): Promise<void> {
  await fs.mkdir(home, { recursive: true });
}

export class PathJailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathJailError";
  }
}

export function resolveJailed(home: string, relPath: string | undefined | null): string {
  const rel = (relPath ?? "").replace(/^[/\\]+/, "");
  if (rel.split(/[\\/]+/).some(p => p === "..")) {
    throw new PathJailError("Path traversal not allowed");
  }
  const resolved = path.resolve(home, rel);
  const homeWithSep = home.endsWith(path.sep) ? home : home + path.sep;
  if (resolved !== home && !resolved.startsWith(homeWithSep)) {
    throw new PathJailError("Path escapes user home directory");
  }
  return resolved;
}

export function toRelative(home: string, absPath: string): string {
  const rel = path.relative(home, absPath);
  return rel.split(path.sep).join("/");
}

export function safeZipEntryPath(home: string, baseAbs: string, entryName: string): string {
  const cleaned = entryName.replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned.split("/").some(p => p === "..")) {
    throw new PathJailError(`Zip entry path escapes: ${entryName}`);
  }
  const target = path.resolve(baseAbs, cleaned);
  const homeWithSep = home.endsWith(path.sep) ? home : home + path.sep;
  if (target !== home && !target.startsWith(homeWithSep)) {
    throw new PathJailError(`Zip entry escapes home: ${entryName}`);
  }
  return target;
}

export async function dirSize(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        total += await dirSize(full);
      } else if (e.isFile()) {
        const st = await fs.stat(full);
        total += st.size;
      }
    }
  } catch {
  }
  return total;
}

const TEXT_EXTS = new Set([
  ".txt", ".md", ".markdown", ".json", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".css", ".scss", ".sass", ".less", ".html", ".htm", ".xml", ".svg", ".yml", ".yaml",
  ".csv", ".tsv", ".log", ".env", ".ini", ".toml", ".conf", ".sh", ".bash", ".zsh",
  ".py", ".rb", ".go", ".rs", ".java", ".c", ".cc", ".cpp", ".h", ".hpp", ".php",
  ".sql", ".graphql", ".vue", ".svelte", ".astro", ".gitignore", ".dockerignore",
]);

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif"]);

export function isTextFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  if (TEXT_EXTS.has(ext)) return true;
  if (!ext && (name === "Dockerfile" || name === "Makefile" || name === "README")) return true;
  return false;
}

export function isImageFile(name: string): boolean {
  return IMAGE_EXTS.has(path.extname(name).toLowerCase());
}

export function isZipFile(name: string): boolean {
  return path.extname(name).toLowerCase() === ".zip";
}
