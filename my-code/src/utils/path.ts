/**
 * Path Utilities — Phase 28c
 *
 * Tilde expansion, normalization, and safe relative-path helpers.
 */

import * as os from "node:os";
import * as path from "node:path";

/**
 * Expand leading `~` to the user's home directory.
 *
 * @example
 * expandTilde("~/projects/foo") // "/home/user/projects/foo"
 * expandTilde("/absolute/path") // "/absolute/path"
 */
export function expandTilde(filePath: string): string {
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Normalize a path: expand tilde, resolve `.` and `..`, normalize separators.
 */
export function normalizePath(filePath: string): string {
  return path.normalize(expandTilde(filePath));
}

/**
 * Resolve a path against a base directory, expanding tildes.
 * If `filePath` is already absolute, returns it normalized.
 */
export function resolvePath(filePath: string, base: string = process.cwd()): string {
  const expanded = expandTilde(filePath);
  if (path.isAbsolute(expanded)) return path.normalize(expanded);
  return path.resolve(base, expanded);
}

/**
 * Make a path relative to `base`, with Unix separators.
 * Returns the original path if it can't be made relative.
 */
export function toRelative(filePath: string, base: string = process.cwd()): string {
  try {
    return path.relative(base, filePath).replace(/\\/g, "/");
  } catch {
    return filePath;
  }
}

/**
 * Check if `child` is inside `parent` (safe path containment check).
 * Prevents path-traversal: `../secret` would return false.
 */
export function isInsidePath(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Strip the file extension from a path.
 * @example stripExtension("foo/bar.ts") // "foo/bar"
 */
export function stripExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext ? filePath.slice(0, -ext.length) : filePath;
}
