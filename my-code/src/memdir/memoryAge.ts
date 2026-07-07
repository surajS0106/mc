/**
 * Memory Age Utilities — Phase 23
 *
 * Human-readable age + staleness warnings for memory files.
 * Models are poor at date arithmetic — "47 days ago" triggers
 * staleness reasoning better than a raw ISO timestamp.
 *
 * Ported from beta's src/memdir/memoryAge.ts
 */

/** Days elapsed since mtime. Floor-rounded — 0 = today, 1 = yesterday. */
export function memoryAgeDays(mtimeMs: number): number {
  return Math.max(0, Math.floor((Date.now() - mtimeMs) / 86_400_000));
}

/** Human-readable age string. */
export function memoryAge(mtimeMs: number): string {
  const d = memoryAgeDays(mtimeMs);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

/**
 * Plain-text staleness caveat for memories > 1 day old.
 * Returns '' for fresh (today/yesterday) memories — warning there is noise.
 *
 * Use when the consumer provides its own wrapping context
 * (e.g. injected into system prompt as a block).
 */
export function memoryFreshnessText(mtimeMs: number): string {
  const d = memoryAgeDays(mtimeMs);
  if (d <= 1) return "";
  return (
    `This memory is ${d} days old. ` +
    `Memories are point-in-time observations, not live state — ` +
    `claims about code behavior or file:line citations may be outdated. ` +
    `Verify against current code before asserting as fact.`
  );
}

/**
 * Per-memory staleness note wrapped in <system-reminder> tags.
 * Returns '' for memories ≤ 1 day old.
 */
export function memoryFreshnessNote(mtimeMs: number): string {
  const text = memoryFreshnessText(mtimeMs);
  if (!text) return "";
  return `<system-reminder>${text}</system-reminder>\n`;
}
