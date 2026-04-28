import Stripe from "stripe";
import Razorpay from "razorpay";
import { getDbSetting, setDbSetting } from "./ai-provider.js";
import { setSecretSetting, decryptSecret } from "./email-sender.js";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export type PaymentProvider = "stripe" | "razorpay";

export interface PaymentSettings {
  provider: PaymentProvider | null;
  currency: string;
  stripePublishableKey: string;
  stripeSecretKeyConfigured: boolean;
  stripeWebhookSecretConfigured: boolean;
  razorpayKeyId: string;
  razorpayKeySecretConfigured: boolean;
}

async function getSecretSettingValue(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
    if (!row?.value) return null;
    return decryptSecret(row.value);
  } catch {
    return null;
  }
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const provider = (await getDbSetting("active_payment_provider")) as PaymentProvider | null;
  const currency = (await getDbSetting("payment_default_currency")) ?? "usd";
  const stripePublishableKey = (await getDbSetting("stripe_publishable_key")) ?? "";
  const stripeSecretKeyConfigured = !!(await getSecretSettingValue("stripe_secret_key"));
  const stripeWebhookSecretConfigured = !!(await getSecretSettingValue("stripe_webhook_secret"));
  const razorpayKeyId = (await getDbSetting("razorpay_key_id")) ?? "";
  const razorpayKeySecretConfigured = !!(await getSecretSettingValue("razorpay_key_secret"));

  return {
    provider,
    currency,
    stripePublishableKey,
    stripeSecretKeyConfigured,
    stripeWebhookSecretConfigured,
    razorpayKeyId,
    razorpayKeySecretConfigured,
  };
}

export async function savePaymentSettings(body: {
  provider?: string;
  currency?: string;
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
}): Promise<PaymentSettings> {
  const VALID_PROVIDERS: PaymentProvider[] = ["stripe", "razorpay"];
  const STRIPE_CURRENCIES = ["usd", "gbp", "eur"];
  const RAZORPAY_CURRENCIES = ["inr"];

  if (body.provider !== undefined) {
    if (!VALID_PROVIDERS.includes(body.provider as PaymentProvider)) {
      throw new Error(`Invalid provider. Valid values: ${VALID_PROVIDERS.join(", ")}`);
    }
    await setDbSetting("active_payment_provider", body.provider);
    // When switching providers, reset stored currency to a valid default if incompatible
    if (!body.currency) {
      const existingCurrency = (await getDbSetting("payment_default_currency")) ?? "usd";
      const validForNew =
        body.provider === "stripe" ? STRIPE_CURRENCIES.includes(existingCurrency) :
        body.provider === "razorpay" ? RAZORPAY_CURRENCIES.includes(existingCurrency) : true;
      if (!validForNew) {
        const defaultCurrency = body.provider === "razorpay" ? "inr" : "usd";
        await setDbSetting("payment_default_currency", defaultCurrency);
      }
    }
  }
  if (body.currency && typeof body.currency === "string") {
    const currency = body.currency.toLowerCase().trim();
    const provider = body.provider ?? (await getDbSetting("active_payment_provider"));
    if (provider === "stripe" && !STRIPE_CURRENCIES.includes(currency)) {
      throw new Error(`Invalid currency for Stripe. Allowed values: ${STRIPE_CURRENCIES.join(", ")}`);
    }
    if (provider === "razorpay" && !RAZORPAY_CURRENCIES.includes(currency)) {
      throw new Error(`Invalid currency for Razorpay. Allowed values: ${RAZORPAY_CURRENCIES.join(", ")}`);
    }
    await setDbSetting("payment_default_currency", currency);
  }
  if (body.stripePublishableKey !== undefined && typeof body.stripePublishableKey === "string") {
    await setDbSetting("stripe_publishable_key", body.stripePublishableKey.trim());
  }
  if (body.stripeSecretKey && typeof body.stripeSecretKey === "string" && body.stripeSecretKey.trim()) {
    await setSecretSetting("stripe_secret_key", body.stripeSecretKey.trim());
  }
  if (body.stripeWebhookSecret && typeof body.stripeWebhookSecret === "string" && body.stripeWebhookSecret.trim()) {
    await setSecretSetting("stripe_webhook_secret", body.stripeWebhookSecret.trim());
  }
  if (body.razorpayKeyId !== undefined && typeof body.razorpayKeyId === "string") {
    await setDbSetting("razorpay_key_id", body.razorpayKeyId.trim());
  }
  if (body.razorpayKeySecret && typeof body.razorpayKeySecret === "string" && body.razorpayKeySecret.trim()) {
    await setSecretSetting("razorpay_key_secret", body.razorpayKeySecret.trim());
  }

  return getPaymentSettings();
}

export async function testPaymentConnection(): Promise<{ success: boolean; message: string; provider: string }> {
  const settings = await getPaymentSettings();

  if (!settings.provider) {
    return { success: false, message: "No payment provider selected.", provider: "none" };
  }

  if (settings.provider === "stripe") {
    const secretKey = await getSecretSettingValue("stripe_secret_key");
    if (!secretKey) {
      return { success: false, message: "Stripe secret key is not configured.", provider: "stripe" };
    }
    try {
      const stripe = new Stripe(secretKey);
      await stripe.balance.retrieve();
      return { success: true, message: "Stripe connection verified successfully.", provider: "stripe" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe connection failed";
      return { success: false, message: msg, provider: "stripe" };
    }
  }

  if (settings.provider === "razorpay") {
    const keyId = settings.razorpayKeyId;
    const keySecret = await getSecretSettingValue("razorpay_key_secret");
    if (!keyId || !keySecret) {
      return { success: false, message: "Razorpay Key ID and Key Secret are required.", provider: "razorpay" };
    }
    try {
      const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
      await razorpay.payments.all({ count: 1 });
      return { success: true, message: "Razorpay connection verified successfully.", provider: "razorpay" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Razorpay connection failed";
      return { success: false, message: msg, provider: "razorpay" };
    }
  }

  return { success: false, message: "Unknown provider.", provider: String(settings.provider) };
}
