/**
 * Unit tests for the env validation module.
 *
 * Run with:  node --experimental-strip-types src/lib/env.test.ts
 * (Node 22+ only — no additional test runner required)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { collectEnvErrors } from "./env.js";

// Minimal env that satisfies all required vars
const BASE_ENV: Record<string, string> = {
  PORT: "5000",
  SESSION_SECRET: "a-sufficiently-long-random-secret-value",
  DATABASE_URL: "postgresql://localhost:5432/test",
};

// ─────────────────────────────────────────────────────────────────────────────
// Required variable checks
// ─────────────────────────────────────────────────────────────────────────────

describe("collectEnvErrors — required vars", () => {
  it("returns no errors when all required vars are valid", () => {
    const { errors } = collectEnvErrors({ ...BASE_ENV });
    assert.equal(errors.length, 0, `Expected no errors but got:\n${errors.join("\n")}`);
  });

  it("reports an error when PORT is missing", () => {
    const { errors } = collectEnvErrors({ ...BASE_ENV, PORT: "" });
    assert.ok(errors.some((e) => e.includes("PORT")), "Expected PORT error");
  });

  it("reports an error when PORT is not a number", () => {
    const { errors } = collectEnvErrors({ ...BASE_ENV, PORT: "abc" });
    assert.ok(errors.some((e) => e.includes("PORT")), "Expected PORT format error");
  });

  it("reports an error when PORT is out of range", () => {
    const { errors } = collectEnvErrors({ ...BASE_ENV, PORT: "99999" });
    assert.ok(errors.some((e) => e.includes("PORT")), "Expected PORT range error");
  });

  it("reports an error when SESSION_SECRET is missing", () => {
    const env = { ...BASE_ENV };
    delete env["SESSION_SECRET"];
    const { errors } = collectEnvErrors(env);
    assert.ok(errors.some((e) => e.includes("SESSION_SECRET")), "Expected SESSION_SECRET error");
  });

  it("reports an error when SESSION_SECRET is too short", () => {
    const { errors } = collectEnvErrors({ ...BASE_ENV, SESSION_SECRET: "short" });
    assert.ok(errors.some((e) => e.includes("SESSION_SECRET")), "Expected SESSION_SECRET length error");
  });

  it("reports an error when SESSION_SECRET looks like a placeholder", () => {
    const { errors } = collectEnvErrors({ ...BASE_ENV, SESSION_SECRET: "change_me_to_real_secret_please" });
    assert.ok(errors.some((e) => e.includes("SESSION_SECRET")), "Expected placeholder error");
  });

  it("does NOT reject a SESSION_SECRET that contains the word 'secret' naturally in context", () => {
    // "change_me_to_real_secret" would be rejected; a random hex with 'a' chars is fine
    const { errors } = collectEnvErrors({ ...BASE_ENV, SESSION_SECRET: "d3ad1337beefc0ffee0102030405060" });
    assert.ok(!errors.some((e) => e.includes("SESSION_SECRET")), "Should not reject a realistic hex string");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Database URL checks
// ─────────────────────────────────────────────────────────────────────────────

describe("collectEnvErrors — database URL", () => {
  it("reports an error when neither DATABASE_URL nor SUPABASE_DATABASE_URL is set", () => {
    const env = { ...BASE_ENV };
    delete env["DATABASE_URL"];
    const { errors } = collectEnvErrors(env);
    assert.ok(
      errors.some((e) => e.includes("DATABASE_URL") || e.includes("SUPABASE")),
      "Expected database error"
    );
  });

  it("accepts SUPABASE_DATABASE_URL as the sole database URL", () => {
    const env = { ...BASE_ENV };
    delete env["DATABASE_URL"];
    env["SUPABASE_DATABASE_URL"] = "postgresql://supabase.example.com:6543/postgres";
    const { errors } = collectEnvErrors(env);
    assert.ok(
      !errors.some((e) => e.includes("DATABASE_URL") || e.includes("SUPABASE")),
      "SUPABASE_DATABASE_URL should be sufficient"
    );
  });

  it("accepts DATABASE_URL as the sole database URL", () => {
    const { errors } = collectEnvErrors({ ...BASE_ENV });
    assert.equal(errors.length, 0);
  });

  it("accepts both DATABASE_URL and SUPABASE_DATABASE_URL simultaneously", () => {
    const { errors } = collectEnvErrors({
      ...BASE_ENV,
      SUPABASE_DATABASE_URL: "postgresql://supabase.example.com:6543/postgres",
    });
    assert.equal(errors.length, 0);
  });

  it("rejects a DATABASE_URL with an invalid scheme", () => {
    const { errors } = collectEnvErrors({ ...BASE_ENV, DATABASE_URL: "mysql://localhost/test" });
    assert.ok(
      errors.some((e) => e.includes("DATABASE_URL") && e.includes("format")),
      "Expected a format error for a non-postgres URL"
    );
  });

  it("rejects a DATABASE_URL that is clearly not a connection string", () => {
    const { errors } = collectEnvErrors({ ...BASE_ENV, DATABASE_URL: "notaurl" });
    assert.ok(
      errors.some((e) => e.includes("format")),
      "Expected a format error for a non-URL value"
    );
  });

  it("accepts postgres:// scheme (short form)", () => {
    const env = { ...BASE_ENV, DATABASE_URL: "postgres://user:pass@localhost:5432/db" };
    const { errors } = collectEnvErrors(env);
    assert.ok(!errors.some((e) => e.includes("format")), "postgres:// should be accepted");
  });

  it("accepts postgresql:// scheme (long form)", () => {
    const env = { ...BASE_ENV, DATABASE_URL: "postgresql://user:pass@localhost:5432/db" };
    const { errors } = collectEnvErrors(env);
    assert.ok(!errors.some((e) => e.includes("format")), "postgresql:// should be accepted");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature group status
// ─────────────────────────────────────────────────────────────────────────────

describe("collectEnvErrors — feature group status", () => {
  it("shows Database as enabled when DATABASE_URL is set", () => {
    const { features } = collectEnvErrors({ ...BASE_ENV });
    const db = features.find((f) => f.feature === "Database");
    assert.ok(db, "Database feature row should exist");
    assert.equal(db!.status, "enabled");
  });

  it("shows Database as enabled when only SUPABASE_DATABASE_URL is set", () => {
    const env = { ...BASE_ENV };
    delete env["DATABASE_URL"];
    env["SUPABASE_DATABASE_URL"] = "postgresql://supabase.example.com:6543/postgres";
    const { features } = collectEnvErrors(env);
    const db = features.find((f) => f.feature === "Database");
    assert.equal(db!.status, "enabled");
  });

  it("shows Google OAuth as partial when only CLIENT_ID is set", () => {
    const env = { ...BASE_ENV, GOOGLE_CLIENT_ID: "client-id" };
    const { features } = collectEnvErrors(env);
    const google = features.find((f) => f.feature === "Google OAuth");
    assert.equal(google!.status, "partial");
    assert.ok(google!.missingVars.includes("GOOGLE_CLIENT_SECRET"));
    assert.ok(google!.missingVars.includes("GOOGLE_REDIRECT_URI"));
  });

  it("shows Google OAuth as enabled when all three vars are set", () => {
    const env = {
      ...BASE_ENV,
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      GOOGLE_REDIRECT_URI: "https://example.com/callback",
    };
    const { features } = collectEnvErrors(env);
    const google = features.find((f) => f.feature === "Google OAuth");
    assert.equal(google!.status, "enabled");
  });

  it("shows AI (Replit proxy) as enabled only when both proxy vars are set", () => {
    const envBoth = {
      ...BASE_ENV,
      AI_INTEGRATIONS_OPENAI_API_KEY: "key",
      AI_INTEGRATIONS_OPENAI_BASE_URL: "https://proxy.example.com",
    };
    const { features: both } = collectEnvErrors(envBoth);
    assert.equal(both.find((f) => f.feature === "AI (Replit proxy)")!.status, "enabled");

    const envKeyOnly = { ...BASE_ENV, AI_INTEGRATIONS_OPENAI_API_KEY: "key" };
    const { features: keyOnly } = collectEnvErrors(envKeyOnly);
    assert.equal(keyOnly.find((f) => f.feature === "AI (Replit proxy)")!.status, "partial");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AI enabled flag
// ─────────────────────────────────────────────────────────────────────────────

describe("collectEnvErrors — aiEnabled flag", () => {
  it("is false when no AI vars are set", () => {
    const { aiEnabled } = collectEnvErrors({ ...BASE_ENV });
    assert.equal(aiEnabled, false);
  });

  it("is true when AI_API_KEY is set", () => {
    const { aiEnabled } = collectEnvErrors({ ...BASE_ENV, AI_API_KEY: "sk-abc123" });
    assert.equal(aiEnabled, true);
  });

  it("is true when both proxy vars are set", () => {
    const { aiEnabled } = collectEnvErrors({
      ...BASE_ENV,
      AI_INTEGRATIONS_OPENAI_API_KEY: "key",
      AI_INTEGRATIONS_OPENAI_BASE_URL: "https://proxy.example.com",
    });
    assert.equal(aiEnabled, true);
  });

  it("is false when only the proxy BASE_URL is set (key is required)", () => {
    const { aiEnabled } = collectEnvErrors({
      ...BASE_ENV,
      AI_INTEGRATIONS_OPENAI_BASE_URL: "https://proxy.example.com",
    });
    assert.equal(aiEnabled, false);
  });
});
