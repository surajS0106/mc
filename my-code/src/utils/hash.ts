/**
 * Hash Utilities — Phase 28c
 *
 * File and content hashing for staleness detection, cache keys, and dedup.
 * Uses Node.js built-in crypto — no dependencies.
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";

// ─── String / Buffer hashing ──────────────────────────────────────────────────

/** SHA-256 hex digest of a string or Buffer. */
export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/** MD5 hex digest (fast, NOT cryptographically secure — use for cache keys only). */
export function md5(content: string | Buffer): string {
  return createHash("md5").update(content).digest("hex");
}

/** Short 8-char hash — suitable for display/cache keys, not security. */
export function shortHash(content: string | Buffer): string {
  return sha256(content).slice(0, 8);
}

// ─── File hashing ─────────────────────────────────────────────────────────────

/**
 * Hash a file's content with SHA-256. Returns null if the file can't be read.
 */
export async function hashFile(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath);
    return sha256(content);
  } catch {
    return null;
  }
}

/**
 * Check if a file's content has changed since a previously stored hash.
 * Returns true if changed (or if the file is unreadable).
 */
export async function fileChanged(
  filePath: string,
  previousHash: string,
): Promise<boolean> {
  const current = await hashFile(filePath);
  if (current === null) return true;
  return current !== previousHash;
}

// ─── Stable object fingerprint ────────────────────────────────────────────────

/**
 * Stable JSON fingerprint of any serializable value.
 * Keys are sorted so `{b:1,a:2}` and `{a:2,b:1}` produce the same hash.
 */
export function fingerprint(value: unknown): string {
  const json = JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort())
      : v
  );
  return sha256(json ?? "null");
}
