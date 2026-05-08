import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import archiver from "archiver";
import unzipper from "unzipper";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import { db } from "@workspace/db";
import { staffUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  userHomeDir,
  ensureHomeDir,
  resolveJailed,
  toRelative,
  safeZipEntryPath,
  dirSize,
  isTextFile,
  PathJailError,
} from "../lib/path-jail.js";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 50 },
});

async function getUserHome(req: Request): Promise<string> {
  if (!req.user) throw new Error("No user");
  const [u] = await db
    .select({ id: staffUsersTable.id, username: staffUsersTable.username, homeDir: staffUsersTable.homeDir })
    .from(staffUsersTable)
    .where(eq(staffUsersTable.id, req.user.id));
  if (!u) throw new Error("User not found");
  const home = userHomeDir(u);
  await ensureHomeDir(home);
  return home;
}

function handleJailError(res: Response, err: unknown): boolean {
  if (err instanceof PathJailError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}

router.get("/files/list", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const rel = (req.query.path as string) ?? "";
    const abs = resolveJailed(home, rel);
    const stat = await fsp.stat(abs).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      res.status(404).json({ error: "Directory not found" });
      return;
    }
    const entries = await fsp.readdir(abs, { withFileTypes: true });
    const items = await Promise.all(entries.map(async e => {
      const full = path.join(abs, e.name);
      const st = await fsp.stat(full).catch(() => null);
      return {
        name: e.name,
        path: toRelative(home, full),
        isDirectory: e.isDirectory(),
        size: st?.size ?? 0,
        modifiedAt: st?.mtime.toISOString() ?? null,
      };
    }));
    items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    res.json({ path: toRelative(home, abs), items });
  } catch (err) {
    if (handleJailError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list" });
  }
});

router.get("/files/tree", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    async function walk(abs: string, depth: number): Promise<unknown> {
      const entries = await fsp.readdir(abs, { withFileTypes: true }).catch(() => []);
      const dirs = entries.filter(e => e.isDirectory());
      dirs.sort((a, b) => a.name.localeCompare(b.name));
      const children = depth > 0
        ? await Promise.all(dirs.map(d => walk(path.join(abs, d.name), depth - 1)))
        : [];
      return {
        name: path.basename(abs) || "/",
        path: toRelative(home, abs),
        children,
      };
    }
    const tree = await walk(home, 5);
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load tree" });
  }
});

router.post("/files/upload", upload.array("files"), async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const rel = (req.body.path as string) ?? "";
    const absDir = resolveJailed(home, rel);
    await fsp.mkdir(absDir, { recursive: true });
    const files = (req.files as Express.Multer.File[]) ?? [];
    const saved: string[] = [];
    for (const f of files) {
      const safeName = f.originalname.replace(/[/\\]/g, "_");
      const target = resolveJailed(home, path.join(rel, safeName));
      await fsp.writeFile(target, f.buffer);
      saved.push(toRelative(home, target));
    }
    res.json({ saved });
  } catch (err) {
    if (handleJailError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

router.post("/files/folder", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const { path: parent, name } = req.body as { path?: string; name?: string };
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Folder name required" });
      return;
    }
    const safe = name.replace(/[/\\]/g, "_").trim();
    const abs = resolveJailed(home, path.join(parent ?? "", safe));
    await fsp.mkdir(abs, { recursive: false });
    res.json({ path: toRelative(home, abs) });
  } catch (err) {
    if (handleJailError(res, err)) return;
    if (err instanceof Error && err.message.includes("EEXIST")) {
      res.status(409).json({ error: "Folder already exists" });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create folder" });
  }
});

router.post("/files/rename", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const { path: rel, newName } = req.body as { path?: string; newName?: string };
    if (!rel || !newName) {
      res.status(400).json({ error: "path and newName required" });
      return;
    }
    const safe = newName.replace(/[/\\]/g, "_").trim();
    const src = resolveJailed(home, rel);
    const dst = resolveJailed(home, path.join(path.dirname(rel), safe));
    await fsp.rename(src, dst);
    res.json({ path: toRelative(home, dst) });
  } catch (err) {
    if (handleJailError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Rename failed" });
  }
});

router.post("/files/move", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const { paths, destination } = req.body as { paths?: string[]; destination?: string };
    if (!Array.isArray(paths) || paths.length === 0) {
      res.status(400).json({ error: "paths required" });
      return;
    }
    const dstDir = resolveJailed(home, destination ?? "");
    const dstStat = await fsp.stat(dstDir).catch(() => null);
    if (!dstStat || !dstStat.isDirectory()) {
      res.status(400).json({ error: "Destination is not a directory" });
      return;
    }
    const moved: string[] = [];
    for (const rel of paths) {
      const src = resolveJailed(home, rel);
      const target = resolveJailed(home, path.join(destination ?? "", path.basename(rel)));
      if (src === target) continue;
      await fsp.rename(src, target);
      moved.push(toRelative(home, target));
    }
    res.json({ moved });
  } catch (err) {
    if (handleJailError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Move failed" });
  }
});

