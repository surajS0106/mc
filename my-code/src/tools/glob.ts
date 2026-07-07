import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { buildTool } from "./Tool.js";

const schema = z.object({
  pattern: z.string().describe("Glob pattern (supports ** recursion)"),
  path: z.string().optional().describe("Directory to search in (default = cwd)"),
});

function globToRegex(pattern: string): RegExp {
  const p = pattern.replace(/\\/g, "/");
  let re = "";
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    if (c === "*" && p[i + 1] === "*") {
      re += ".*";
      i += 2;
      if (p[i] === "/") i++;
    } else if (c === "*") {
      re += "[^/]*";
      i++;
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else if (c !== undefined && /[.+^${}()|[\]\\]/.test(c)) {
      re += "\\" + c;
      i++;
    } else {
      re += c;
      i++;
    }
  }
  return new RegExp("^" + re + "$");
}

export const globTool = buildTool({
  name: "Glob",
  description:
    "Find files matching a glob pattern (supports ** recursion). Returns up to 200 paths, newest first. Example patterns: '**/*.ts', 'src/**/*.tsx', '*.md'.",
  inputSchema: schema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Globbing ${input.pattern}`,
  renderToolUse: (input) => `Glob ${input.pattern}`,
  async call(input, ctx) {
    const cwd = input.path ?? ctx.cwd;
    const absCwd = path.isAbsolute(cwd) ? cwd : path.resolve(ctx.cwd, cwd);
    const regex = globToRegex(input.pattern);

    try {
      const entries = await fs.readdir(absCwd, { recursive: true, withFileTypes: true });
      const matching: string[] = [];

      for (const e of entries) {
        if (!e.isFile()) continue;
        const parentDir: string =
          (e as unknown as { parentPath?: string }).parentPath ??
          (e as unknown as { path?: string }).path ??
          absCwd;
        const fullPath = path.join(parentDir, e.name);
        const relPath = path.relative(absCwd, fullPath).replace(/\\/g, "/");
        if (regex.test(relPath)) matching.push(fullPath);
      }

      if (matching.length === 0) return "(no matches)";

      const withMtime = await Promise.all(
        matching.slice(0, 500).map(async (p) => {
          try {
            const s = await fs.stat(p);
            return { p, mtime: s.mtimeMs };
          } catch {
            return { p, mtime: 0 };
          }
        })
      );
      withMtime.sort((a, b) => b.mtime - a.mtime);
      return withMtime
        .slice(0, 200)
        .map((x) => {
          // Show paths relative to the search root; keep absolute only when the
          // match lives outside it (rare). Forward slashes for consistency.
          const rel = path.relative(absCwd, x.p).replace(/\\/g, "/");
          return rel && !rel.startsWith("..") ? rel : x.p.replace(/\\/g, "/");
        })
        .join("\n");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return `glob failed: ${msg}`;
    }
  },
});
