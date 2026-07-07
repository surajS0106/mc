/**
 * Output Truncation Utility — Phase 28c
 *
 * Smart truncation that preserves context at both the start and end of output.
 * Used by BashTool, GrepTool, and any tool that produces unbounded output.
 */

// ─── Byte-level truncation ────────────────────────────────────────────────────

const DEFAULT_MAX_BYTES = 100_000; // ~100 KB
const DEFAULT_HEAD_RATIO = 0.4;    // Show 40% from the top

/**
 * Truncate a string to `maxBytes` bytes, keeping a head section from the
 * start and a tail section from the end with an ellipsis in the middle.
 *
 * @param text     - The text to truncate
 * @param maxBytes - Maximum byte length (default: 100 KB)
 * @param label    - What was truncated, e.g. "output" or "file"
 */
export function truncateOutput(
  text: string,
  maxBytes: number = DEFAULT_MAX_BYTES,
  label = "output",
): string {
  const buf = Buffer.from(text, "utf-8");
  if (buf.length <= maxBytes) return text;

  const headBytes = Math.floor(maxBytes * DEFAULT_HEAD_RATIO);
  const tailBytes = maxBytes - headBytes;
  const omitted = buf.length - maxBytes;

  const head = buf.subarray(0, headBytes).toString("utf-8");
  const tail = buf.subarray(buf.length - tailBytes).toString("utf-8");

  return (
    `${head}\n` +
    `\n… [${label} truncated: ${formatBytes(omitted)} omitted of ${formatBytes(buf.length)} total] …\n\n` +
    `${tail}`
  );
}

// ─── Line-level truncation ────────────────────────────────────────────────────

/**
 * Truncate to `maxLines` lines, keeping head and tail sections.
 */
export function truncateLines(
  text: string,
  maxLines = 500,
  label = "output",
): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;

  const headLines = Math.floor(maxLines * DEFAULT_HEAD_RATIO);
  const tailLines = maxLines - headLines;
  const omitted = lines.length - maxLines;

  return [
    ...lines.slice(0, headLines),
    "",
    `… [${label} truncated: ${omitted} lines omitted of ${lines.length} total] …`,
    "",
    ...lines.slice(lines.length - tailLines),
  ].join("\n");
}

// ─── Ellipsis truncation ──────────────────────────────────────────────────────

/**
 * Simple end-truncation with ellipsis. Use for single-line values.
 */
export function ellipsis(text: string, maxLength = 80): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
