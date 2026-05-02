import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";
import { verifyToken } from "../lib/auth.js";

const router: IRouter = Router();

function escapeCsv(val: string | null | undefined): string {
  if (val == null) return "";
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function notesCount(notes: string | null | undefined): string {
  if (!notes || !notes.trim()) return "";
  return "1 note";
}

router.get("/leads/export.csv", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;
  const rawToken = headerToken ?? queryToken;

  if (!rawToken) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const user = verifyToken(rawToken);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const { status, from, to } = req.query as { status?: string; from?: string; to?: string };
  const conditions = [];

  if (status) {
    const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) conditions.push(eq(leadsTable.status, statuses[0]));
    else if (statuses.length > 1) conditions.push(inArray(leadsTable.status, statuses));
  }
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); conditions.push(gte(leadsTable.createdAt, d)); }
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); conditions.push(lte(leadsTable.createdAt, d)); }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const filename = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const HEADERS = ["Name", "Email", "Phone", "Company", "Source", "Status", "Score", "Value", "Notes", "Created Date", "Last Updated"];
  res.write(HEADERS.join(",") + "\n");

  const BATCH = 500;
  let batchOffset = 0;

  while (true) {
    const batch = await db
      .select()
      .from(leadsTable)
      .where(where)
      .orderBy(leadsTable.id)
      .limit(BATCH)
      .offset(batchOffset);

    for (const l of batch) {
      const row = [
        escapeCsv(l.name),
        escapeCsv(l.email),
        escapeCsv(l.phone),
        "",
        escapeCsv(l.source),
        escapeCsv(l.status),
        l.score ?? "",
        l.value != null ? parseFloat(String(l.value)).toFixed(2) : "",
        notesCount(l.notes),
        new Date(l.createdAt).toISOString().split("T")[0],
        new Date(l.updatedAt).toISOString().split("T")[0],
      ];
      res.write(row.join(",") + "\n");
    }

    if (batch.length < BATCH) break;
    batchOffset += BATCH;
  }

  res.end();
});

export default router;
