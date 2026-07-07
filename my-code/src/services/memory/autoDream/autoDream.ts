/**
 * Phase 4 — AutoDream: Idle Memory Consolidation (Beta parity)
 *
 * Exact port of Beta's `services/autoDream/autoDream.ts`.
 *
 * AutoDream is the "REM sleep" janitor that runs in the background when you
 * have been away for a while. It reads all memory files and transcripts from
 * recent sessions, then uses an LLM to:
 *   - Deduplicate contradictory or overlapping memories
 *   - Prune stale or irrelevant entries
 *   - Rewrite MEMORY.md keeping it under 200 lines (the context cap)
 *
 * Gate order (cheapest first — matches Beta exactly):
 *   1. Time:     >= 24 hours since lastConsolidatedAt
 *   2. Throttle: don't re-scan sessions within 10 minutes if gate 3 failed
 *   3. Sessions: >= 5 sessions touched since lastConsolidatedAt
 *   4. Lock:     no other process mid-consolidation
 *
 * State is closure-scoped inside initAutoDream() — tests call initAutoDream()
 * in beforeEach for a fresh closure.
 */

import {
  readLastConsolidatedAt,
  listSessionsTouchedSince,
  tryAcquireConsolidationLock,
  rollbackConsolidationLock,
} from "./consolidationLock.js";
import { getAutoMemPath } from "../../../memdir/paths.js";
import { sessionDir } from "../../../session/projectStore.js";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULTS = {
  minHours: 24,
  minSessions: 5,
};

// Scan throttle: when time-gate passes but session-gate doesn't, don't re-scan
// within 10 minutes (prevents hammering the filesystem every turn).
const SESSION_SCAN_INTERVAL_MS = 10 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface AutoDreamContext {
  cwd: string;
  sessionId: string; // current session ID to exclude from the count
  runForkedAgent: (opts: DreamAgentOpts) => Promise<void>;
}

export interface DreamAgentOpts {
  prompt: string;
  memoryDir: string;
  transcriptDir: string;
  maxTurns: number;
  skipTranscript: boolean;
}

type DreamRunnerFn = (context: AutoDreamContext) => Promise<void>;

// ============================================================================
// Prompt builder (matches Beta's buildConsolidationPrompt)
// ============================================================================

function buildConsolidationPrompt(
  memoryRoot: string,
  transcriptDir: string,
  sessionIds: string[]
): string {
  const sessionList = sessionIds.map((id) => `- ${id}`).join("\n");
  return `You are the autoDream memory consolidation agent. Your job is to review recent session transcripts and the existing memory files, then consolidate, deduplicate, and prune the memory index.

## Memory Directory
${memoryRoot}

## Transcript Directory
${transcriptDir}

## Sessions Since Last Consolidation (${sessionIds.length})
${sessionList}

## Instructions
1. Read MEMORY.md to understand the current memory index.
2. Read the relevant UUID memory files for context.
3. Review the session transcripts listed above to find new patterns or updates.
4. Consolidate:
   - Merge duplicate or overlapping memories into single files
   - Resolve contradictions (keep the newer/more accurate version)
   - Delete memory files that are no longer relevant
   - Update the content of files that need freshening
5. Rewrite MEMORY.md so it is accurate and under 200 lines total.
   Each line should be: "- [filename]: description"

**Tool constraints:** Bash is restricted to read-only commands (ls, find, grep, cat, stat, wc, head, tail, and similar). Anything that writes, redirects to a file, or modifies state will be denied. Only use the write/edit tools for files inside the memory directory.

Do NOT modify any files outside the memory directory.`;
}

// ============================================================================
// Initialization & closure-scoped state
// ============================================================================

let runner: DreamRunnerFn | null = null;

/**
 * Initialize the autoDream system.
 * Call once at startup alongside initExtractMemories().
 * Call in beforeEach() in tests for a fresh closure.
 */
export function initAutoDream(): void {
  let lastSessionScanAt = 0;

  runner = async function runAutoDream(context: AutoDreamContext): Promise<void> {
    const { cwd, sessionId, runForkedAgent } = context;

    // --- Enabled gate ---
    if (!isAutoDreamEnabled()) return;

    // --- Time gate ---
    let lastAt: number;
    try {
      lastAt = await readLastConsolidatedAt(cwd);
    } catch {
      return;
    }
    const hoursSince = (Date.now() - lastAt) / 3_600_000;
    if (hoursSince < DEFAULTS.minHours) return;

    // --- Scan throttle ---
    const sinceScanMs = Date.now() - lastSessionScanAt;
    if (sinceScanMs < SESSION_SCAN_INTERVAL_MS) return;
    lastSessionScanAt = Date.now();

    // --- Session gate ---
    let sessionIds: string[];
    try {
      sessionIds = await listSessionsTouchedSince(cwd, lastAt);
    } catch {
      return;
    }
    // Exclude current session (its mtime is always recent)
    sessionIds = sessionIds.filter((id) => id !== sessionId);
    if (sessionIds.length < DEFAULTS.minSessions) return;

    // --- Lock gate ---
    let priorMtime: number | null;
    try {
      priorMtime = await tryAcquireConsolidationLock(cwd);
    } catch {
      return;
    }
    if (priorMtime === null) return; // another process is dreaming

    // --- Run the dream ---
    const memoryRoot = getAutoMemPath(cwd);
    const transcriptDir = sessionDir(cwd);
    const prompt = buildConsolidationPrompt(memoryRoot, transcriptDir, sessionIds);

    try {
      await runForkedAgent({
        prompt,
        memoryDir: memoryRoot,
        transcriptDir,
        maxTurns: 10,
        skipTranscript: true,
      });
    } catch {
      // Dream failed — rollback lock so time-gate passes again tomorrow
      await rollbackConsolidationLock(cwd, priorMtime);
    }
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Entry point from QueryEngine's post-turn hook.
 * No-op until initAutoDream() has been called.
 * Per-turn cost when enabled: one stat (lock mtime read).
 */
export async function executeAutoDream(context: AutoDreamContext): Promise<void> {
  await runner?.(context);
}

/**
 * Check whether autoDream is enabled.
 * Can be disabled via env var for testing or CI environments.
 */
export function isAutoDreamEnabled(): boolean {
  return (
    process.env.MY_CODE_DISABLE_AUTO_DREAM !== "1" &&
    process.env.MY_CODE_DISABLE_AUTO_MEMORY !== "1"
  );
}
