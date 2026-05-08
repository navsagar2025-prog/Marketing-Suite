import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Folder, FolderOpen, FileText, File as FileIcon, Image as ImageIcon, FileArchive,
  Upload, FolderPlus, Download, Trash2, Pencil, ChevronRight, ChevronDown,
  Home, Save, X, Loader2, RefreshCw, ArrowLeft, FileCode, MoveRight,
} from "lucide-react";

const TOKEN_KEY = "auth_token";
const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const apiUrl = (p: string) => `${BASE_URL}${p}`;
function authHeader() { return { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}` }; }

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string | null;
}

interface ListResp {
  path: string;
  items: FileItem[];
}

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
}

const TEXT_EXTS = new Set([
  "txt","md","markdown","json","js","jsx","ts","tsx","mjs","cjs","css","scss","sass","less",
  "html","htm","xml","svg","yml","yaml","csv","tsv","log","env","ini","toml","conf","sh","bash","zsh",
  "py","rb","go","rs","java","c","cc","cpp","h","hpp","php","sql","graphql","vue","svelte","astro",
]);
const IMAGE_EXTS = new Set(["png","jpg","jpeg","gif","webp","svg","bmp","ico","avif"]);

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}
const isText = (n: string) => TEXT_EXTS.has(ext(n));
const isImage = (n: string) => IMAGE_EXTS.has(ext(n));
const isZip = (n: string) => ext(n) === "zip";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function parentOf(p: string): string {
  if (!p) return "";
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

function FileIconFor({ item }: { item: FileItem }) {
  if (item.isDirectory) return <Folder className="h-4 w-4 text-blue-500 shrink-0" />;
  if (isImage(item.name)) return <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (isZip(item.name)) return <FileArchive className="h-4 w-4 text-amber-500 shrink-0" />;
  if (isText(item.name)) return <FileCode className="h-4 w-4 text-violet-500 shrink-0" />;
  return <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function TreeView({ node, depth, currentPath, onSelect, onDropMove }: { node: TreeNode; depth: number; currentPath: string; onSelect: (path: string) => void; onDropMove: (dest: string, paths: string[]) => void }) {
  const [open, setOpen] = useState(depth < 1);
  const [hover, setHover] = useState(false);
  const isActive = node.path === currentPath;
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-1.5 rounded text-sm cursor-pointer hover:bg-muted ${isActive ? "bg-muted font-medium" : ""} ${hover ? "ring-2 ring-primary bg-primary/10" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        onClick={() => { onSelect(node.path); if (hasChildren) setOpen(o => !o); }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          setHover(false);
          const raw = e.dataTransfer.getData("application/x-file-paths");
          if (!raw) return;
          try {
            const paths = JSON.parse(raw) as string[];
            if (Array.isArray(paths) && paths.length > 0) onDropMove(node.path, paths);
          } catch {}
        }}
        data-testid={`tree-node-${node.path || "root"}`}
      >
        {hasChildren ? (
          open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <span className="w-3.5" />
        )}
        {open && hasChildren ? <FolderOpen className="h-4 w-4 text-blue-500" /> : <Folder className="h-4 w-4 text-blue-500" />}
        <span className="truncate">{node.name === "/" ? "Home" : node.name}</span>
      </div>
      {open && node.children.map(c => (
        <TreeView key={c.path} node={c} depth={depth + 1} currentPath={currentPath} onSelect={onSelect} onDropMove={onDropMove} />
      ))}
    </div>
  );
}

interface ContextMenuState {
  x: number;
  y: number;
  item: FileItem;
}

export default function FilesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [currentPath, setCurrentPath] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<{ path: string; value: string } | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editor, setEditor] = useState<{ path: string; content: string; original: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [zipConfirm, setZipConfirm] = useState<string | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ paths: string[] } | null>(null);
  const [moveDest, setMoveDest] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [rowHover, setRowHover] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const { data: tree, refetch: refetchTree } = useQuery<TreeNode>({
    queryKey: ["files-tree"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/files/tree"), { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load tree");
      return res.json();
    },
  });

  const { data: list, isLoading: listLoading, refetch: refetchList } = useQuery<ListResp>({
    queryKey: ["files-list", currentPath],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/files/list?path=${encodeURIComponent(currentPath)}`), { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: usage } = useQuery<{ bytes: number; home: string }>({
    queryKey: ["files-usage"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/files/usage"), { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load usage");
      return res.json();
    },
  });

  useEffect(() => { setSelected(new Set()); }, [currentPath]);

  const refreshAll = useCallback(() => {
    refetchTree();
    refetchList();
    qc.invalidateQueries({ queryKey: ["files-usage"] });
  }, [refetchTree, refetchList, qc]);

  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean);
    const crumbs: { name: string; path: string }[] = [{ name: "Home", path: "" }];
    let acc = "";
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      crumbs.push({ name: p, path: acc });
    }
    return crumbs;
  }, [currentPath]);

  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const fd = new FormData();
    fd.append("path", currentPath);
    for (const f of arr) fd.append("files", f);
    const res = await fetch(apiUrl("/api/files/upload"), { method: "POST", headers: authHeader(), body: fd });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Upload failed", description: d.error, variant: "destructive" });
      return;
    }
    const d = await res.json();
    toast({ title: `Uploaded ${d.saved.length} file${d.saved.length !== 1 ? "s" : ""}` });
    refreshAll();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const res = await fetch(apiUrl("/api/files/folder"), {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ path: currentPath, name }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Failed", description: d.error, variant: "destructive" });
      return;
    }
    setNewFolderOpen(false);
    setNewFolderName("");
    toast({ title: "Folder created" });
    refreshAll();
  };

  const renameItem = async () => {
    if (!renaming || !renaming.value.trim()) return;
    const res = await fetch(apiUrl("/api/files/rename"), {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ path: renaming.path, newName: renaming.value.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Rename failed", description: d.error, variant: "destructive" });
      return;
    }
    setRenaming(null);
    toast({ title: "Renamed" });
    refreshAll();
  };

  const deleteSelected = async () => {
    const paths = Array.from(selected);
    if (paths.length === 0) return;
    if (!window.confirm(`Delete ${paths.length} item${paths.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    const res = await fetch(apiUrl("/api/files/delete"), {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Delete failed", description: d.error, variant: "destructive" });
      return;
    }
    toast({ title: `Deleted ${paths.length} item${paths.length !== 1 ? "s" : ""}` });
    setSelected(new Set());
    refreshAll();
  };

  const downloadZip = async () => {
    const paths = selected.size ? Array.from(selected) : (list?.items ?? []).map(i => i.path);
    if (paths.length === 0) return;
    const res = await fetch(apiUrl("/api/files/download-zip"), {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) {
      toast({ title: "Download failed", variant: "destructive" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `files-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadFile = async (item: FileItem) => {
    const res = await fetch(apiUrl(`/api/files/download?path=${encodeURIComponent(item.path)}`), { headers: authHeader() });
    if (!res.ok) {
      toast({ title: "Download failed", variant: "destructive" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const performMove = async (paths: string[], destination: string) => {
    if (paths.length === 0) return;
    if (paths.some(p => destination === p || destination.startsWith(`${p}/`))) {
      toast({ title: "Cannot move a folder into itself", variant: "destructive" });
      return;
    }
    const res = await fetch(apiUrl("/api/files/move"), {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ paths, destination }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Move failed", description: d.error, variant: "destructive" });
      return;
    }
    toast({ title: `Moved ${paths.length} item${paths.length !== 1 ? "s" : ""}` });
    setMoveDialog(null);
    setMoveDest("");
    setSelected(new Set());
    refreshAll();
  };

  const moveItems = async () => {
    if (!moveDialog) return;
    await performMove(moveDialog.paths, moveDest);
  };

  const onRowDragStart = (item: FileItem, e: React.DragEvent) => {
    const paths = selected.has(item.path) && selected.size > 0 ? Array.from(selected) : [item.path];
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-file-paths", JSON.stringify(paths));
    e.dataTransfer.setData("text/plain", paths.join("\n"));
  };

  const onFolderRowDrop = (folder: FileItem, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRowHover(null);
    const raw = e.dataTransfer.getData("application/x-file-paths");
    if (!raw) return;
    try {
      const paths: string[] = JSON.parse(raw);
      if (paths.includes(folder.path)) return;
      performMove(paths, folder.path);
    } catch {}
  };

  const deleteOne = async (path: string) => {
    if (!window.confirm(`Delete "${path.split("/").pop()}"? This cannot be undone.`)) return;
    const res = await fetch(apiUrl("/api/files/delete"), {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ paths: [path] }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Delete failed", description: d.error, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    setSelected(prev => { const n = new Set(prev); n.delete(path); return n; });
    refreshAll();
  };

  const openItem = async (item: FileItem) => {
    if (item.isDirectory) { setCurrentPath(item.path); return; }
    if (isText(item.name)) {
      const res = await fetch(apiUrl(`/api/files/text?path=${encodeURIComponent(item.path)}`), { headers: authHeader() });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Cannot open", description: d.error, variant: "destructive" });
        return;
      }
      const d = await res.json();
      setEditor({ path: item.path, content: d.content, original: d.content });
      return;
    }
    if (isImage(item.name)) {
      setImagePreview(apiUrl(`/api/files/preview?path=${encodeURIComponent(item.path)}`) + `&t=${Date.now()}`);
      return;
    }
    if (isZip(item.name)) {
      setZipConfirm(item.path);
      return;
    }
    downloadFile(item);
  };

  const saveEditor = async () => {
    if (!editor) return;
    const res = await fetch(apiUrl("/api/files/text"), {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ path: editor.path, content: editor.content }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Save failed", description: d.error, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
    setEditor(prev => prev ? { ...prev, original: prev.content } : null);
    refreshAll();
  };

  const extractZip = async () => {
    if (!zipConfirm) return;
    const res = await fetch(apiUrl("/api/files/extract-zip"), {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ path: zipConfirm }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Extract failed", description: d.error, variant: "destructive" });
      setZipConfirm(null);
      return;
    }
    const d = await res.json();
    toast({ title: `Extracted ${d.extracted} file${d.extracted !== 1 ? "s" : ""}` });
    setZipConfirm(null);
    refreshAll();
  };

  const toggleSelect = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const items = list?.items ?? [];
  const allSelected = items.length > 0 && items.every(i => selected.has(i.path));

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-sm text-muted-foreground">Your private file workspace · {usage ? formatBytes(usage.bytes) : "…"} used</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => e.target.files && uploadFiles(e.target.files)} data-testid="file-upload-input" />
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-upload">
            <Upload className="h-4 w-4 mr-1.5" /> Upload
          </Button>
          <Button size="sm" variant="outline" onClick={() => setNewFolderOpen(true)} data-testid="button-new-folder">
            <FolderPlus className="h-4 w-4 mr-1.5" /> New folder
          </Button>
          <Button size="sm" variant="outline" onClick={downloadZip} disabled={items.length === 0} data-testid="button-download-zip">
            <Download className="h-4 w-4 mr-1.5" /> Download {selected.size > 0 ? `${selected.size} as ZIP` : "all as ZIP"}
          </Button>
          {selected.size > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setMoveDialog({ paths: Array.from(selected) }); setMoveDest(""); }} data-testid="button-move">
                <MoveRight className="h-4 w-4 mr-1.5" /> Move
              </Button>
              <Button size="sm" variant="destructive" onClick={deleteSelected} data-testid="button-delete">
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete {selected.size}
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={refreshAll}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 flex-1 min-h-0">
        <Card className="overflow-auto">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Home className="h-4 w-4" /> Folders</CardTitle></CardHeader>
          <CardContent className="pt-0 px-2">
            {tree ? <TreeView node={tree} depth={0} currentPath={currentPath} onSelect={setCurrentPath} onDropMove={(dest, paths) => performMove(paths, dest)} /> : <div className="text-xs text-muted-foreground p-2">Loading…</div>}
          </CardContent>
        </Card>

        <Card
          className={`flex flex-col overflow-hidden ${dragOver ? "ring-2 ring-primary" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center gap-1 text-sm flex-wrap">
              {currentPath && (
                <Button size="sm" variant="ghost" className="h-6 px-2 mr-1" onClick={() => setCurrentPath(parentOf(currentPath))}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              )}
              {breadcrumbs.map((c, i) => (
                <span key={c.path} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <button
                    onClick={() => setCurrentPath(c.path)}
                    className={`hover:underline ${i === breadcrumbs.length - 1 ? "font-medium" : "text-muted-foreground"}`}
                    data-testid={`breadcrumb-${c.path || "root"}`}
                  >
                    {c.name}
                  </button>
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            {listLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Upload className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">This folder is empty</p>
                <p className="text-xs text-muted-foreground mt-1">Drag files here or click Upload</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="text-xs text-muted-foreground">
                    <th className="w-8 p-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(items.map(i => i.path)))}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="text-left font-medium p-2">Name</th>
                    <th className="text-left font-medium p-2 hidden sm:table-cell w-28">Size</th>
                    <th className="text-left font-medium p-2 hidden md:table-cell w-40">Modified</th>
                    <th className="w-20 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr
                      key={item.path}
                      className={`border-t hover:bg-muted/30 group ${item.isDirectory && rowHover === item.path ? "ring-2 ring-inset ring-primary bg-primary/10" : ""}`}
                      draggable={renaming?.path !== item.path}
                      onDragStart={e => onRowDragStart(item, e)}
                      onDragEnd={() => setRowHover(null)}
                      onDragOver={item.isDirectory ? (e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setRowHover(item.path); }) : undefined}
                      onDragLeave={item.isDirectory ? (() => setRowHover(prev => prev === item.path ? null : prev)) : undefined}
                      onDrop={item.isDirectory ? (e => onFolderRowDrop(item, e)) : undefined}
                      onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item }); }}
                      data-testid={`file-row-${item.path}`}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.has(item.path)}
                          onChange={() => {}}
                          onClick={e => toggleSelect(item.path, e)}
                          aria-label={`Select ${item.name}`}
                        />
                      </td>
                      <td className="p-2">
                        {renaming?.path === item.path ? (
                          <div className="flex gap-1 items-center">
                            <Input
                              value={renaming.value}
                              onChange={e => setRenaming({ ...renaming, value: e.target.value })}
                              onKeyDown={e => { if (e.key === "Enter") renameItem(); if (e.key === "Escape") setRenaming(null); }}
                              className="h-6 text-xs px-2 py-0 max-w-xs"
                              autoFocus
                            />
                            <Button size="sm" className="h-6 px-2 text-xs" onClick={renameItem}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setRenaming(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <button className="flex items-center gap-2 text-left hover:text-primary" onClick={() => openItem(item)}>
                            <FileIconFor item={item} />
                            <span className="truncate">{item.name}</span>
                          </button>
                        )}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground hidden sm:table-cell">{item.isDirectory ? "—" : formatBytes(item.size)}</td>
                      <td className="p-2 text-xs text-muted-foreground hidden md:table-cell">
                        {item.modifiedAt ? new Date(item.modifiedAt).toLocaleString() : "—"}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <Button size="icon" variant="ghost" className="h-6 w-6" title="Rename" onClick={() => setRenaming({ path: item.path, value: item.name })} data-testid={`button-rename-${item.path}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!item.isDirectory && (
                            <Button size="icon" variant="ghost" className="h-6 w-6" title="Download" onClick={() => downloadFile(item)}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") createFolder(); }}
            autoFocus
            data-testid="input-new-folder-name"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button onClick={createFolder} disabled={!newFolderName.trim()} data-testid="button-create-folder">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editor} onOpenChange={open => !open && setEditor(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> {editor?.path}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editor?.content ?? ""}
            onChange={e => editor && setEditor({ ...editor, content: e.target.value })}
            className="font-mono text-xs flex-1 min-h-[400px] resize-none"
            spellCheck={false}
            data-testid="textarea-editor"
          />
          <DialogFooter>
            {editor && editor.content !== editor.original && (
              <span className="text-xs text-muted-foreground mr-auto self-center">Unsaved changes</span>
            )}
            <Button variant="ghost" onClick={() => setEditor(null)}><X className="h-4 w-4 mr-1.5" /> Close</Button>
            <Button onClick={saveEditor} disabled={!editor || editor.content === editor.original} data-testid="button-save-text">
              <Save className="h-4 w-4 mr-1.5" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!imagePreview} onOpenChange={open => !open && setImagePreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Preview</DialogTitle></DialogHeader>
          {imagePreview && <img src={imagePreview} alt="Preview" className="max-h-[70vh] mx-auto" />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!zipConfirm} onOpenChange={open => !open && setZipConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Extract ZIP</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Extract <code className="bg-muted px-1 rounded">{zipConfirm}</code> into the current folder? Existing files with the same names will be overwritten. Entries that try to escape the folder will be rejected.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setZipConfirm(null)}>Cancel</Button>
            <Button onClick={extractZip} data-testid="button-extract-zip"><FileArchive className="h-4 w-4 mr-1.5" /> Extract here</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[180px] text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
          data-testid="file-context-menu"
        >
          <button className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2" onClick={() => { openItem(contextMenu.item); setContextMenu(null); }}>
            <FileText className="h-3.5 w-3.5" /> Open
          </button>
          {!contextMenu.item.isDirectory && (
            <button className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2" onClick={() => { downloadFile(contextMenu.item); setContextMenu(null); }}>
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          )}
          {isZip(contextMenu.item.name) && !contextMenu.item.isDirectory && (
            <button className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2" onClick={() => { setZipConfirm(contextMenu.item.path); setContextMenu(null); }}>
              <FileArchive className="h-3.5 w-3.5" /> Extract here
            </button>
          )}
          <button className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2" onClick={() => { setRenaming({ path: contextMenu.item.path, value: contextMenu.item.name }); setContextMenu(null); }} data-testid="context-rename">
            <Pencil className="h-3.5 w-3.5" /> Rename
          </button>
          <button className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2" onClick={() => { setMoveDialog({ paths: [contextMenu.item.path] }); setMoveDest(""); setContextMenu(null); }} data-testid="context-move">
            <MoveRight className="h-3.5 w-3.5" /> Move to…
          </button>
          <div className="h-px bg-border my-1" />
          <button className="w-full text-left px-3 py-1.5 hover:bg-muted text-destructive flex items-center gap-2" onClick={() => { deleteOne(contextMenu.item.path); setContextMenu(null); }} data-testid="context-delete">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      <Dialog open={!!moveDialog} onOpenChange={open => !open && setMoveDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Move {moveDialog?.paths.length} item{moveDialog?.paths.length !== 1 ? "s" : ""}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Choose a destination folder:</p>
            <Input
              placeholder="Leave empty for Home, or e.g. archive/2025"
              value={moveDest}
              onChange={e => setMoveDest(e.target.value)}
              data-testid="input-move-dest"
            />
            <p className="text-xs text-muted-foreground">Path is relative to your home directory.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveDialog(null)}>Cancel</Button>
            <Button onClick={moveItems} data-testid="button-confirm-move"><MoveRight className="h-4 w-4 mr-1.5" /> Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
