import * as path from "node:path";
import * as fs from "node:fs";
import { projectDir } from "../session/projectStore.js";

/**
 * Phase 1 — Global Memory Storage
 *
 * Memory files are stored GLOBALLY (outside the user's git repo) to prevent
 * them from polluting .gitignore. This matches Beta exactly:
 *   Beta:  ~/.claude/projects/<sanitized-path>/memory/
 *   my-code:  ~/.my-code/projects/<sha256-hash>/memory/
 *
 * This means no more .my-code/memory/ created inside the user's codebase.
 */
export function getAutoMemPath(cwd: string): string {
  return path.join(projectDir(cwd), "memory");
}

export function getAutoMemEntrypoint(cwd: string): string {
  return path.join(getAutoMemPath(cwd), "MEMORY.md");
}

export function ensureMemoryDirExists(cwd: string): void {
  const memDir = getAutoMemPath(cwd);
  if (!fs.existsSync(memDir)) {
    fs.mkdirSync(memDir, { recursive: true, mode: 0o700 });
  }
}

/** True when `filePath` is inside the auto-memory directory for `cwd`. */
export function isAutoMemPath(cwd: string, filePath: string): boolean {
  const memDir = getAutoMemPath(cwd);
  // Normalize separators for Windows compatibility
  const norm = (p: string) => p.replace(/\\/g, "/");
  return norm(filePath).startsWith(norm(memDir));
}

