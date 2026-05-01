import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { emailTemplatesTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/email-templates", async (req, res): Promise<void> => {
  const websiteId = req.query.websiteId ? parseInt(String(req.query.websiteId), 10) : undefined;
  const templates = websiteId
    ? await db.select().from(emailTemplatesTable)
        .where(eq(emailTemplatesTable.websiteId, websiteId))
        .orderBy(emailTemplatesTable.createdAt)
    : await db.select().from(emailTemplatesTable).orderBy(emailTemplatesTable.createdAt);
  res.json(templates);
});

router.post("/email-templates", async (req, res): Promise<void> => {
  const { name, subject, body, websiteId } = req.body ?? {};
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!subject || typeof subject !== "string" || !subject.trim()) {
    res.status(400).json({ error: "subject is required" });
    return;
  }
  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "body is required" });
    return;
  }
  const [template] = await db.insert(emailTemplatesTable).values({
    name: name.trim(),
    subject: subject.trim(),
    body: body.trim(),
    websiteId: websiteId ? parseInt(String(websiteId), 10) : null,
  }).returning();
  res.status(201).json(template);
});

router.patch("/email-templates/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, subject, body } = req.body ?? {};
  const updates: Record<string, string> = {};
  if (name && typeof name === "string") updates.name = name.trim();
  if (subject && typeof subject === "string") updates.subject = subject.trim();
  if (body && typeof body === "string") updates.body = body.trim();
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }
  const [template] = await db.update(emailTemplatesTable).set(updates).where(eq(emailTemplatesTable.id, id)).returning();
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }
  res.json(template);
});

router.delete("/email-templates/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [template] = await db.delete(emailTemplatesTable).where(eq(emailTemplatesTable.id, id)).returning();
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }
  res.sendStatus(204);
});

export default router;
