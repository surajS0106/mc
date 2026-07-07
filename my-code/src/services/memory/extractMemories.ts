/**
 * Phase 3 — Auto Memory Extraction (Beta parity)
 *
 * Exact port of Beta's `services/extractMemories/extractMemories.ts`.
 *
 * This is the permanent cross-session learning system. After each turn
 * completes (when the model gives a final response with no more tool calls),
 * a background forked agent reads the conversation, identifies new facts,
 * preferences, or architectural decisions, and writes them as UUID-named
 * markdown files to the global memory directory.
 *
 * Key design decisions (matching Beta exactly):
 *
 * 1. CLOSURE-SCOPED STATE — all mutable state lives inside initExtractMemories().
 *    Tests can call initExtractMemories() in beforeEach for a fresh closure.
 *
 * 2. CURSOR PATTERN — lastMemoryMessageUuid tracks the last message processed.
 *    Each run only considers messages added since the previous extraction.
 *
 * 3. MUTUAL EXCLUSION — if the main agent already wrote memory files this turn
 *    (hasMemoryWritesSince), the forked agent is skipped to avoid duplicates.
 *
 * 4. OVERLAP GUARD — if extraction is already running when a new turn ends,
 *    the new context is stashed in pendingContext. A "trailing run" executes
 *    after the current one finishes (only the latest stash matters).
 *
 * 5. POLICY ISLAND — the forked agent gets createAutoMemCanUseTool() permissions:
 *    read/grep/glob free, bash read-only, write/edit only inside memoryDir.
 *
 * 6. skipTranscript: true — the forked agent's messages are never written to
 *    the user's JSONL transcript (no pollution).
 *
 * 7. maxTurns: 5 — hard cap. Well-behaved extractions complete in 2-4 turns:
 *    read existing memories → decide what's new → write UUID file → update index.
 */

import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ChatMessage } from "../../agent/types.js";
import { scanMemoryFiles, formatMemoryManifest } from "../../memdir/memoryScan.js";
import { getAutoMemPath, isAutoMemPath } from "../../memdir/paths.js";

// ============================================================================
// Types
// ============================================================================

export interface ExtractionContext {
  messages: ChatMessage[];
  cwd: string;
  runForkedAgent: (opts: ForkedAgentOpts) => Promise<ForkedAgentResult>;
}

export interface ForkedAgentOpts {
  prompt: string;
  memoryDir: string;
  maxTurns: number;
  skipTranscript: boolean;
}

export interface ForkedAgentResult {
  writtenPaths: string[];
  turnCount: number;
}

type ExtractorFn = (context: ExtractionContext) => Promise<void>;

// ============================================================================
// Helpers
// ============================================================================

/** Count model-visible messages (user + assistant only) since sinceUuid */
function countModelVisibleMessagesSince(
  messages: ChatMessage[],
  sinceUuid: string | undefined
): number {
  const isVisible = (m: ChatMessage) => m.role === "user" || m.role === "assistant";
  if (!sinceUuid) return messages.filter(isVisible).length;

  let foundStart = false;
  let n = 0;
  for (const msg of messages) {
    if (!foundStart) {
      if ((msg as any).uuid === sinceUuid) foundStart = true;
      continue;
    }
    if (isVisible(msg)) n++;
  }
  // If sinceUuid not found (e.g. removed by compaction), count all messages.
  return foundStart ? n : messages.filter(isVisible).length;
}

/**
 * Returns true if any assistant message after sinceUuid contains a write/edit
 * tool call that targeted a file inside the auto-memory directory.
 *
 * When true, we skip the forked extraction to avoid duplicating work the main
 * agent already did — e.g. after a /memory write command.
 */
