// File index for `@`-mention autocomplete. Scans the workspace once (async,
// off the keystroke path) and caches the relative paths; callers filter the
// cached list synchronously while typing.

import fs from "node:fs/promises";
import path from "node:path";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next",
  ".cache", "coverage", ".turbo", ".vercel", "vendor", "__pycache__",
]);
const MAX_FILES = 5000;

let cache: { root: string; files: string[] } | null = null;
let inFlight: Promise<void> | null = null;

async function scan(root: string): Promise<string[]> {
  const results: string[] = [];
  const queue: string[] = [root];
  while (queue.length && results.length < MAX_FILES) {
    const dir = queue.shift()!;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, String(e.name));
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue;
        queue.push(full);
      } else if (e.isFile()) {
        results.push(path.relative(root, full).split(path.sep).join("/"));
        if (results.length >= MAX_FILES) break;
      }
    }
  }
  return results;
}

export function cachedFiles(root: string): string[] | null {
  return cache && cache.root === root ? cache.files : null;
}

// Kicks off a one-time scan for `root`. `onReady` fires only when an async scan
// completes (not when the cache is already warm), so callers can safely invoke
// this on every render without risking a re-render loop.
export function ensureScan(root: string, onReady?: () => void): void {
  if (cache && cache.root === root) return;
  if (inFlight) return;
  inFlight = scan(root)
    .then((files) => {
      cache = { root, files };
      inFlight = null;
      onReady?.();
    })
    .catch(() => {
      inFlight = null;
    });
}

export function matchFiles(root: string, query: string, limit = 8): string[] {
  const files = cachedFiles(root);
  if (!files) return [];
  const q = query.toLowerCase();
  if (!q) return files.slice(0, limit);

  const starts: string[] = [];
  const contains: string[] = [];
  for (const f of files) {
    const fl = f.toLowerCase();
    const base = fl.slice(fl.lastIndexOf("/") + 1);
    if (base.startsWith(q) || fl.startsWith(q)) starts.push(f);
    else if (fl.includes(q)) contains.push(f);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
