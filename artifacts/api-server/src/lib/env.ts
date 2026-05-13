/**
 * Environment variable validation — runs synchronously at server startup.
 *
 * Design:
 *  - Required vars: missing/obviously-invalid values throw before the server binds.
 *  - Feature-group vars: missing values are logged as warnings but do NOT block startup.
 *  - A feature-status table is printed so operators can immediately see what is active.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RequiredVar {
  name: string;
  description: string;
  /** Return an error string if the value is present but invalid; null if OK. */
  validate?: (value: string) => string | null;
}

interface FeatureGroup {
  /** Short name shown in the startup table */
  feature: string;
  /** All vars must be present for the feature to be active */
  vars: string[];
  /** Human-readable description of what is unlocked */
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Required variable definitions
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED: RequiredVar[] = [
  {
    name: "PORT",
    description: "TCP port the API server listens on",
    validate: (v) => {
      const n = Number(v);
      return Number.isNaN(n) || n <= 0 || n > 65535
        ? `must be a valid port number (1–65535), got "${v}"`
        : null;
    },
  },
  {
    name: "SESSION_SECRET",
    description: "Secret used to sign JWT auth tokens — keep this private",
    validate: (v) => {
      if (v.length < 16)
        return `must be at least 16 characters (${v.length} given) — generate one with: openssl rand -hex 32`;
      const placeholders = ["change_me", "replace", "secret", "password", "12345", "example"];
      const lower = v.toLowerCase();
      if (placeholders.some((p) => lower.includes(p)))
        return `looks like a placeholder value — set a real random secret`;
      return null;
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Optional feature groups
// ─────────────────────────────────────────────────────────────────────────────

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    feature: "Database",
    vars: ["DATABASE_URL"],
    description: "Primary PostgreSQL connection (checked by @workspace/db on boot)",
  },
  {
    feature: "App URL",
    vars: ["APP_URL"],
    description: "Public URL — required for OAuth callbacks and email links",
  },
  {
    feature: "AI (direct key)",
    vars: ["AI_API_KEY"],
    description: "OpenAI-compatible key for AI content generation",
  },
  {
    feature: "AI (Replit proxy)",
    vars: ["AI_INTEGRATIONS_OPENAI_API_KEY"],
    description: "Replit-managed AI proxy — takes precedence over AI_API_KEY",
  },
  {
    feature: "Image generation",
    vars: ["FAL_AI_API_KEY"],
    description: "fal.ai key for AI image generation",
  },
  {
    feature: "Google OAuth",
    vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    description: "Enables GSC / GA4 integrations",
  },
  {
    feature: "Google PageSpeed",
    vars: ["GOOGLE_PAGESPEED_API_KEY"],
    description: "Core Web Vitals scanning via PageSpeed Insights",
  },
  {
    feature: "Twitter / X",
    vars: ["TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET"],
    description: "Social publishing to Twitter/X",
  },
  {
    feature: "LinkedIn",
    vars: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    description: "Social publishing to LinkedIn",
  },
  {
    feature: "Facebook",
    vars: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
    description: "Social publishing to Facebook",
  },
  {
    feature: "Email encryption",
    vars: ["EMAIL_ENCRYPTION_KEY"],
    description: "32-byte hex key for SMTP credential encryption (falls back to SESSION_SECRET)",
  },
  {
    feature: "Resend webhooks",
    vars: ["RESEND_WEBHOOK_SECRET"],
    description: "Webhook signature verification for Resend email events",
  },
  {
    feature: "SendGrid webhooks",
    vars: ["SENDGRID_WEBHOOK_KEY"],
    description: "Webhook signature verification for SendGrid email events",
  },
  {
    feature: "Mailgun webhooks",
    vars: ["MAILGUN_WEBHOOK_SIGNING_KEY"],
    description: "Webhook signature verification for Mailgun email events",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Validation runner
// ─────────────────────────────────────────────────────────────────────────────

export function validateEnv(): void {
  const errors: string[] = [];

  // ── Required vars ──────────────────────────────────────────────────────────
  for (const spec of REQUIRED) {
    const value = process.env[spec.name];
    if (!value?.trim()) {
      errors.push(
        `  ✗ ${spec.name} is not set\n    ${spec.description}`
      );
      continue;
    }
    if (spec.validate) {
      const msg = spec.validate(value);
      if (msg) {
        errors.push(`  ✗ ${spec.name}: ${msg}\n    ${spec.description}`);
      }
    }
  }

  // ── Database: at least one connection string must exist ────────────────────
  const hasDb =
    !!(process.env["DATABASE_URL"]?.trim()) ||
    !!(process.env["SUPABASE_DATABASE_URL"]?.trim());
  if (!hasDb) {
    errors.push(
      "  ✗ DATABASE_URL or SUPABASE_DATABASE_URL is not set\n" +
        "    One of these must be provided so the server can connect to PostgreSQL"
    );
  }

  // ── Throw early if anything is missing ────────────────────────────────────
  if (errors.length > 0) {
    const lines = [
      "",
      "┌─────────────────────────────────────────────────────────────────┐",
      "│  SERVER STARTUP FAILED — required environment variables missing  │",
      "└─────────────────────────────────────────────────────────────────┘",
      "",
      ...errors,
      "",
      "  See .env.example for a full list of variables and their descriptions.",
      "",
    ];
    // Use process.stderr directly — logger may not be configured yet
    process.stderr.write(lines.join("\n") + "\n");
    process.exit(1);
  }

  // ── Feature status table ───────────────────────────────────────────────────
  const rows: { feature: string; status: string; note: string }[] = [];

  for (const group of FEATURE_GROUPS) {
    const missing = group.vars.filter((v) => !process.env[v]?.trim());
    if (missing.length === 0) {
      rows.push({ feature: group.feature, status: "✓ enabled", note: "" });
    } else if (missing.length < group.vars.length) {
      // Partially configured — more likely a mistake than intentional
      rows.push({
        feature: group.feature,
        status: "⚠ partial",
        note: `missing: ${missing.join(", ")}`,
      });
    } else {
      rows.push({
        feature: group.feature,
        status: "○ not set",
        note: group.description,
      });
    }
  }

  // Special-case: AI is considered "enabled" if either key is set
  const aiEnabled =
    !!(process.env["AI_API_KEY"]?.trim()) ||
    !!(process.env["AI_INTEGRATIONS_OPENAI_API_KEY"]?.trim()) ||
    !!(process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"]?.trim());

  const featureWidth = Math.max(...rows.map((r) => r.feature.length), 20);
  const statusWidth = 12;

  const header =
    `  ${"Feature".padEnd(featureWidth)}  ${"Status".padEnd(statusWidth)}  Note`;
  const separator = `  ${"─".repeat(featureWidth)}  ${"─".repeat(statusWidth)}  ${"─".repeat(30)}`;

  const tableRows = rows.map(
    (r) =>
      `  ${r.feature.padEnd(featureWidth)}  ${r.status.padEnd(statusWidth)}  ${r.note}`
  );

  const lines = [
    "",
    "┌──────────────────────────────────────────┐",
    "│  SEO Command — startup environment check  │",
    "└──────────────────────────────────────────┘",
    "",
    header,
    separator,
    ...tableRows,
    "",
    aiEnabled
      ? "  AI features: enabled"
      : "  AI features: disabled (set AI_API_KEY or configure an AI provider in Settings)",
    "",
  ];

  process.stdout.write(lines.join("\n") + "\n");
}
