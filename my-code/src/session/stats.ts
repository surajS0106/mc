import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface TurnRecord {
  at: number; // epoch ms
  model: string;
  promptTokens: number;
  completionTokens: number;
  apiMs: number;
  toolCalls: string[];
}

export interface SessionRollup {
  id: string;
  model: string;
  cwd: string;
  startedAt: number;
  endedAt: number;
  turns: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  apiMs: number;
  wallMs: number;
  toolCounts: Record<string, number>;
  lastPromptTokens?: number;
}

function legacySessionDir(): string {
  return path.join(os.homedir(), ".my-code", "sessions");
}

export class SessionStats {
  readonly id: string;
  readonly startedAt: number;
  readonly cwd: string;
  private turns: TurnRecord[] = [];
  private requests = 0;
  private lastPrompt = 0;
  public currentModel: string;

  constructor(model: string, cwd: string) {
    this.currentModel = model;
    this.cwd = cwd;
    this.startedAt = Date.now();
    const iso = new Date().toISOString().replace(/[:.]/g, "-");
    this.id = `${iso}_${process.pid}`;
  }

  recordTurn(partial: Partial<TurnRecord> & { model: string }): void {
    const rec: TurnRecord = {
      at: Date.now(),
      model: partial.model,
      promptTokens: partial.promptTokens ?? 0,
      completionTokens: partial.completionTokens ?? 0,
      apiMs: partial.apiMs ?? 0,
      toolCalls: partial.toolCalls ?? [],
    };
    this.turns.push(rec);
    this.requests += 1;
    if (rec.promptTokens) this.lastPrompt = rec.promptTokens;
  }

  setLastPromptTokens(n: number): void {
    if (n > 0) this.lastPrompt = n;
  }

  get lastPromptTokens(): number {
    return this.lastPrompt;
  }

  totals() {
    const toolCounts: Record<string, number> = {};
    let prompt = 0,
      completion = 0,
      apiMs = 0;
    for (const t of this.turns) {
      prompt += t.promptTokens;
      completion += t.completionTokens;
      apiMs += t.apiMs;
      for (const n of t.toolCalls) toolCounts[n] = (toolCounts[n] ?? 0) + 1;
    }
    return {
      turns: this.turns.length,
      requests: this.requests,
      promptTokens: prompt,
      completionTokens: completion,
      apiMs,
      wallMs: Date.now() - this.startedAt,
      toolCounts,
    };
  }

  rollup(): SessionRollup {
    const t = this.totals();
    return {
      id: this.id,
      model: this.currentModel,
      cwd: this.cwd,
      startedAt: this.startedAt,
      endedAt: Date.now(),
      lastPromptTokens: this.lastPrompt,
      ...t,
    };
  }

  async persist(): Promise<void> {
    if (this.turns.length === 0) return;
    // Write to project-scoped dir; also keep legacy flat dir for backward compat
    const { sessionDir } = await import("./projectStore.js");
    const dir = sessionDir(this.cwd);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, `${this.id}.json`),
      JSON.stringify(this.rollup(), null, 2),
      "utf8"
    );
  }
}

export async function loadRecentSessions(limit = 5): Promise<SessionRollup[]> {
  const all = await loadAllSessions();
  return all.slice(0, limit);
}

export async function loadAllSessions(): Promise<SessionRollup[]> {
  const out: SessionRollup[] = [];

  // Load from project-scoped dirs
  try {
    const { listProjects, sessionDir } = await import("./projectStore.js");
    const projects = await listProjects();
    for (const p of projects) {
      const dir = sessionDir(p.cwd);
      try {
        const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json") && !f.endsWith(".meta.json"));
        for (const f of files) {
          try {
            const txt = await fs.readFile(path.join(dir, f), "utf8");
            out.push(JSON.parse(txt) as SessionRollup);
          } catch {}
        }
      } catch {}
    }
  } catch {}

  // Also load legacy flat sessions for backward compat
  try {
    const dir = legacySessionDir();
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      try {
        const txt = await fs.readFile(path.join(dir, f), "utf8");
        const s = JSON.parse(txt) as SessionRollup;
        if (!out.some((x) => x.id === s.id)) out.push(s);
      } catch {}
    }
  } catch {}

  return out.sort((a, b) => b.endedAt - a.endedAt);
}

export interface Aggregate {
  sessions: number;
  turns: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  apiMs: number;
  wallMs: number;
  toolCounts: Record<string, number>;
  byModel: Record<string, { turns: number; promptTokens: number; completionTokens: number }>;
}

export function emptyAggregate(): Aggregate {
  return {
    sessions: 0,
    turns: 0,
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    apiMs: 0,
    wallMs: 0,
    toolCounts: {},
    byModel: {},
  };
}

export function aggregate(sessions: SessionRollup[]): Aggregate {
  const out = emptyAggregate();
  for (const s of sessions) {
    out.sessions += 1;
    out.turns += s.turns;
    out.requests += s.requests;
    out.promptTokens += s.promptTokens;
    out.completionTokens += s.completionTokens;
    out.apiMs += s.apiMs;
    out.wallMs += s.wallMs;
    for (const [k, v] of Object.entries(s.toolCounts ?? {})) {
      out.toolCounts[k] = (out.toolCounts[k] ?? 0) + v;
    }
    const m = out.byModel[s.model] ?? { turns: 0, promptTokens: 0, completionTokens: 0 };
    m.turns += s.turns;
    m.promptTokens += s.promptTokens;
    m.completionTokens += s.completionTokens;
    out.byModel[s.model] = m;
  }
  return out;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function startOfWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.getTime();
}

export function bucketByTime(sessions: SessionRollup[]) {
  const today = startOfToday();
  const week = startOfWeek();
  return {
    today: aggregate(sessions.filter((s) => s.endedAt >= today)),
    week: aggregate(sessions.filter((s) => s.endedAt >= week)),
    allTime: aggregate(sessions),
  };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m${rs.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h${rm.toString().padStart(2, "0")}m`;
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}
