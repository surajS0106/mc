import { createHash } from "node:crypto";
import fs from "node:fs/promises";

interface FileEntry {
  mtimeMs: number;
  size: number;
  sha1: string;
  readAt: number;
}

/**
 * Tracks files that tools have read during a session. Lets the Edit tool
 * detect when the file changed between Read and Edit — preventing the model
 * from overwriting edits it never saw.
 *
 * LRU-bounded so long sessions don't grow unbounded. Eviction is fine:
 * missing entry means "unknown state", not "definitely unchanged".
 */
export class FileStateCache {
  private entries = new Map<string, FileEntry>();
  private maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  /** Called by the Read tool after a successful read. */
  async markRead(absPath: string, content: string): Promise<void> {
    try {
      const stat = await fs.stat(absPath);
      const sha1 = createHash("sha1").update(content).digest("hex");
      this.put(absPath, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        sha1,
        readAt: Date.now(),
      });
    } catch {
      // file may not exist yet (new file write); fine to skip
    }
  }

  /** Called by Edit/Write to check: did this file change since we last read it? */
  async isStale(absPath: string): Promise<boolean> {
    const cached = this.entries.get(absPath);
    if (!cached) return false; // not tracked → treat as fresh
    try {
      const stat = await fs.stat(absPath);
      if (stat.mtimeMs === cached.mtimeMs && stat.size === cached.size) {
        return false;
      }
      // mtime/size changed — confirm with content hash (editors that touch without changing content)
      const content = await fs.readFile(absPath, "utf8");
      const sha1 = createHash("sha1").update(content).digest("hex");
      return sha1 !== cached.sha1;
    } catch {
      // File disappeared — clearly stale.
      return true;
    }
  }

  /** Called by Write tool after overwrite. */
  async markWritten(absPath: string, content: string): Promise<void> {
    await this.markRead(absPath, content);
  }

  has(absPath: string): boolean {
    return this.entries.has(absPath);
  }

  clear(): void {
    this.entries.clear();
  }

  private put(key: string, entry: FileEntry): void {
    // LRU: delete + reinsert to move to end
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
