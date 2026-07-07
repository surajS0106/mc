import esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const production = process.argv.includes("--production");

const shared = {
  bundle: true,
  sourcemap: !production,
  minify: production,
  logLevel: "info",
};

const host = {
  ...shared,
  entryPoints: ["src/extension.ts"],
  outfile: "out/extension.js",
  platform: "node",
  format: "cjs",
  target: "node20",
  external: [
    "vscode",
    "@modelcontextprotocol/sdk",
    "@modelcontextprotocol/sdk/*",
  ],
};

const webview = {
  ...shared,
  entryPoints: ["webview/src/main.tsx"],
  outfile: "out/webview.js",
  platform: "browser",
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  loader: { ".css": "text" },
  define: {
    "process.env.NODE_ENV": production ? '"production"' : '"development"',
  },
};

if (watch) {
  const ctxs = await Promise.all([
    esbuild.context(host),
    esbuild.context(webview),
  ]);
  await Promise.all(ctxs.map((c) => c.watch()));
  console.log("[esbuild] watching…");
} else {
  await Promise.all([esbuild.build(host), esbuild.build(webview)]);
  console.log("[esbuild] done");
}
