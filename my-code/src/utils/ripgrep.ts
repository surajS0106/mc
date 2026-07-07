/**
 * Ripgrep utility — Phase 28a
 *
 * Wraps the `rg` binary for fast file-content search.
 * Falls back to our GrepTool's Node.js implementation when rg is not on PATH.
 *
 * 10× faster than Node.js grep for large codebases.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";

const execFileAsync = promisify(execFile);

export interface RipgrepMatch {
  file: string;
  line: number;
  column: number;
  text: string;
}

export interface RipgrepOptions {
  /** Root directory to search in */
  cwd?: string;
  /** Case-insensitive search */
  ignoreCase?: boolean;
  /** Treat pattern as a fixed string (not regex) */
  fixedStrings?: boolean;
  /** Glob patterns to include (e.g. "*.ts") */
  include?: string[];
  /** Glob patterns to exclude (e.g. "node_modules") */
  exclude?: string[];
  /** Max results to return (default: 1000) */
  maxResults?: number;
  /** Also search hidden files */
  hidden?: boolean;
  /** Abort signal */
  signal?: AbortSignal;
}

// ─── Binary detection ─────────────────────────────────────────────────────────

let _rgAvailable: boolean | undefined;

export async function isRipgrepAvailable(): Promise<boolean> {
  if (_rgAvailable !== undefined) return _rgAvailable;
  try {
    await execFileAsync("rg", ["--version"], { timeout: 3000 });
    _rgAvailable = true;
  } catch {
    _rgAvailable = false;
  }
  return _rgAvailable;
}

// ─── Main search ──────────────────────────────────────────────────────────────

/**
 * Search for a pattern using ripgrep. Returns structured match objects.
 * Returns null if rg is not available (caller should fall back to GrepTool).
 */
export async function ripgrepSearch(
  pattern: string,
  opts: RipgrepOptions = {},
): Promise<RipgrepMatch[] | null> {
  if (!(await isRipgrepAvailable())) return null;

  const {
    cwd = process.cwd(),
    ignoreCase = false,
    fixedStrings = false,
    include = [],
    exclude = [],
    maxResults = 1000,
    hidden = false,
  } = opts;

  const args: string[] = [
    "--json",
    "--line-number",
    "--column",
    `--max-count=${maxResults}`,
  ];

  if (ignoreCase) args.push("--ignore-case");
  if (fixedStrings) args.push("--fixed-strings");
  if (hidden) args.push("--hidden");

  for (const g of include) args.push("--glob", g);
  for (const g of exclude) args.push("--glob", `!${g}`);

  args.push("--", pattern, ".");

  try {
    const { stdout } = await execFileAsync("rg", args, {
      cwd,
      maxBuffer: 50 * 1024 * 1024, // 50 MB
      signal: opts.signal,
    });

    const matches: RipgrepMatch[] = [];
    for (const line of stdout.split("\n")) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line) as {
          type: string;
          data?: {
            path?: { text?: string };
            line_number?: number;
            absolute_offset?: number;
            submatches?: Array<{ start: number }>;
            lines?: { text?: string };
          };
        };
        if (obj.type !== "match" || !obj.data) continue;
        const d = obj.data;
        matches.push({
          file: path.relative(cwd, d.path?.text ?? ""),
          line: d.line_number ?? 0,
          column: (d.submatches?.[0]?.start ?? 0) + 1,
          text: (d.lines?.text ?? "").replace(/\n$/, ""),
        });
      } catch {
        // skip malformed JSON lines
      }
    }
    return matches;
  } catch (err: unknown) {
    // rg exit code 1 = no matches (not an error), exit code 2 = real error
    const code = (err as { code?: number }).code;
    if (code === 1) return []; // no matches
    return null; // real error — caller falls back
  }
}

/**
 * Convenience: search and format as a plain-text report.
 */
export async function ripgrepFormat(
  pattern: string,
  opts: RipgrepOptions = {},
): Promise<string | null> {
  const matches = await ripgrepSearch(pattern, opts);
  if (matches === null) return null;
  if (matches.length === 0) return "(no matches)";
  return matches
    .map((m) => `${m.file}:${m.line}:${m.column}: ${m.text}`)
    .join("\n");
}
