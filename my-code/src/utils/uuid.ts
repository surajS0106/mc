/**
 * UUID Utilities — Phase 28c
 *
 * Lightweight UUID v4 generation using Node.js crypto (no dependencies).
 */

import { randomUUID as _randomUUID } from "node:crypto";

/** Generate a RFC 4122 v4 UUID. */
export function randomUUID(): string {
  return _randomUUID();
}

/**
 * Generate a short ID — first 8 hex chars of a UUID (enough for display/dedup).
 * Not cryptographically strong for secrets, but fine for task IDs, message IDs, etc.
 */
export function shortId(): string {
  return _randomUUID().replace(/-/g, "").slice(0, 8);
}

/** Generate a prefixed ID: `{prefix}_{shortId}`, e.g. `task_a3f9c1b2`. */
export function prefixedId(prefix: string): string {
  return `${prefix}_${shortId()}`;
}

/** Validate that a string looks like a UUID v4. */
export function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}