router.post("/files/delete", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const { paths } = req.body as { paths?: string[] };
    if (!Array.isArray(paths) || paths.length === 0) {
      res.status(400).json({ error: "paths required" });
      return;
    }
    let deleted = 0;
    for (const rel of paths) {
      const abs = resolveJailed(home, rel);
      if (abs === home) continue;
      await fsp.rm(abs, { recursive: true, force: true });
      deleted++;
    }
    res.json({ deleted });
  } catch (err) {
    if (handleJailError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Delete failed" });
  }
});

router.get("/files/download", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const rel = (req.query.path as string) ?? "";
    const abs = resolveJailed(home, rel);
    const stat = await fsp.stat(abs).catch(() => null);
    if (!stat) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (stat.isDirectory()) {
      res.status(400).json({ error: "Use /files/download-zip for directories" });
      return;
    }
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(abs)}"`);
    res.setHeader("Content-Length", String(stat.size));
    createReadStream(abs).pipe(res);
  } catch (err) {
    if (handleJailError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Download failed" });
  }
});

router.post("/files/download-zip", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const { paths } = req.body as { paths?: string[] };
    if (!Array.isArray(paths) || paths.length === 0) {
      res.status(400).json({ error: "paths required" });
      return;
    }
    const validated = paths.map(p => ({ rel: p, abs: resolveJailed(home, p) }));
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="files-${Date.now()}.zip"`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", err => {
      if (!res.headersSent) res.status(500).json({ error: err.message });
      else res.destroy(err);
    });
    archive.pipe(res);
    for (const { abs } of validated) {
      const stat = await fsp.stat(abs).catch(() => null);
      if (!stat) continue;
      const name = path.basename(abs);
      if (stat.isDirectory()) {
        archive.directory(abs, name);
      } else {
        archive.file(abs, { name });
      }
    }
    await archive.finalize();
  } catch (err) {
    if (handleJailError(res, err)) return;
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Zip failed" });
    }
  }
});

router.get("/files/text", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const rel = (req.query.path as string) ?? "";
    const abs = resolveJailed(home, rel);
    const stat = await fsp.stat(abs).catch(() => null);
    if (!stat || !stat.isFile()) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    if (stat.size > 5 * 1024 * 1024) {
      res.status(413).json({ error: "File too large to edit (max 5 MB)" });
      return;
    }
    if (!isTextFile(path.basename(abs))) {
      res.status(400).json({ error: "Not a text file" });
      return;
    }
    const content = await fsp.readFile(abs, "utf8");
    res.json({ content, size: stat.size, modifiedAt: stat.mtime.toISOString() });
  } catch (err) {
    if (handleJailError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Read failed" });
  }
});

router.post("/files/text", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const { path: rel, content } = req.body as { path?: string; content?: string };
    if (!rel || typeof content !== "string") {
      res.status(400).json({ error: "path and content required" });
      return;
    }
    const abs = resolveJailed(home, rel);
    if (!isTextFile(path.basename(abs))) {
      res.status(400).json({ error: "Not a text file" });
      return;
    }
    if (content.length > 5 * 1024 * 1024) {
      res.status(413).json({ error: "Content too large (max 5 MB)" });
      return;
    }
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, content, "utf8");
    const st = await fsp.stat(abs);
    res.json({ size: st.size, modifiedAt: st.mtime.toISOString() });
  } catch (err) {
    if (handleJailError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Save failed" });
  }
});

router.post("/files/extract-zip", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const { path: rel } = req.body as { path?: string };
    if (!rel) {
      res.status(400).json({ error: "path required" });
      return;
    }
    const abs = resolveJailed(home, rel);
    const stat = await fsp.stat(abs).catch(() => null);
    if (!stat || !stat.isFile()) {
      res.status(404).json({ error: "Zip not found" });
      return;
    }
    if (path.extname(abs).toLowerCase() !== ".zip") {
      res.status(400).json({ error: "Not a .zip file" });
      return;
    }
    const baseAbs = path.dirname(abs);
    let extracted = 0;
    const directory = await unzipper.Open.file(abs);
    for (const entry of directory.files) {
      if (entry.type === "Directory") continue;
      const target = safeZipEntryPath(home, baseAbs, entry.path);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await new Promise<void>((resolve, reject) => {
        entry.stream()
          .pipe(fs.createWriteStream(target))
          .on("finish", resolve)
          .on("error", reject);
      });
      extracted++;
    }
    res.json({ extracted, into: toRelative(home, baseAbs) });
  } catch (err) {
    if (handleJailError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Extract failed" });
  }
});

router.get("/files/usage", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const bytes = await dirSize(home);
    res.json({ bytes, home: path.basename(home) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Usage failed" });
  }
});

const IMAGE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon", avif: "image/avif",
};

router.get("/files/preview", async (req, res): Promise<void> => {
  try {
    const home = await getUserHome(req);
    const rel = (req.query.path as string) ?? "";
    const abs = resolveJailed(home, rel);
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    const mime = IMAGE_MIME[ext];
    if (!mime) {
      res.status(415).json({ error: "Preview is only available for image files" });
      return;
    }
    const stat = await fsp.stat(abs).catch(() => null);
    if (!stat || !stat.isFile()) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Cache-Control", "private, max-age=60");
    res.setHeader("X-Content-Type-Options", "nosniff");
    createReadStream(abs).pipe(res);
  } catch (err) {
    if (handleJailError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Preview failed" });
  }
});

export default router;
