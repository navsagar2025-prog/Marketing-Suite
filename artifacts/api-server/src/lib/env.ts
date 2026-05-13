/**
 * Environment variable validation — runs synchronously at server startup.
 *
 * Design:
 *  - Required vars: missing/obviously-invalid values cause process.exit(1) with a
 *    clear, formatted error block before any other module initializes.
 *  - Feature-group vars: missing values are reported in the startup table but do
 *    NOT block startup.
 *  - collectEnvErrors() is a pure function (no side-effects) so it can be unit-tested.
 *  - validateEnv() calls collectEnvErrors() then either exits or prints the table.
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
  /** Var names to check */
  vars: string[];
  /** Human-readable description of what is unlocked */
  description: string;
  /**
   * "all" (default) — ALL vars must be set for the feature to be active;
   *                    partial means some but not all are set.
   * "any"           — ANY one var being set marks the feature as active.
   */
  mode?: "all" | "any";
}

export interface FeatureRow {
  feature: string;
  status: "enabled" | "partial" | "not-set";
  missingVars: string[];
  description: string;
}

export interface EnvValidationResult {
  /** Human-readable error lines — empty means all required vars are present */
  errors: string[];
  /** Per-feature status for the startup table */
  features: FeatureRow[];
  /** True when at least one AI key is configured */
  aiEnabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Required variable definitions
// ─────────────────────────────────────────────────────────────────────────────

export const REQUIRED: RequiredVar[] = [
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
      const placeholders = ["change_me", "replace_me", "12345", "example", "placeholder"];
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

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    feature: "Database",
    vars: ["DATABASE_URL", "SUPABASE_DATABASE_URL"],
    description: "PostgreSQL connection — set DATABASE_URL or SUPABASE_DATABASE_URL",
    mode: "any",
  },
  {
    feature: "App URL",
    vars: ["APP_URL"],
    description: "Public URL — required for OAuth callbacks and email links",
  },
  {
    feature: "NODE_ENV",
    vars: ["NODE_ENV"],
    description: 'Set to "production" in deployed environments',
  },
  {
    feature: "AI (direct key)",
    vars: ["AI_API_KEY"],
    description: "OpenAI-compatible key for AI content generation",
  },
  {
    feature: "AI (Replit proxy)",
    vars: ["AI_INTEGRATIONS_OPENAI_API_KEY", "AI_INTEGRATIONS_OPENAI_BASE_URL"],
    description: "Replit-managed AI proxy (both KEY and BASE_URL required)",
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
  {
    feature: "Stripe billing",
    vars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    description: "Stripe payments (also configurable via Settings UI)",
  },
  {
    feature: "Razorpay billing",
    vars: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
    description: "Razorpay payments (also configurable via Settings UI)",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pure validation — no side-effects; safe to call in tests
// ─────────────────────────────────────────────────────────────────────────────

export function collectEnvErrors(
  env: Record<string, string | undefined> = process.env
): EnvValidationResult {
  const errors: string[] = [];

  // ── Required vars ──────────────────────────────────────────────────────────
  for (const spec of REQUIRED) {
    const value = env[spec.name];
    if (!value?.trim()) {
      errors.push(`  ✗ ${spec.name} is not set\n    ${spec.description}`);
      continue;
    }
    if (spec.validate) {
      const msg = spec.validate(value);
      if (msg) errors.push(`  ✗ ${spec.name}: ${msg}\n    ${spec.description}`);
    }
  }

  // ── Database: at least one connection string must be present and valid ────
  const dbUrl = (env["DATABASE_URL"] ?? env["SUPABASE_DATABASE_URL"] ?? "").trim();
  if (!dbUrl) {
    errors.push(
      "  ✗ DATABASE_URL or SUPABASE_DATABASE_URL is not set\n" +
        "    One of these must be provided so the server can connect to PostgreSQL"
    );
  } else if (!/^postgre(?:s|sql):\/\//i.test(dbUrl)) {
    errors.push(
      `  ✗ DATABASE_URL / SUPABASE_DATABASE_URL has an invalid format\n` +
        `    Expected a connection string starting with postgres:// or postgresql://, got "${dbUrl.slice(0, 40)}${dbUrl.length > 40 ? "…" : ""}"`
    );
  }

  // ── Feature group status ───────────────────────────────────────────────────
  const features: FeatureRow[] = FEATURE_GROUPS.map((group) => {
    const missing = group.vars.filter((v) => !env[v]?.trim());
    const set = group.vars.length - missing.length;

    if (group.mode === "any") {
      return {
        feature: group.feature,
        status: set > 0 ? "enabled" : "not-set",
        missingVars: set > 0 ? [] : group.vars,
        description: group.description,
      } satisfies FeatureRow;
    }

    if (missing.length === 0) {
      return { feature: group.feature, status: "enabled", missingVars: [], description: group.description };
    } else if (set > 0) {
      return { feature: group.feature, status: "partial", missingVars: missing, description: group.description };
    } else {
      return { feature: group.feature, status: "not-set", missingVars: group.vars, description: group.description };
    }
  });

  // AI is enabled when AI_API_KEY is set OR both proxy vars are set
  const aiEnabled =
    !!(env["AI_API_KEY"]?.trim()) ||
    (!!(env["AI_INTEGRATIONS_OPENAI_API_KEY"]?.trim()) &&
      !!(env["AI_INTEGRATIONS_OPENAI_BASE_URL"]?.trim()));

  return { errors, features, aiEnabled };
}

// ─────────────────────────────────────────────────────────────────────────────
// Side-effecting runner — exits on error, prints table on success
// ─────────────────────────────────────────────────────────────────────────────

export function validateEnv(env: Record<string, string | undefined> = process.env): void {
  const { errors, features, aiEnabled } = collectEnvErrors(env);

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
    process.stderr.write(lines.join("\n") + "\n");
    process.exit(1);
  }

  const statusLabel: Record<FeatureRow["status"], string> = {
    enabled: "✓ enabled",
    partial: "⚠ partial",
    "not-set": "○ not set",
  };

  const rows = features.map((f) => ({
    feature: f.feature,
    status: statusLabel[f.status],
    note:
      f.status === "partial"
        ? `missing: ${f.missingVars.join(", ")}`
        : f.status === "not-set"
          ? f.description
          : "",
  }));

  const featureWidth = Math.max(...rows.map((r) => r.feature.length), 20);
  const statusWidth = 12;

  const header = `  ${"Feature".padEnd(featureWidth)}  ${"Status".padEnd(statusWidth)}  Note`;
  const separator = `  ${"─".repeat(featureWidth)}  ${"─".repeat(statusWidth)}  ${"─".repeat(30)}`;
  const tableRows = rows.map(
    (r) => `  ${r.feature.padEnd(featureWidth)}  ${r.status.padEnd(statusWidth)}  ${r.note}`
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
