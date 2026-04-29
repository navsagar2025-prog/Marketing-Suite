import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, abTestsTable, abVariantsTable, insertAbTestSchema, insertAbVariantSchema } from "@workspace/db";

const AB_STATUSES = ["active", "closed"] as const;

function validatePatchBody(body: Record<string, unknown>): { data: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!AB_STATUSES.includes(body.status as (typeof AB_STATUSES)[number])) {
      return { data, error: `status must be one of: ${AB_STATUSES.join(", ")}` };
    }
    data.status = body.status;
  }
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return { data, error: "name must be a non-empty string" };
    }
    data.name = body.name;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return { data, error: "notes must be a string or null" };
    }
    data.notes = body.notes;
  }
  if (body.winnerThreshold !== undefined) {
    const t = Number(body.winnerThreshold);
    if (!Number.isInteger(t) || t < 1) {
      return { data, error: "winnerThreshold must be a positive integer" };
    }
    data.winnerThreshold = t;
  }
  return { data };
}

const router: IRouter = Router();

// List all tests with their variants
router.get("/ab-tests", async (_req, res): Promise<void> => {
  const tests = await db.select().from(abTestsTable).orderBy(abTestsTable.createdAt);
  const variants = await db.select().from(abVariantsTable).orderBy(abVariantsTable.createdAt);
  const result = tests.map((t) => ({
    ...t,
    variants: variants.filter((v) => v.testId === t.id),
  }));
  res.json(result);
});

// Get single test with variants
router.get("/ab-tests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [test] = await db.select().from(abTestsTable).where(eq(abTestsTable.id, id));
  if (!test) { res.status(404).json({ error: "Test not found" }); return; }
  const variants = await db.select().from(abVariantsTable).where(eq(abVariantsTable.testId, id));
  res.json({ ...test, variants });
});

// Create a new test (with variants inline) — fully transactional
router.post("/ab-tests", async (req, res): Promise<void> => {
  const { variants: rawVariants, ...testData } = req.body;
  const parsedTest = insertAbTestSchema.safeParse(testData);
  if (!parsedTest.success) {
    res.status(400).json({ error: String(parsedTest.error) });
    return;
  }
  if (!Array.isArray(rawVariants) || rawVariants.length < 2) {
    res.status(400).json({ error: "At least 2 variants are required" });
    return;
  }
  // Pre-validate all variants before touching the DB
  const variantDataList: ReturnType<typeof insertAbVariantSchema.parse>[] = [];
  for (const v of rawVariants) {
    const parsed = insertAbVariantSchema.safeParse({ ...(v as object), testId: 0 }); // testId placeholder
    if (!parsed.success) {
      res.status(400).json({ error: `Invalid variant: ${parsed.error}` });
      return;
    }
    variantDataList.push(parsed.data);
  }
  // Wrap test + variant inserts in a single transaction
  const result = await db.transaction(async (tx) => {
    const [test] = await tx.insert(abTestsTable).values(parsedTest.data).returning();
    const variantRows = variantDataList.map((v) => ({ ...v, testId: test.id }));
    const variants = await tx.insert(abVariantsTable).values(variantRows).returning();
    return { ...test, variants };
  });
  res.status(201).json(result);
});

// Update test status or notes
router.patch("/ab-tests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { data, error } = validatePatchBody(req.body as Record<string, unknown>);
  if (error) { res.status(400).json({ error }); return; }
  if (Object.keys(data).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }
  const [test] = await db.update(abTestsTable).set(data).where(eq(abTestsTable.id, id)).returning();
  if (!test) { res.status(404).json({ error: "Test not found" }); return; }
  res.json(test);
});

// Delete a test
router.delete("/ab-tests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(abTestsTable).where(eq(abTestsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Test not found" }); return; }
  res.sendStatus(204);
});

// Add a variant to an existing test
router.post("/ab-tests/:testId/variants", async (req, res): Promise<void> => {
  const testId = parseInt(req.params.testId, 10);
  if (isNaN(testId)) { res.status(400).json({ error: "Invalid testId" }); return; }
  // Verify test exists before inserting variant
  const [test] = await db.select({ id: abTestsTable.id }).from(abTestsTable).where(eq(abTestsTable.id, testId));
  if (!test) { res.status(404).json({ error: "Test not found" }); return; }
  const parsed = insertAbVariantSchema.safeParse({ ...req.body, testId });
  if (!parsed.success) { res.status(400).json({ error: String(parsed.error) }); return; }
  const [variant] = await db.insert(abVariantsTable).values(parsed.data).returning();
  res.status(201).json(variant);
});

// Delete a variant — scoped by both testId and variantId
router.delete("/ab-tests/:testId/variants/:variantId", async (req, res): Promise<void> => {
  const testId = parseInt(req.params.testId, 10);
  const variantId = parseInt(req.params.variantId, 10);
  if (isNaN(testId) || isNaN(variantId)) { res.status(400).json({ error: "Invalid ids" }); return; }
  const [deleted] = await db.delete(abVariantsTable)
    .where(and(eq(abVariantsTable.id, variantId), eq(abVariantsTable.testId, testId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Variant not found" }); return; }
  res.sendStatus(204);
});

export default router;
