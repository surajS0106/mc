import fs from "node:fs/promises";
import path from "node:path";
import { sessionDir, ensureProjectMeta } from "./projectStore.js";
import type { ChatMessage } from "../agent/types.js";

// Every event appended to the JSONL file
export type TranscriptEvent =
  | { type: "user"; content: string; at: number }
  | { type: "assistant"; content: string; at: number }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; at: number }
  | { type: "tool_result"; name: string; result: string; isError: boolean; at: number }
  | { type: "system"; content: string; tone?: string; at: number }
  | { type: "checkpoint"; messages: ChatMessage[]; at: number };

export interface SessionMeta {
  id: string;
  cwd: string;
  model: string;
  startedAt: number;
  endedAt?: number;
  turns: number;
  promptTokens: number;
  completionTokens: number;
  /** First user message — quick summary for session listing. */
  summary?: string;
}

/** How often to auto-checkpoint (every N turns). */
const AUTO_CHECKPOINT_INTERVAL = 5;

// Append-only JSONL writer — one line per event, crash-safe
export class TranscriptWriter {
  private handle: fs.FileHandle | null = null;
  readonly filePath: string;
  readonly metaPath: string;
  private meta: SessionMeta;
  private turnsSinceCheckpoint = 0;
  private _onCheckpoint: ((messages: ChatMessage[]) => void) | null = null;

  constructor(sessionId: string, cwd: string, model: string) {
    const dir = sessionDir(cwd);
    this.filePath = path.join(dir, `${sessionId}.jsonl`);
    this.metaPath = path.join(dir, `${sessionId}.meta.json`);
    this.meta = {
      id: sessionId,
      cwd,
      model,
      startedAt: Date.now(),
      turns: 0,
      promptTokens: 0,
      completionTokens: 0,
    };
  }

  /** Set a callback that provides messages for auto-checkpointing. */
  set onCheckpoint(fn: (messages: ChatMessage[]) => void) {
    this._onCheckpoint = fn;
  }

  async open(): Promise<void> {
    await ensureProjectMeta(this.meta.cwd);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    this.handle = await fs.open(this.filePath, "a");
    await this.flushMeta();
  }

  async append(event: TranscriptEvent): Promise<void> {
    if (!this.handle) return;
    try {
      await this.handle.write(JSON.stringify(event) + "\n");

      // Capture first user message as summary
      if (event.type === "user" && !this.meta.summary) {
        this.meta.summary = event.content.slice(0, 100).replace(/\n/g, " ");
        await this.flushMeta();
      }
    } catch {
      // Non-fatal — transcript loss is acceptable vs crashing the UI
    }
  }

  // Save a checkpoint of the full message array so resume can reconstruct the agent
  async checkpoint(messages: ChatMessage[]): Promise<void> {
    await this.append({ type: "checkpoint", messages, at: Date.now() });
    this.turnsSinceCheckpoint = 0;
  }

  /** Track turns and auto-checkpoint periodically. */
  async trackTurn(messages?: ChatMessage[]): Promise<void> {
    this.turnsSinceCheckpoint++;
    if (this.turnsSinceCheckpoint >= AUTO_CHECKPOINT_INTERVAL && messages) {
      await this.checkpoint(messages);
    }
  }

  // Update running stats and flush the meta file (fast summary for /sessions listing)
  async updateMeta(partial: Partial<Pick<SessionMeta, "turns" | "promptTokens" | "completionTokens">>): Promise<void> {
    Object.assign(this.meta, partial);
    await this.flushMeta();
  }

  async close(final?: Partial<SessionMeta>): Promise<void> {
    if (final) Object.assign(this.meta, final);
    this.meta.endedAt = Date.now();
    await this.flushMeta();
    if (this.handle) {
      await this.handle.close().catch(() => {});
      this.handle = null;
    }
  }

  private async flushMeta(): Promise<void> {
    try {
      await fs.writeFile(this.metaPath, JSON.stringify(this.meta, null, 2) + "\n", "utf8");
    } catch {}
  }
}

// ─── Reading ─────────────────────────────────────────────────────────────────

// Load all events from a JSONL transcript file
export async function loadTranscript(filePath: string): Promise<TranscriptEvent[]> {
  try {
    const txt = await fs.readFile(filePath, "utf8");
    return txt
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try { return [JSON.parse(line) as TranscriptEvent]; } catch { return []; }
      });
  } catch {
    return [];
  }
}

// Reconstruct agent.messages[] from the last checkpoint in a transcript
export async function messagesFromTranscript(filePath: string): Promise<ChatMessage[] | null> {
  const events = await loadTranscript(filePath);
  // Find the last checkpoint — it's the fastest way to resume
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type === "checkpoint") return e.messages;
  }

  // No checkpoint found — try to reconstruct from events (fallback)
  return reconstructFromEvents(events);
}

