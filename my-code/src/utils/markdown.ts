/**
 * Markdown Utilities — Phase 28c
 *
 * Lightweight parsing and formatting helpers for markdown content.
 * No external dependencies — pure string manipulation.
 */

// ─── Code block extraction ────────────────────────────────────────────────────

export interface CodeBlock {
  lang: string;
  code: string;
}

/** Extract all fenced code blocks from a markdown string. */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const pattern = /^```(\w*)\n([\s\S]*?)^```/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push({
      lang: match[1] ?? "",
      code: match[2] ?? "",
    });
  }
  return blocks;
}

// ─── Heading extraction ───────────────────────────────────────────────────────

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  /** Character offset in the original string */
  offset: number;
}

/** Extract all ATX-style headings (# H1, ## H2, …) from markdown. */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const lines = markdown.split("\n");
  let offset = 0;

  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+)/);
    if (m) {
      headings.push({
        level: m[1]!.length as Heading["level"],
        text: m[2]!.trim(),
        offset,
      });
    }
    offset += line.length + 1; // +1 for \n
  }
  return headings;
}

// ─── Stripper ────────────────────────────────────────────────────────────────

/** Strip all markdown syntax, returning plain text. */
export function stripMarkdown(markdown: string): string {
  return (
    markdown
      // Fenced code blocks → just the code
      .replace(/^```[\w]*\n([\s\S]*?)^```/gm, "$1")
      // Inline code
      .replace(/`([^`]+)`/g, "$1")
      // Headers
      .replace(/^#{1,6}\s+/gm, "")
      // Bold / italic
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
      // Links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Images
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      // Block quotes
      .replace(/^>\s*/gm, "")
      // Horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      .trim()
  );
}

// ─── Simple formatter ─────────────────────────────────────────────────────────

/** Wrap plain text at `width` characters without breaking words. */
export function wordWrap(text: string, width = 80): string {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") { lines.push(""); continue; }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      if (line.length + word.length + 1 > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) lines.push(line);
  }
  return lines.join("\n");
}
