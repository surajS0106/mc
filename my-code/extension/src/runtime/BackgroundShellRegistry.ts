import type { ChildProcess } from "node:child_process";

const MAX_BUFFER_LINES = 500;

export type ShellStatus = "running" | "exited" | "killed" | "error";

interface ShellEntry {
  id: string;
  command: string;
  pid: number | undefined;
  child: ChildProcess;
  status: ShellStatus;
  exitCode: number | undefined;
  startedAt: number;
  /** Ring buffer of recent stdout/stderr lines, oldest dropped first. */
  buffer: string[];
  /** How many lines have been "consumed" by BashOutput readers. */
  cursor: number;
  errorMessage: string | undefined;
}

export interface ShellSnapshot {
  id: string;
  command: string;
  pid: number | undefined;
  status: ShellStatus;
  exitCode: number | undefined;
  startedAt: number;
}

/**
 * Tracks bash processes spawned with run_in_background=true.
 *
 * Lifecycle:
 *   - spawn() registers a child and pipes its stdout/stderr into a ring buffer
 *   - getNewOutput() returns lines emitted since the previous call (cursor advances)
 *   - kill() sends SIGTERM, then SIGKILL after 2s
 *   - killAll() runs on extension dispose to clean up orphans
 */
export class BackgroundShellRegistry {
  private shells = new Map<string, ShellEntry>();
  private nextId = 1;

  register(child: ChildProcess, command: string): ShellSnapshot {
    const id = `bash-${this.nextId++}`;
    const entry: ShellEntry = {
      id,
      command,
      pid: child.pid,
      child,
      status: "running",
      exitCode: undefined,
      startedAt: Date.now(),
      buffer: [],
      cursor: 0,
      errorMessage: undefined,
    };
    this.shells.set(id, entry);

    const append = (chunk: string): void => {
      const lines = chunk.replace(/\r/g, "").split("\n");
      for (const line of lines) {
        if (!line && lines.length === 1) continue;
        entry.buffer.push(line);
      }
      if (entry.buffer.length > MAX_BUFFER_LINES) {
        const drop = entry.buffer.length - MAX_BUFFER_LINES;
        entry.buffer.splice(0, drop);
        entry.cursor = Math.max(0, entry.cursor - drop);
      }
    };

    child.stdout?.on("data", (d) => append(d.toString()));
    child.stderr?.on("data", (d) => append(d.toString()));

    child.on("close", (code) => {
      entry.exitCode = code ?? undefined;
      if (entry.status === "running") {
        entry.status = "exited";
      }
    });

    child.on("error", (e) => {
      entry.status = "error";
      entry.errorMessage = e instanceof Error ? e.message : String(e);
    });

    return snapshot(entry);
  }

  /** Used to initialize a shell entry's buffer with output already captured before registration. */
  seedBuffer(id: string, lines: string[]): void {
    const entry = this.shells.get(id);
    if (!entry) return;
    entry.buffer.unshift(...lines);
  }

  get(id: string): ShellSnapshot | undefined {
    const e = this.shells.get(id);
    return e ? snapshot(e) : undefined;
  }

  getNewOutput(id: string): { lines: string[]; status: ShellStatus; exitCode?: number } | undefined {
    const e = this.shells.get(id);
    if (!e) return undefined;
    const lines = e.buffer.slice(e.cursor);
    e.cursor = e.buffer.length;
    return { lines, status: e.status, exitCode: e.exitCode };
  }

  kill(id: string): boolean {
    const e = this.shells.get(id);
    if (!e) return false;
    if (e.status !== "running") return true;
    e.status = "killed";
    try {
      e.child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      try {
        if (e.child.exitCode === null && e.child.killed === false) {
          e.child.kill("SIGKILL");
        }
      } catch {
        /* ignore */
      }
    }, 2000);
    return true;
  }

  killAll(): void {
    for (const id of this.shells.keys()) this.kill(id);
  }

  list(): ShellSnapshot[] {
    return [...this.shells.values()].map(snapshot);
  }
}

function snapshot(e: ShellEntry): ShellSnapshot {
  return {
    id: e.id,
    command: e.command,
    pid: e.pid,
    status: e.status,
    exitCode: e.exitCode,
    startedAt: e.startedAt,
  };
}

/** Shared singleton for the host (one registry per extension instance). */
export const backgroundShells = new BackgroundShellRegistry();
