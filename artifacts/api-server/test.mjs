/**
 * Test runner for the API server.
 *
 * Usage: node test.mjs
 *
 * Compiles TypeScript test files with esbuild then runs them with Node's
 * built-in test runner (node:test).  No additional test framework required.
 */
import { build } from "esbuild";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// Compile the test files
await build({
  entryPoints: [path.resolve(artifactDir, "src/lib/env.test.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: path.resolve(artifactDir, "dist/env.test.mjs"),
  // Node built-in test modules must be kept external
  external: ["node:test", "node:assert", "node:assert/strict"],
  logLevel: "warning",
});

// Run the compiled test file
const proc = spawn(
  process.execPath,
  ["--test", path.resolve(artifactDir, "dist/env.test.mjs")],
  { stdio: "inherit" }
);

proc.on("exit", (code) => process.exit(code ?? 0));
