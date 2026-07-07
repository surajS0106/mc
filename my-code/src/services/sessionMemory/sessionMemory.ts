/**
 * Session Memory Service — Phase 21 (updated Phase 1 global storage)
 *
 * Periodically extracts a structured summary of the current conversation into
 * a session-scoped markdown file. Unlike the
 * persistent MEMORY.md (which the LLM manages manually), this file is:
 *   • Written automatically, in the background
 *   • Scoped to the current working directory / session
 *   • Used as a cheap compaction source (Phase 22 / 23)
 *
 * Architecture (matching beta's SessionMemory service):
 *   1. After each turn, `maybeExtractSessionMemory` checks thresholds.
 *   2. If thresholds are met, it fires a background extraction (fire-and-forget).
 *   3. The extraction calls `runExtraction(prompt, memoryPath)`.
 *   4. `runExtraction` is provided by QueryEngine: it streams the LLM response
 *      and writes the resulting markdown directly to disk — no Edit tool needed.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ChatMessage } from "../../agent/types.js";
import {
  isExtractionInProgress,
  markExtractionCompleted,
  markExtractionStarted,
  markSessionMemoryInitialized,
  isSessionMemoryInitialized,
  hasMetInitThreshold,
  hasMetUpdateThreshold,
  getToolCallsBetweenUpdates,
  recordExtractionTokenCount,
  setLastSummarizedMessageId,
} from "./sessionMemoryState.js";

// ─── Path helpers ─────────────────────────────────────────────────────────────
// Phase 1: Session memory now lives globally, not inside the user's git repo.
// Beta:  ~/.claude/projects/<path>/session-memory.md
// my-code:  ~/.my-code/projects/<hash>/session-memory.md
import { projectDir } from "../../session/projectStore.js";

export function getSessionMemoryDir(cwd: string): string {
  return projectDir(cwd);
}

export function getSessionMemoryPath(cwd: string): string {
  return path.join(projectDir(cwd), "session-memory.md");
}

// ─── Token estimation (simple char-based, same as snipCompact) ───────────────

function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    chars += (msg.content ?? "").length;
    for (const tc of msg.tool_calls ?? []) {
      chars += JSON.stringify(tc.function.arguments).length;
    }
  }
  return Math.ceil(chars / 4);
}

// ─── Tool call counter ────────────────────────────────────────────────────────

function countToolCallsSince(
  messages: ChatMessage[],
  sinceId: string | undefined
): number {
  let count = 0;
  let found = sinceId === undefined;
  for (const msg of messages) {
    if (!found) {
      if ((msg as { tool_use_id?: string }).tool_use_id === sinceId) found = true;
      continue;
    }
    if (msg.tool_calls && msg.tool_calls.length > 0) count += msg.tool_calls.length;
  }
  return count;
}

// ─── Extraction decision ──────────────────────────────────────────────────────

let lastExtractionMessageId: string | undefined;

export function shouldExtractSessionMemory(messages: ChatMessage[]): boolean {
  const tokens = estimateTokens(messages);

  if (!isSessionMemoryInitialized()) {
    if (!hasMetInitThreshold(tokens)) return false;
    markSessionMemoryInitialized();
  }

  const meetsTokenThreshold = hasMetUpdateThreshold(tokens);
  if (!meetsTokenThreshold) return false;

  const toolCalls = countToolCallsSince(messages, lastExtractionMessageId);
  const meetsToolCallThreshold = toolCalls >= getToolCallsBetweenUpdates();

  // Extract when:
  //   - token threshold AND tool call threshold are both met, OR
  //   - token threshold is met and the last turn has no pending tool calls
  const lastMsg = messages[messages.length - 1];
  const lastHasToolCalls =
    lastMsg?.tool_calls != null && lastMsg.tool_calls.length > 0;

  return meetsToolCallThreshold || !lastHasToolCalls;
}

// ─── Extraction prompt builder ────────────────────────────────────────────────
//
// Beta approach: ask the LLM to output the updated markdown DIRECTLY as its
// response (no tool calls). The caller writes the file. This avoids needing an
// Edit tool in the sub-engine and prevents the memory extractor from touching
// user files.

function buildExtractionPrompt(
  currentMemory: string,
  messages: ChatMessage[]
): string {
  // Last 30 messages — enough for a useful summary, cheap to process.
  const recentMessages = messages
    .slice(-30)
    .map(m => {
      const role = m.role === "tool" ? "tool_result" : m.role;
      // Cap each message body at 500 chars so the summariser isn't overwhelmed.
      const body = (m.content ?? "").slice(0, 500);
      return `<${role}>${body}</${role}>`;
    })
    .join("\n");

  return [
    "You are a session memory extractor for a coding assistant called my-code.",
    "Your ONLY job is to output an updated session memory markdown file.",
    "",
    "Rules:",
    "- Output ONLY the raw markdown. No commentary, no code fences, no tool calls.",
    "- Keep the output under 800 tokens / ~3200 characters.",
    "- Preserve ALL four sections even if empty.",
    "- Be concise: bullet points, not prose.",
    "",
    "Current session memory (update this):",
    "<current_memory>",
    currentMemory || "(empty — this is the first extraction)",
    "</current_memory>",
    "",
    "Recent conversation:",
    "<recent_conversation>",
    recentMessages,
    "</recent_conversation>",
    "",
    "Output the complete updated session memory markdown now:",
  ].join("\n");
}

// ─── Default template (written on first extraction if file doesn't exist) ────

const TEMPLATE = `# Session Memory

This file is automatically maintained by my-code to track the current session.
It is used to restore context after conversation compaction.

## Active Tasks

(none yet)

## Files Touched

(none yet)

## Key Decisions

(none yet)

## Errors / Blockers

(none yet)
`;

// ─── Core extraction ──────────────────────────────────────────────────────────

export interface SessionMemoryExtractionResult {
  success: boolean;
  memoryPath?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Callback type passed from QueryEngine into the extraction.
 *
 * The callback receives the prompt and the target file path.
 * It is responsible for:
 *   1. Streaming the LLM response using the extraction prompt.
 *   2. Writing the resulting text to `memoryPath` on disk.
 *
 * This keeps all I/O inside QueryEngine where we have provider access,
 * while sessionMemory.ts stays pure (no direct provider imports).
 */