/** Reconstruct message array from raw events when no checkpoint exists. */
function reconstructFromEvents(events: TranscriptEvent[]): ChatMessage[] | null {
  if (events.length === 0) return null;
  const messages: ChatMessage[] = [];
  for (const ev of events) {
    switch (ev.type) {
      case "user":
        messages.push({ role: "user", content: ev.content });
        break;
      case "assistant":
        messages.push({ role: "assistant", content: ev.content });
        break;
      case "tool_result":
        messages.push({ role: "tool", tool_name: ev.name, content: ev.result });
        break;
      // tool_call and system events don't map directly to ChatMessage
    }
  }
  return messages.length > 0 ? messages : null;
}

// ─── Listing & Search ────────────────────────────────────────────────────────

// List all session meta files for a project, newest first.
// Only returns sessions that have actual content (JSONL file exists with data).
export async function listSessionMetas(cwd: string): Promise<SessionMeta[]> {
  const dir = sessionDir(cwd);
  try {
    const files = await fs.readdir(dir);
    const metaFiles = files
      .filter((f) => f.endsWith(".meta.json"))
      .sort()
      .reverse();
    const out: SessionMeta[] = [];
    for (const f of metaFiles) {
      try {
        const txt = await fs.readFile(path.join(dir, f), "utf8");
        const meta = JSON.parse(txt) as SessionMeta;

        // Skip sessions with no turns AND no JSONL content —
        // these are ghost sessions (opened but nothing typed).
        if ((meta.turns ?? 0) === 0) {
          const jsonlPath = path.join(dir, f.replace(".meta.json", ".jsonl"));
          try {
            const stat = await fs.stat(jsonlPath);
            if (stat.size === 0) continue; // empty file — skip
          } catch {
            continue; // no JSONL file at all — skip
          }
        }

        out.push(meta);
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}


// List sessions across ALL projects (for `ig sessions` global view)
export async function listAllSessionMetas(limit = 20): Promise<SessionMeta[]> {
  const { listProjects } = await import("./projectStore.js");
  const projects = await listProjects();
  const all: SessionMeta[] = [];
  for (const p of projects) {
    const metas = await listSessionMetas(p.cwd);
    all.push(...metas);
  }
  return all
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
    .slice(0, limit);
}

/** Search sessions by summary text. */
export async function searchSessions(cwd: string, query: string): Promise<SessionMeta[]> {
  const metas = await listSessionMetas(cwd);
  const q = query.toLowerCase();
  return metas.filter((m) =>
    m.summary?.toLowerCase().includes(q) ||
    m.model.toLowerCase().includes(q) ||
    m.id.includes(q)
  );
}

/** Delete a session (JSONL + meta). */
export async function deleteSession(cwd: string, sessionId: string): Promise<boolean> {
  const dir = sessionDir(cwd);
  try {
    await fs.unlink(path.join(dir, `${sessionId}.jsonl`)).catch(() => {});
    await fs.unlink(path.join(dir, `${sessionId}.meta.json`)).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Export a session as readable markdown. */
export async function exportSessionAsMarkdown(filePath: string): Promise<string> {
  const events = await loadTranscript(filePath);
  const lines: string[] = ["# Session Transcript\n"];
  for (const ev of events) {
    switch (ev.type) {
      case "user":
        lines.push(`## User\n${ev.content}\n`);
        break;
      case "assistant":
        lines.push(`## Assistant\n${ev.content}\n`);
        break;
      case "tool_call":
        lines.push(`### Tool: ${ev.name}\n\`\`\`json\n${JSON.stringify(ev.args, null, 2)}\n\`\`\`\n`);
        break;
      case "tool_result":
        lines.push(`### Result: ${ev.name}${ev.isError ? " ❌" : ""}\n\`\`\`\n${ev.result.slice(0, 2000)}\n\`\`\`\n`);
        break;
      case "system":
        lines.push(`> ${ev.content}\n`);
        break;
    }
  }
  return lines.join("\n");
}

// Format a session list for display inside the TUI
export function formatSessionList(sessions: SessionMeta[]): string {
  if (sessions.length === 0) return "(no sessions found)";
  const now = Date.now();
  return sessions
    .map((s, i) => {
      const age = now - s.startedAt;
      const ageStr =
        age < 60_000 ? "just now"
        : age < 3_600_000 ? `${Math.round(age / 60_000)}m ago`
        : age < 86_400_000 ? `${Math.round(age / 3_600_000)}h ago`
        : `${Math.round(age / 86_400_000)}d ago`;
      const tokens = s.promptTokens + s.completionTokens;
      const tokStr = tokens > 0
        ? tokens < 1000 ? `${tokens}` : `${(tokens / 1000).toFixed(1)}k`
        : "—";
      const shortCwd = s.cwd.replace(/\\/g, "/").split("/").slice(-2).join("/");
      const summary = s.summary ? ` "${s.summary.slice(0, 40)}"` : "";
      return `  [${i + 1}] ${ageStr.padEnd(10)} ${s.turns}t · ${tokStr} tok · ${s.model.replace(/:.*$/, "")} · ${shortCwd}${summary}  (${s.id})`;
    })
    .join("\n");
}

