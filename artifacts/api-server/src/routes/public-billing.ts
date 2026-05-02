import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, couponsTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/billing/validate-coupon", async (req, res): Promise<void> => {
  const { code, plan } = req.body as { code?: string; plan?: string };
  if (!code) {
    res.status(400).json({ error: "Coupon code is required" });
    return;
  }
  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.code, code.toUpperCase().trim()));

  if (!coupon || !coupon.isActive) {
    res.status(404).json({ error: "Invalid or expired coupon code" });
    return;
  }
  if (coupon.expiresAt && new Date() > coupon.expiresAt) {
    res.status(400).json({ error: "This coupon has expired" });
    return;
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    res.status(400).json({ error: "This coupon has reached its usage limit" });
    return;
  }
  if (coupon.appliesTo !== "all" && plan && coupon.appliesTo !== plan) {
    res.status(400).json({ error: `This coupon only applies to the ${coupon.appliesTo} plan` });
    return;
  }

  res.json({
    valid: true,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    appliesTo: coupon.appliesTo,
  });
});

export default router;