export type ExtractionRunner = (
  prompt: string,
  memoryPath: string
) => Promise<void>;

/**
 * Check thresholds and, if met, run a background extraction.
 *
 * NOTE: This is fire-and-forget by design — extraction runs async and does NOT
 * block the main turn. The caller should not await the returned promise unless
 * it specifically needs to wait (e.g. /summary command).
 */
export function maybeExtractSessionMemory(
  messages: ChatMessage[],
  cwd: string,
  runExtraction: ExtractionRunner
): void {
  if (isExtractionInProgress()) return;
  if (!shouldExtractSessionMemory(messages)) return;

  // Capture message ID before async work begins
  const lastMsg = messages[messages.length - 1];
  const capturedMsgId = lastMsg
    ? (lastMsg as { tool_use_id?: string }).tool_use_id
    : undefined;

  markExtractionStarted();

  // Fire-and-forget — errors are caught internally
  _doExtraction(messages, cwd, runExtraction, capturedMsgId).catch(() => {
    markExtractionCompleted();
  });
}

async function _doExtraction(
  messages: ChatMessage[],
  cwd: string,
  runExtraction: ExtractionRunner,
  capturedMsgId: string | undefined
): Promise<void> {
  try {
    const memoryDir = getSessionMemoryDir(cwd);
    const memoryPath = getSessionMemoryPath(cwd);

    // Ensure .my-code/ dir exists (mode 0o700 = owner only)
    await fs.mkdir(memoryDir, { recursive: true, mode: 0o700 });

    // Read existing memory (or use template for first run)
    let currentMemory = "";
    try {
      currentMemory = await fs.readFile(memoryPath, "utf-8");
    } catch {
      // File doesn't exist yet — start with template
      currentMemory = TEMPLATE;
    }

    const prompt = buildExtractionPrompt(currentMemory, messages);

    // `runExtraction` streams the LLM, collects the text, and writes the file.
    await runExtraction(prompt, memoryPath);

    // Gate the next extraction by recording current token count
    recordExtractionTokenCount(estimateTokens(messages));

    // Mark which message was last summarized (skip if mid-tool-call)
    const lastMsg = messages[messages.length - 1];
    const hasToolCalls = lastMsg?.tool_calls != null && lastMsg.tool_calls.length > 0;
    if (!hasToolCalls && lastMsg) {
      setLastSummarizedMessageId(capturedMsgId ?? "");
      lastExtractionMessageId = capturedMsgId;
    }
  } finally {
    markExtractionCompleted();
  }
}

/**
 * Manual extraction — bypasses threshold checks.
 * Used by the /summary slash command.
 */
export async function manuallyExtractSessionMemory(
  messages: ChatMessage[],
  cwd: string,
  runExtraction: ExtractionRunner
): Promise<SessionMemoryExtractionResult> {
  if (messages.length === 0) {
    return { success: false, error: "No messages to summarize" };
  }

  markExtractionStarted();
  try {
    const memoryDir = getSessionMemoryDir(cwd);
    const memoryPath = getSessionMemoryPath(cwd);

    await fs.mkdir(memoryDir, { recursive: true, mode: 0o700 });

    let currentMemory = "";
    try {
      currentMemory = await fs.readFile(memoryPath, "utf-8");
    } catch {
      currentMemory = TEMPLATE;
    }

    const prompt = buildExtractionPrompt(currentMemory, messages);
    await runExtraction(prompt, memoryPath);

    recordExtractionTokenCount(estimateTokens(messages));
    return { success: true, memoryPath };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    markExtractionCompleted();
  }
}

/**
 * Read the current session memory file content.
 * Returns null if the file doesn't exist.
 */
export async function readSessionMemory(cwd: string): Promise<string | null> {
  const memoryPath = getSessionMemoryPath(cwd);
  try {
    return await fs.readFile(memoryPath, "utf-8");
  } catch {
    return null;
  }
}
