/**
 * File history tracker — records file states before edits for undo/rewind.
 *
 * Every time a tool writes or edits a file, the previous content is saved.
 * Users can rewind individual files or the entire session's changes.
 *
 * Modeled after beta's utils/fileHistory.ts + commitAttribution.ts.
 */

import fs from "node:fs/promises";
import path from "node:path";

export interface FileSnapshot {
  /** Absolute file path. */
  filePath: string;
  /** Content before the change (null = file didn't exist). */
  before: string | null;
  /** Content after the change. */
  after: string;
  /** ISO timestamp. */
  at: string;
  /** Which tool made the change. */
  tool: string;
  /** Turn number. */
  turnId: number;
}

/**
 * Tracks file modifications for undo/rewind support.
 */
export class FileHistory {
  private snapshots: FileSnapshot[] = [];
  private maxSnapshots: number;

  constructor(opts?: { maxSnapshots?: number }) {
    this.maxSnapshots = opts?.maxSnapshots ?? 500;
  }

  /**
   * Record a file modification. Call BEFORE writing the new content.
   */
  async record(filePath: string, newContent: string, tool: string, turnId: number): Promise<void> {
    let before: string | null = null;
    try {
      before = await fs.readFile(filePath, "utf8");
    } catch {
      // File doesn't exist yet — that's fine
    }

    this.snapshots.push({
      filePath: path.resolve(filePath),
      before,
      after: newContent,
      at: new Date().toISOString(),
      tool,
      turnId,
    });

    // Cap history size
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }
  }

  /**
   * Undo the last change to a specific file.
   * Restores the file to its previous content.
   */
  async undoFile(filePath: string): Promise<{ success: boolean; message: string }> {
    const resolved = path.resolve(filePath);
    let idx = -1;
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i]!.filePath === resolved) { idx = i; break; }
    }

    if (idx === -1) {
      return { success: false, message: `no history for ${filePath}` };
    }

    const snapshot = this.snapshots[idx]!;

    try {
      if (snapshot.before === null) {
        // File was created — delete it
        await fs.unlink(resolved);
        this.snapshots.splice(idx, 1);
        return { success: true, message: `deleted ${filePath} (was created by ${snapshot.tool})` };
      } else {
        // Restore previous content
        await fs.writeFile(resolved, snapshot.before, "utf8");
        this.snapshots.splice(idx, 1);
        return { success: true, message: `restored ${filePath} (undid ${snapshot.tool} change)` };
      }
    } catch (e) {
      return { success: false, message: `undo failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  /**
   * Undo ALL changes made during a specific turn.
   */
  async undoTurn(turnId: number): Promise<{ undone: number; errors: string[] }> {
    const turnSnapshots = this.snapshots
      .filter((s) => s.turnId === turnId)
      .reverse(); // Undo in reverse order

    let undone = 0;
    const errors: string[] = [];

    for (const snapshot of turnSnapshots) {
      try {
        if (snapshot.before === null) {
          await fs.unlink(snapshot.filePath);
        } else {
          await fs.writeFile(snapshot.filePath, snapshot.before, "utf8");
        }
        undone++;
        // Remove from history
        const idx = this.snapshots.indexOf(snapshot);
        if (idx !== -1) this.snapshots.splice(idx, 1);
      } catch (e) {
        errors.push(`${snapshot.filePath}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { undone, errors };
  }

  /**
   * Undo ALL changes in the session (nuclear option).
   */
  async undoAll(): Promise<{ undone: number; errors: string[] }> {
    const all = [...this.snapshots].reverse();
    let undone = 0;
    const errors: string[] = [];

    for (const snapshot of all) {
      try {
        if (snapshot.before === null) {
          await fs.unlink(snapshot.filePath);
        } else {
          await fs.writeFile(snapshot.filePath, snapshot.before, "utf8");
        }
        undone++;
      } catch (e) {
        errors.push(`${snapshot.filePath}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    this.snapshots = [];
    return { undone, errors };
  }

  /**
   * Get the history for a specific file.
   */
  fileHistory(filePath: string): FileSnapshot[] {
    const resolved = path.resolve(filePath);
    return this.snapshots.filter((s) => s.filePath === resolved);
  }

  /**
   * Get all modified files in the session.
   */
  modifiedFiles(): string[] {
    return [...new Set(this.snapshots.map((s) => s.filePath))];
  }

  /**
   * Get changes grouped by turn.
   */
  byTurn(): Map<number, FileSnapshot[]> {
    const map = new Map<number, FileSnapshot[]>();
    for (const s of this.snapshots) {
      const list = map.get(s.turnId) ?? [];
      list.push(s);
      map.set(s.turnId, list);
    }
    return map;
  }

  /** Total number of snapshots. */
  get count(): number {
    return this.snapshots.length;
  }

  /**
   * Format history for display.
   */
  format(opts?: { file?: string; limit?: number }): string {
    let items = opts?.file
      ? this.fileHistory(opts.file)
      : this.snapshots;

    if (opts?.limit) {
      items = items.slice(-opts.limit);
    }

    if (items.length === 0) return "(no file history)";

    return items
      .map((s) => {
        const rel = path.relative(process.cwd(), s.filePath);
        const action = s.before === null ? "created" : "edited";
        const time = s.at.split("T")[1]?.slice(0, 8) ?? "";
        return `  ${time} turn#${s.turnId} ${s.tool.padEnd(8)} ${action} ${rel}`;
      })
      .join("\n");
  }
}
