/**
 * Server bootstrap entry point.
 *
 * This file is intentionally kept tiny. It imports ONLY the env validator
 * (which has zero external dependencies) and calls it synchronously before
 * any other module is loaded.  The dynamic import below ensures that Node.js
 * evaluates ./server.mjs (and all of its transitive imports — @workspace/db,
 * Express, etc.) AFTER validateEnv() has already run and passed, so a missing
 * required var always produces a clear error rather than a cryptic module-init
 * exception.
 *
 * build.mjs lists both index.ts and server.ts as separate esbuild entry points
 * so that the dynamic import resolves to a real file in dist/.
 */
import { validateEnv } from "./lib/env.js";

validateEnv();

// Dynamic import — resolved only after validateEnv() succeeds above.
// The .mjs extension matches the outExtension set in build.mjs.
await import("./server.mjs");