function hasMemoryWritesSince(
  messages: ChatMessage[],
  sinceUuid: string | undefined,
  cwd: string
): boolean {
  let foundStart = sinceUuid === undefined;
  for (const msg of messages) {
    if (!foundStart) {
      if ((msg as any).uuid === sinceUuid) foundStart = true;
      continue;
    }
    if (msg.role !== "assistant") continue;
    for (const tc of msg.tool_calls ?? []) {
      const args = tc.function.arguments as Record<string, unknown>;
      const filePath = args.file_path ?? args.path;
      if (typeof filePath === "string" && isAutoMemPath(cwd, filePath)) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// Prompt builder
// ============================================================================

function buildExtractionPrompt(
  newMessageCount: number,
  existingMemoriesManifest: string
): string {
  return `You are a memory extraction agent. Your job is to identify NEW facts, preferences, coding patterns, architecture decisions, or lessons learned from the last ${newMessageCount} messages in the conversation, and save them as permanent memory files.

## Existing Memories
${existingMemoriesManifest}

## Instructions
1. Read the existing memory files listed above (using the read tool) to understand what is already known.
2. Analyze the recent conversation for NEW facts not already captured:
   - Technology/framework preferences (e.g. "always uses Bun, not Node")
   - Architecture decisions (e.g. "auth lives in src/auth/")
   - Coding conventions (e.g. "uses strict TypeScript")
   - Bugs and lessons learned (e.g. "do NOT strip tool-invocation parts before convertToModelMessages")
   - Environment quirks (e.g. "runs on Windows, use PowerShell syntax")
3. For each NEW fact, write a memory file using the write tool:
   - Path: <memory-dir>/<descriptive-uuid>.md
   - Format:
     ---
     name: Short descriptive title
     type: preference | pattern | fact | lesson | architecture
     description: One-line summary of this memory
     created: ${new Date().toISOString().split("T")[0]}
     ---
     
     Full description here. Be specific and actionable.
4. Update MEMORY.md index to add a line for each new file (max 200 lines total).
5. If nothing new was learned, do nothing.

Do NOT duplicate existing memories. Do NOT modify codebase files. Only write to the memory directory.`;
}

// ============================================================================
// Initialization & closure-scoped state
// ============================================================================

/** The active extractor — null until initExtractMemories() is called. */
let extractor: ExtractorFn | null = null;

/** In-flight extractions set — used by drainPendingExtraction(). */
let inFlightExtractions = new Set<Promise<void>>();

/** Drain function — awaits all in-flight extractions. */
let drainer: (timeoutMs?: number) => Promise<void> = async () => {};

/**
 * Initialize the memory extraction system.
 *
 * Call once at CLI startup alongside initAutoDream().
 * Call in beforeEach() in tests to get a fresh closure.
 */
export function initExtractMemories(): void {
  // --- Closure-scoped mutable state ---

  /** UUID of last processed message — cursor for incremental extraction. */
  let lastMemoryMessageUuid: string | undefined;

  /** True while runExtraction is executing (prevents overlapping runs). */
  let inProgress = false;

  /** Turns since last extraction — throttle gate. */
  let turnsSinceLastExtraction = 0;

  /**
   * When a call arrives during an in-progress run, we stash the context here
   * and run one trailing extraction after the current one finishes.
   */
  let pendingContext: ExtractionContext | undefined;

  // Reset module-level sets for this init call
  inFlightExtractions = new Set();

  // --- Inner extraction logic ---

  async function runExtraction(
    context: ExtractionContext,
    isTrailingRun = false
  ): Promise<void> {
    const { messages, cwd, runForkedAgent } = context;
    const memoryDir = getAutoMemPath(cwd);
    const newMessageCount = countModelVisibleMessagesSince(messages, lastMemoryMessageUuid);

    // Mutual exclusion: if main agent wrote memory this turn, skip forked extraction.
    if (hasMemoryWritesSince(messages, lastMemoryMessageUuid, cwd)) {
      // Advance cursor past this range
      const lastMsg = messages.at(-1);
      if (lastMsg && (lastMsg as any).uuid) {
        lastMemoryMessageUuid = (lastMsg as any).uuid;
      }
      return;
    }

    // Throttle: only run every N turns (default: every turn like Beta)
    if (!isTrailingRun) {
      turnsSinceLastExtraction++;
      const threshold = 1; // same as Beta default (tengu_bramble_lintel = 1)
      if (turnsSinceLastExtraction < threshold) return;
    }
    turnsSinceLastExtraction = 0;

    inProgress = true;
    try {
      // Pre-scan memory dir and build manifest so the agent skips the ls step
      const existingMemories = formatMemoryManifest(
        await scanMemoryFiles(memoryDir)
      );

      const prompt = buildExtractionPrompt(newMessageCount, existingMemories);

      await runForkedAgent({
        prompt,
        memoryDir,
        maxTurns: 5,
        skipTranscript: true,
      });

      // Advance cursor only after a successful run
      const lastMsg = messages.at(-1);
      if (lastMsg && (lastMsg as any).uuid) {
        lastMemoryMessageUuid = (lastMsg as any).uuid;
      }
    } catch {
      // Extraction is best-effort — non-fatal
      // Cursor stays put so these messages are reconsidered next turn
    } finally {
      inProgress = false;

      // Run trailing extraction if one was stashed during this run
      const trailing = pendingContext;
      pendingContext = undefined;
      if (trailing) {
        await runExtraction(trailing, true);
      }
    }
  }

  // --- Public entry point ---

  async function executeExtractMemoriesImpl(context: ExtractionContext): Promise<void> {
    if (inProgress) {
      // Stash the latest context for a trailing run
      pendingContext = context;
      return;
    }
    await runExtraction(context, false);
  }

  extractor = async (context: ExtractionContext) => {
    const p = executeExtractMemoriesImpl(context);
    inFlightExtractions.add(p);
    try {
      await p;
    } finally {
      inFlightExtractions.delete(p);
    }
  };

  drainer = async (timeoutMs = 60_000) => {
    if (inFlightExtractions.size === 0) return;
    await Promise.race([
      Promise.all(Array.from(inFlightExtractions)).catch(() => {}),
      new Promise<void>((r) => setTimeout(r, timeoutMs)),
    ]);
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run memory extraction at the end of a query loop.
 * Called fire-and-forget from QueryEngine after each turn completes.
 * No-ops until initExtractMemories() has been called.
 */
export async function executeExtractMemories(
  context: ExtractionContext
): Promise<void> {
  await extractor?.(context);
}

/**
 * Awaits all in-flight extractions with a soft timeout.
 * Called before process exit so the background agent can finish.
 * No-ops until initExtractMemories() has been called.
 */
export async function drainPendingExtraction(timeoutMs?: number): Promise<void> {
  await drainer(timeoutMs);
}

/**
 * Prompt that is injected into the system prompt when auto-memory is enabled.
 * Tells the main agent it can write memory files directly (and extractMemories
 * will skip extraction for that turn if it detects those writes).
 */
export function getMemoryMechanicsPrompt(cwd: string): string {
  const memoryDir = getAutoMemPath(cwd);
  return `# Auto Memory

You have a persistent memory system. Important facts, preferences, and lessons are stored in:
  ${memoryDir}

The index file is MEMORY.md in that directory. UUID-named .md files hold individual memories.

When you learn something important (architecture decisions, user preferences, bugs to avoid, etc.),
you may write a memory file directly using the write tool. Use this format:

---
name: Short descriptive title
type: preference | pattern | fact | lesson | architecture
description: One-line summary
created: YYYY-MM-DD
---

Full explanation here.

The memory system will also run automatically in the background after each turn.`;
}

/**
 * Helper to check whether auto memory is enabled.
 * Matches Beta's isAutoMemoryEnabled() check.
 */
export function isAutoMemoryEnabled(): boolean {
  return process.env.MY_CODE_DISABLE_AUTO_MEMORY !== "1";
}
