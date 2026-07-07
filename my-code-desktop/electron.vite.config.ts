import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    build: {
      outDir: "out/main",
      rollupOptions: {
        input: { index: resolve(__dirname, "electron/main.ts") },
        // CommonJS so Electron's module loader is happy with node builtins
        // (net, child_process) used by the backend manager + bridge client.
        output: { format: "cjs", entryFileNames: "index.js" },
        external: ["electron"],
      },
    },
  },
  preload: {
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: { index: resolve(__dirname, "electron/preload.ts") },
        output: { format: "cjs", entryFileNames: "index.js" },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "renderer"),
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: resolve(__dirname, "renderer/index.html"),
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "renderer/src"),
      },
    },
  },
});
