import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, abTestsTable, abVariantsTable, insertAbTestSchema, insertAbVariantSchema } from "@workspace/db";

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

// Create a new test (with variants inline)
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
  const [test] = await db.insert(abTestsTable).values(parsedTest.data).returning();
  const variantRows = rawVariants.map((v: unknown) => {
    const parsed = insertAbVariantSchema.safeParse({ ...(v as object), testId: test.id });
    if (!parsed.success) throw new Error(`Invalid variant: ${parsed.error}`);
    return parsed.data;
  });
  const variants = await db.insert(abVariantsTable).values(variantRows).returning();
  res.status(201).json({ ...test, variants });
});

// Update test status or notes
router.patch("/ab-tests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const allowed: Record<string, unknown> = {};
  if (req.body.status) allowed.status = req.body.status;
  if (req.body.name) allowed.name = req.body.name;
  if (req.body.notes !== undefined) allowed.notes = req.body.notes;
  if (req.body.winnerThreshold !== undefined) allowed.winnerThreshold = req.body.winnerThreshold;
  const [test] = await db.update(abTestsTable).set(allowed).where(eq(abTestsTable.id, id)).returning();
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
  const parsed = insertAbVariantSchema.safeParse({ ...req.body, testId });
  if (!parsed.success) { res.status(400).json({ error: String(parsed.error) }); return; }
  const [variant] = await db.insert(abVariantsTable).values(parsed.data).returning();
  res.status(201).json(variant);
});

// Delete a variant
router.delete("/ab-tests/:testId/variants/:variantId", async (req, res): Promise<void> => {
  const variantId = parseInt(req.params.variantId, 10);
  if (isNaN(variantId)) { res.status(400).json({ error: "Invalid variantId" }); return; }
  const [deleted] = await db.delete(abVariantsTable).where(eq(abVariantsTable.id, variantId)).returning();
  if (!deleted) { res.status(404).json({ error: "Variant not found" }); return; }
  res.sendStatus(204);
});

export default router;
