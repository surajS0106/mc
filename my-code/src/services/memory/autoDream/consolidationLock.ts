/**
 * Phase 4 — Consolidation Lock (Beta parity)
 *
 * Ported from Beta's `services/autoDream/consolidationLock.ts`.
 *
 * The lock is a single file: ~/.my-code/projects/<hash>/autodream.lock
 *
 * Its mtime is the "lastConsolidatedAt" timestamp.
 * Acquiring the lock = touching the file (updating its mtime to now).
 * Rolling back = restoring the prior mtime via fs.utimes().
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { projectDir } from "../../../session/projectStore.js";
import { sessionDir } from "../../../session/projectStore.js";

function getLockPath(cwd: string): string {
  return path.join(projectDir(cwd), "autodream.lock");
}

/**
 * Read the last consolidation timestamp from the lock file mtime.
 * Returns 0 (epoch) if the lock file doesn't exist yet.
 */
export async function readLastConsolidatedAt(cwd: string): Promise<number> {
  try {
    const stat = await fs.stat(getLockPath(cwd));
    return stat.mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * List session transcript files (.jsonl) whose mtime is newer than `since`.
 * Returns the session UUIDs (filename without extension).
 */
export async function listSessionsTouchedSince(
  cwd: string,
  since: number
): Promise<string[]> {
  const sessDir = sessionDir(cwd);
  try {
    const entries = await fs.readdir(sessDir);
    const results: string[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) continue;
      try {
        const stat = await fs.stat(path.join(sessDir, entry));
        if (stat.mtimeMs > since) {
          results.push(entry.replace(/\.jsonl$/, ""));
        }
      } catch {}
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Attempt to acquire the consolidation lock.
 *
 * On success: touches the lock file (creates if needed), returns prior mtime
 * so the caller can roll back if the dream fails.
 *
 * On failure (another process holds the lock within the last 5 minutes):
 * returns null.
 *
 * Beta uses a simple mtime-based lock (not a POSIX advisory lock) because:
 *   - Advisory locks are per-process, not per-session
 *   - Multiple Claude processes can run in the same project
 *   - mtime survives crashes cleanly
 */
export async function tryAcquireConsolidationLock(cwd: string): Promise<number | null> {
  const lockPath = getLockPath(cwd);

  // Read prior mtime (0 if file doesn't exist)
  let priorMtime = 0;
  try {
    const stat = await fs.stat(lockPath);
    priorMtime = stat.mtimeMs;

    // If lock was acquired within the last 5 minutes, another process is active
    const LOCK_TTL_MS = 5 * 60 * 1000;
    if (Date.now() - priorMtime < LOCK_TTL_MS) {
      return null; // locked
    }
  } catch {}

  // Acquire: touch the lock file
  try {
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await fs.writeFile(lockPath, "", { mode: 0o600 });
  } catch {
    return null;
  }

  return priorMtime;
}

/**
 * Rollback the lock to its prior mtime.
 * Called when the dream fails or is aborted, so the time gate can pass again.
 */
export async function rollbackConsolidationLock(
  cwd: string,
  priorMtime: number
): Promise<void> {
  const lockPath = getLockPath(cwd);
  try {
    const priorDate = new Date(priorMtime);
    await fs.utimes(lockPath, priorDate, priorDate);
  } catch {}
}
