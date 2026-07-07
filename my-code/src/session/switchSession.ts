/**
 * Phase 5 — Session Switch (Beta parity)
 *
 * Port of Beta's `bootstrap/state.ts → switchSession()`.
 *
 * When the user runs `ig --continue` or `/resume`, we don't start a brand-new
 * session — we RESUME the old one. That means:
 *   1. The active session UUID becomes the OLD session's UUID.
 *   2. ALL future transcript writes go to the OLD session's .jsonl file.
 *   3. The engine.messages array is replaced with the restored conversation.
 *
 * Beta does this atomically using a module-level `state` object in
 * bootstrap/state.ts. We replicate this pattern with a simple module-level
 * object here.
 *
 * Usage:
 *   const session = await loadTranscriptForResume(cwd, sessionId);
 *   switchSession(session);
 *   engine.setMessages(session.messages);
 */

import type { ChatMessage } from "../agent/types.js";
import { sessionDir } from "./projectStore.js";
import * as path from "node:path";

// ============================================================================
// Active session state (module-level singleton, same as Beta's state.ts)
// ============================================================================

interface ActiveSession {
  /** UUID of the active session. */
  sessionId: string;
  /** Absolute path to the .jsonl transcript file for this session. */
  transcriptPath: string;
  /** The cwd this session belongs to. */
  cwd: string;
}

let _activeSession: ActiveSession | null = null;

/** Read the current active session. Returns null before switchSession() or setSession() is called. */
export function getActiveSession(): ActiveSession | null {
  return _activeSession;
}

/** Return the current active session ID, or null. */
export function getSessionId(): string | null {
  return _activeSession?.sessionId ?? null;
}

/** Return the active session's transcript path, or null. */
export function getTranscriptPath(): string | null {
  return _activeSession?.transcriptPath ?? null;
}

/**
 * Initialize the session state at startup (before any resume).
 * Called by cli.ts after creating the TranscriptWriter.
 */
export function setSession(sessionId: string, cwd: string): void {
  _activeSession = {
    sessionId,
    transcriptPath: path.join(sessionDir(cwd), `${sessionId}.jsonl`),
    cwd,
  };
}

/**
 * Atomically swap to a resumed session.
 *
 * This is the key operation for `/resume` and `--continue`. After calling this:
 *   - getSessionId() returns the old session UUID
 *   - getTranscriptPath() returns the old .jsonl file
 *   - The TranscriptWriter will continue appending to the OLD file
 *   - extractMemories cursor is NOT reset (memories from the gap still extracted)
 *
 * Matches Beta's switchSession(sessionId, sessionProjectDir) exactly.
 */
export function switchSession(sessionId: string, cwd: string): void {
  _activeSession = {
    sessionId,
    transcriptPath: path.join(sessionDir(cwd), `${sessionId}.jsonl`),
    cwd,
  };
}

// ============================================================================
// Transcript loading for resume
// ============================================================================

export interface ResumedSession {
  sessionId: string;
  cwd: string;
  messages: ChatMessage[];
  transcriptPath: string;
}

/**
 * Load a session transcript and reconstruct the message array for resume.
 *
 * Beta's flow (loadTranscriptFile → messages Map → UUID chain walk):
 *   1. Parse every JSONL line
 *   2. Build Map<uuid, message>
 *   3. Walk parentUuid chain to reconstruct order
 *
 * my-code's current transcript format uses flat events + checkpoint snapshots.
 * We support both:
 *   - If a "checkpoint" event exists → use it (fastest, complete)
 *   - Else → reconstruct from user/assistant events (fallback)
 *   - Unknown format lines → skip gracefully
 */
export async function loadTranscriptForResume(
  cwd: string,
  sessionId: string
): Promise<ResumedSession | null> {
  const transcriptPath = path.join(sessionDir(cwd), `${sessionId}.jsonl`);

  const { default: fs } = await import("node:fs/promises");

  let raw: string;
  try {
    raw = await fs.readFile(transcriptPath, "utf-8");
  } catch {
    return null;
  }

  const lines = raw.split("\n").filter(Boolean);
  if (lines.length === 0) return null;

  // --- Strategy 1: UUID-linked chain (new format, when uuids are present) ---
  interface LinkedEvent {
    uuid: string;
    parentUuid: string | null;
    type: string;
    role?: string;
    content?: string;
    tool_calls?: ChatMessage["tool_calls"];
  }

  const uuidEvents: LinkedEvent[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (typeof obj.uuid === "string") {
        uuidEvents.push(obj as unknown as LinkedEvent);
      }
    } catch {}
  }

  if (uuidEvents.length > 0) {
    // Build parentUuid → children index
    const childMap = new Map<string | null, LinkedEvent[]>();
    for (const ev of uuidEvents) {
      const bucket = childMap.get(ev.parentUuid ?? null) ?? [];
      bucket.push(ev);
      childMap.set(ev.parentUuid ?? null, bucket);
    }

    // Walk the chain depth-first
    const messages: ChatMessage[] = [];
    const visitQueue: (LinkedEvent | undefined)[] = childMap.get(null) ?? [];
    while (visitQueue.length > 0) {
      const ev = visitQueue.shift();
      if (!ev) continue;
      if (ev.type === "user" || ev.type === "assistant") {
        messages.push({
          role: ev.type as "user" | "assistant",
          content: ev.content ?? "",
          ...(ev.tool_calls ? { tool_calls: ev.tool_calls } : {}),
        } as ChatMessage);
      }
      const children = childMap.get(ev.uuid) ?? [];
      visitQueue.unshift(...children);
    }

    if (messages.length > 0) {
      return { sessionId, cwd, messages, transcriptPath };
    }
  }

  // --- Strategy 2: Checkpoint snapshot (flat event format with checkpoint) ---
  // Find the LAST checkpoint event (most complete snapshot)
  let checkpointMessages: ChatMessage[] | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]!) as { type?: string; messages?: ChatMessage[] };
      if (obj.type === "checkpoint" && Array.isArray(obj.messages)) {
        checkpointMessages = obj.messages;
        break;
      }
    } catch {}
  }

  if (checkpointMessages && checkpointMessages.length > 0) {
    return { sessionId, cwd, messages: checkpointMessages, transcriptPath };
  }

  // --- Strategy 3: Reconstruct from raw events (legacy fallback) ---
  const messages: ChatMessage[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (obj.type === "user" && typeof obj.content === "string") {
        messages.push({ role: "user", content: obj.content });
      } else if (obj.type === "assistant" && typeof obj.content === "string") {
        messages.push({ role: "assistant", content: obj.content });
      }
    } catch {}
  }

  if (messages.length > 0) {
    return { sessionId, cwd, messages, transcriptPath };
  }

  return null;
}
