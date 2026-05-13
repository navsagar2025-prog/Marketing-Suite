import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async ({ command }) => {
  const basePath = process.env.BASE_PATH;
  if (!basePath) {
    throw new Error(
      "BASE_PATH environment variable is required but was not provided.",
    );
  }

  // PORT is only needed when running the dev/preview server — NOT during `vite build`
  let port = 3000;
  if (command !== "build") {
    const rawPort = process.env.PORT;
    if (!rawPort) {
      throw new Error(
        "PORT environment variable is required but was not provided.",
      );
    }
    const parsedPort = Number(rawPort);
    if (Number.isNaN(parsedPort) || parsedPort <= 0) {
      throw new Error(`Invalid PORT value: "${rawPort}"`);
    }
    port = parsedPort;
  }

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;

            // Charting + data-vis (recharts, d3)
            if (
              id.includes("/recharts/") ||
              id.includes("/d3-shape/") ||
              id.includes("/d3-color/") ||
              id.includes("/d3-interpolate/") ||
              id.includes("/d3-scale/") ||
              id.includes("/d3-time/") ||
              id.includes("/d3-format/") ||
              id.includes("/d3-array/") ||
              id.includes("/victory-vendor/")
            ) {
              return "vendor-charts";
            }

            // Maps (react-simple-maps + d3-geo + topojson)
            if (
              id.includes("/react-simple-maps/") ||
              id.includes("/d3-geo/") ||
              id.includes("/topojson")
            ) {
              return "vendor-maps";
            }

            // Animation
            if (id.includes("/framer-motion/")) {
              return "vendor-motion";
            }

            // Drag-and-drop
            if (id.includes("/@dnd-kit/")) {
              return "vendor-dnd";
            }

            // Icons
            if (id.includes("/lucide-react/") || id.includes("/react-icons/")) {
              return "vendor-icons";
            }

            // Radix UI primitives
            if (id.includes("/@radix-ui/")) {
              return "vendor-radix";
            }

            // Forms
            if (
              id.includes("/react-hook-form/") ||
              id.includes("/@hookform/") ||
              id.includes("/zod/")
            ) {
              return "vendor-forms";
            }

            // TanStack Query
            if (id.includes("/@tanstack/")) {
              return "vendor-query";
            }

            // React core
            if (
              id.includes("/react-dom/") ||
              id.includes("/react/") ||
              id.includes("/scheduler/")
            ) {
              return "vendor-react";
            }

            // Let Rollup decide placement for all other node_modules
            return undefined;
          },
        },
      },
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
