import * as fs from "node:fs";
import { getAutoMemEntrypoint, getAutoMemPath } from "./paths.js";
import {
  MEMORY_FRONTMATTER_EXAMPLE,
  TRUSTING_RECALL_SECTION,
  TYPES_SECTION,
  WHAT_NOT_TO_SAVE_SECTION,
  WHEN_TO_ACCESS_SECTION,
} from "./memoryTypes.js";

export const ENTRYPOINT_NAME = "MEMORY.md";
export const MAX_ENTRYPOINT_LINES = 200;
export const MAX_ENTRYPOINT_BYTES = 25_000;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export type EntrypointTruncation = {
  content: string;
  lineCount: number;
  byteCount: number;
  wasLineTruncated: boolean;
  wasByteTruncated: boolean;
};

export function truncateEntrypointContent(raw: string): EntrypointTruncation {
  const trimmed = raw.trim();
  const contentLines = trimmed.split("\n");
  const lineCount = contentLines.length;
  const byteCount = trimmed.length;

  const wasLineTruncated = lineCount > MAX_ENTRYPOINT_LINES;
  const wasByteTruncated = byteCount > MAX_ENTRYPOINT_BYTES;

  if (!wasLineTruncated && !wasByteTruncated) {
    return {
      content: trimmed,
      lineCount,
      byteCount,
      wasLineTruncated,
      wasByteTruncated,
    };
  }

  let truncated = wasLineTruncated
    ? contentLines.slice(0, MAX_ENTRYPOINT_LINES).join("\n")
    : trimmed;

  if (truncated.length > MAX_ENTRYPOINT_BYTES) {
    const cutAt = truncated.lastIndexOf("\n", MAX_ENTRYPOINT_BYTES);
    truncated = truncated.slice(0, cutAt > 0 ? cutAt : MAX_ENTRYPOINT_BYTES);
  }

  const reason =
    wasByteTruncated && !wasLineTruncated
      ? `${formatFileSize(byteCount)} (limit: ${formatFileSize(MAX_ENTRYPOINT_BYTES)}) — index entries are too long`
      : wasLineTruncated && !wasByteTruncated
        ? `${lineCount} lines (limit: ${MAX_ENTRYPOINT_LINES})`
        : `${lineCount} lines and ${formatFileSize(byteCount)}`;

  return {
    content:
      truncated +
      `\n\n> WARNING: ${ENTRYPOINT_NAME} is ${reason}. Only part of it was loaded. Keep index entries to one line under ~200 chars; move detail into topic files.`,
    lineCount,
    byteCount,
    wasLineTruncated,
    wasByteTruncated,
  };
}

export function buildMemoryLines(memoryDir: string): string[] {
  const howToSave = [
    "## How to save memories",
    "",
    "Saving a memory is a two-step process:",
    "",
    "**Step 1** — write the memory to its own file (e.g., `user_role.md`, `feedback_testing.md`) using this frontmatter format:",
    "",
    ...MEMORY_FRONTMATTER_EXAMPLE,
    "",
    `**Step 2** — add a pointer to that file in \`${ENTRYPOINT_NAME}\`. \`${ENTRYPOINT_NAME}\` is an index, not a memory — each entry should be one line, under ~150 characters: \`- [Title](file.md) — one-line hook\`. It has no frontmatter. Never write memory content directly into \`${ENTRYPOINT_NAME}\`.`,
    "",
    `- \`${ENTRYPOINT_NAME}\` is always loaded into your conversation context — lines after ${MAX_ENTRYPOINT_LINES} will be truncated, so keep the index concise`,
    "- Keep the name, description, and type fields in memory files up-to-date with the content",
    "- Organize memory semantically by topic, not chronologically",
    "- Update or remove memories that turn out to be wrong or outdated",
    "- Do not write duplicate memories. First check if there is an existing memory you can update before writing a new one.",
  ];

  const lines: string[] = [
    `# auto memory`,
    "",
    `You have a persistent, file-based memory system at \`${memoryDir}\`. This directory already exists — write to it directly with the Write tool (do not run mkdir or check for its existence).`,
    "",
    "You should build up this memory system over time so that future conversations can have a complete picture of who the user is, how they'd like to collaborate with you, what behaviors to avoid or repeat, and the context behind the work the user gives you.",
    "",
    "If the user explicitly asks you to remember something, save it immediately as whichever type fits best. If they ask you to forget something, find and remove the relevant entry.",
    "",
    ...TYPES_SECTION,
    ...WHAT_NOT_TO_SAVE_SECTION,
    "",
    ...howToSave,
    "",
    ...WHEN_TO_ACCESS_SECTION,
    "",
    ...TRUSTING_RECALL_SECTION,
    "",
  ];

  return lines;
}

export function loadMemoryPrompt(cwd: string): string {
  const memoryDir = getAutoMemPath(cwd);
  const entrypoint = getAutoMemEntrypoint(cwd);

  let entrypointContent = "";
  try {
    if (fs.existsSync(entrypoint)) {
      entrypointContent = fs.readFileSync(entrypoint, "utf8");
    }
  } catch {
    // No memory file yet or unreadable
  }

  const lines = buildMemoryLines(memoryDir);

  if (entrypointContent.trim()) {
    const t = truncateEntrypointContent(entrypointContent);
    lines.push(`## ${ENTRYPOINT_NAME}`, "", t.content);
  } else {
    lines.push(
      `## ${ENTRYPOINT_NAME}`,
      "",
      `Your ${ENTRYPOINT_NAME} is currently empty. When you save new memories, they will appear here.`
    );
  }

  return lines.join("\n");
}
