/**
 * Session Title Generator — Phase 28c
 *
 * Auto-derives a session title from the first user message.
 * Used when no explicit session name is set.
 */

/** Maximum characters in an auto-generated title. */
const MAX_TITLE_LENGTH = 60;

/**
 * Derive a concise session title from the first user message.
 *
 * Strategy:
 *   1. Strip markdown, newlines, and leading "please"/"can you"/etc.
 *   2. Take the first sentence (up to first `.`, `?`, `!`, or newline).
 *   3. Title-case the first word.
 *   4. Truncate to MAX_TITLE_LENGTH.
 */
export function deriveSessionTitle(firstMessage: string): string {
  if (!firstMessage.trim()) return "New Session";

  // Strip markdown formatting
  let text = firstMessage
    .replace(/^```[\s\S]*?```/gm, "")   // code blocks
    .replace(/`[^`]+`/g, "")             // inline code
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1") // bold/italic
    .replace(/^#{1,6}\s+/gm, "")         // headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "") // images
    .trim();

  // Strip common filler openers (case-insensitive)
  text = text.replace(
    /^(please\s+|can\s+you\s+|could\s+you\s+|i\s+want\s+to\s+|i\s+need\s+to\s+|help\s+me\s+)/i,
    ""
  );

  // Take just the first sentence
  const sentenceEnd = text.search(/[.?!\n]/);
  if (sentenceEnd > 0 && sentenceEnd < MAX_TITLE_LENGTH) {
    text = text.slice(0, sentenceEnd);
  }

  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Title-case first character
  if (text.length > 0) {
    text = text[0]!.toUpperCase() + text.slice(1);
  }

  // Truncate
  if (text.length > MAX_TITLE_LENGTH) {
    text = text.slice(0, MAX_TITLE_LENGTH - 1) + "…";
  }

  return text || "New Session";
}

/**
 * Format a session date for display in session listings.
 * Returns a human-readable relative date: "today", "yesterday", "3 days ago", etc.
 */
export function formatSessionDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
