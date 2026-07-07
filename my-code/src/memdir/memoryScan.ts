/**
 * Memory Directory Scanner — Phase 23
 *
 * Scans the memory directory for .md files, reads their YAML frontmatter,
 * and returns a sorted header list. Used by:
 *   - Context injection (shows the model what memories exist)
 *   - /memory command (list/show/delete)
 *   - Future: semantic recall (find relevant memories by query)
 *
 * Ported from beta's src/memdir/memoryScan.ts
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { MemoryType } from "./memoryTypes.js";
import { MEMORY_TYPES } from "./memoryTypes.js";
import { memoryAge } from "./memoryAge.js";

export interface MemoryHeader {
  /** Path relative to the memory directory, e.g. "user_role.md" */
  filename: string;
  /** Absolute path */
  filePath: string;
  /** mtime in milliseconds */
  mtimeMs: number;
  /** From frontmatter `description:` field */
  description: string | null;
  /** From frontmatter `type:` field */
  type: MemoryType | undefined;
  /** From frontmatter `name:` field */
  name: string | null;
}

const MAX_MEMORY_FILES = 200;

// ─── Frontmatter parser ───────────────────────────────────────────────────────

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  type?: string;
}

function parseFrontmatter(content: string): ParsedFrontmatter {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return {};

  const end = trimmed.indexOf("---", 3);
  if (end === -1) return {};

  const block = trimmed.slice(3, end);
  const result: ParsedFrontmatter = {};

  for (const line of block.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
    if (key === "name") result.name = value;
    else if (key === "description") result.description = value;
    else if (key === "type") result.type = value;
  }

  return result;
}

function parseMemoryType(raw: string | undefined): MemoryType | undefined {
  if (!raw) return undefined;
  return (MEMORY_TYPES as readonly string[]).includes(raw)
    ? (raw as MemoryType)
    : undefined;
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

/**
 * Scan a memory directory for .md files, read their frontmatter,
 * return headers sorted newest-first (capped at 200).
 */
export async function scanMemoryFiles(memoryDir: string): Promise<MemoryHeader[]> {
  try {
    const entries = await fs.readdir(memoryDir, { recursive: true });
    const mdFiles = (entries as string[]).filter(
      (f) => f.endsWith(".md") && path.basename(f) !== "MEMORY.md"
    );

    const results = await Promise.allSettled(
      mdFiles.map(async (relative): Promise<MemoryHeader> => {
        const filePath = path.join(memoryDir, relative);
        const stat = await fs.stat(filePath);
        // Read just the first 30 lines for frontmatter (performance)
        const handle = await fs.open(filePath, "r");
        let content = "";
        try {
          const buf = Buffer.alloc(2048);
          const { bytesRead } = await handle.read(buf, 0, 2048, 0);
          content = buf.slice(0, bytesRead).toString("utf-8");
        } finally {
          await handle.close();
        }

        const fm = parseFrontmatter(content);
        return {
          filename: relative,
          filePath,
          mtimeMs: stat.mtimeMs,
          description: fm.description ?? null,
          type: parseMemoryType(fm.type),
          name: fm.name ?? null,
        };
      })
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<MemoryHeader> => r.status === "fulfilled"
      )
      .map((r) => r.value)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, MAX_MEMORY_FILES);
  } catch {
    return [];
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

/**
 * Format memory headers as a compact text manifest — one line per file.
 * Used in system prompt injection and extraction prompts.
 */
export function formatMemoryManifest(memories: MemoryHeader[]): string {
  if (memories.length === 0) return "(no memory files)";
  return memories
    .map((m) => {
      const tag = m.type ? `[${m.type}] ` : "";
      const age = memoryAge(m.mtimeMs);
      const label = m.name ?? m.filename;
      return m.description
        ? `- ${tag}${label} (${age}): ${m.description}`
        : `- ${tag}${label} (${age})`;
    })
    .join("\n");
}

/**
 * Read a single memory file's full content.
 * Returns null if the file doesn't exist or can't be read.
 */
export async function readMemoryFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Delete a memory file by path.
 * Returns true on success, false if not found.
 */
export async function deleteMemoryFile(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
