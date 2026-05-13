import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

const EXTERNALS = [
  "*.node",
  "geoip-lite",
  "openai",
  "sharp",
  "better-sqlite3",
  "sqlite3",
  "canvas",
  "bcrypt",
  "argon2",
  "fsevents",
  "re2",
  "farmhash",
  "xxhash-addon",
  "bufferutil",
  "utf-8-validate",
  "ssh2",
  "cpu-features",
  "dtrace-provider",
  "isolated-vm",
  "lightningcss",
  "pg-native",
  "oracledb",
  "mongodb-client-encryption",
  "nodemailer",
  "handlebars",
  "knex",
  "typeorm",
  "protobufjs",
  "onnxruntime-node",
  "@tensorflow/*",
  "@prisma/client",
  "@mikro-orm/*",
  "@grpc/*",
  "@swc/*",
  "@aws-sdk/*",
  "@azure/*",
  "@opentelemetry/*",
  "@google-cloud/*",
  "@google/*",
  "googleapis",
  "firebase-admin",
  "@parcel/watcher",
  "@sentry/profiling-node",
  "@tree-sitter/*",
  "aws-sdk",
  "classic-level",
  "dd-trace",
  "ffi-napi",
  "grpc",
  "hiredis",
  "kerberos",
  "leveldown",
  "miniflare",
  "mysql2",
  "newrelic",
  "odbc",
  "piscina",
  "realm",
  "ref-napi",
  "rocksdb",
  "sass-embedded",
  "sequelize",
  "serialport",
  "snappy",
  "tinypool",
  "usb",
  "workerd",
  "wrangler",
  "zeromq",
  "zeromq-prebuilt",
  "playwright",
  "puppeteer",
  "puppeteer-core",
  "electron",
];

const BANNER = {
  js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
  `,
};

/** Shared esbuild options for the server-side bundles */
const SHARED_OPTIONS = {
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: path.resolve(artifactDir, "dist"),
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  external: EXTERNALS,
  sourcemap: "linked",
  plugins: [
    // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
    esbuildPluginPino({ transports: ["pino-pretty"] }),
  ],
  // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
  banner: BANNER,
};

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  // ── Step 1: build the main server bundle (server.ts → dist/server.mjs) ─────
  //
  // server.ts contains all the heavy transitive imports (@workspace/db, Express,
  // cron jobs, etc.).  It is built as a fully self-contained bundle.
  await esbuild({
    ...SHARED_OPTIONS,
    entryPoints: [path.resolve(artifactDir, "src/server.ts")],
  });

  // ── Step 2: build the bootstrap entry point (index.ts → dist/index.mjs) ────
  //
  // index.ts imports only env.ts (no heavy deps) and calls validateEnv() before
  // doing a dynamic import of "./server.mjs".  By listing "./server.mjs" as an
  // external, esbuild leaves the import() call as-is so it resolves at runtime
  // to the file produced in step 1.  This is what ensures env validation runs
  // before @workspace/db or Express initialise.
  await esbuild({
    ...SHARED_OPTIONS,
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    external: [...EXTERNALS, "./server.mjs"],
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
