import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

const execAsync = promisify(exec);

// Synchronous branch lookup for first-paint use (e.g. the startup banner, which
// renders once inside Ink's <Static> and can't update from an async result).
export function getBranchSync(cwd: string): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

export async function findGitRoot(startPath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git rev-parse --show-toplevel", { cwd: startPath });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function isAtGitRoot(cwd: string): Promise<boolean> {
  const root = await findGitRoot(cwd);
  if (!root) return false;
  // Use path.resolve to normalize
  return path.resolve(cwd) === path.resolve(root);
}

export async function getBranch(cwd: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function getChangedFiles(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync("git --no-optional-locks status --porcelain", { cwd });
    return stdout
      .trim()
      .split("\n")
      .map((line) => line.trim().split(" ", 2)[1]?.trim())
      .filter((line): line is string => !!line);
  } catch {
    return [];
  }
}

export interface GitFileStatus {
  tracked: string[];
  untracked: string[];
}

export async function getFileStatus(cwd: string): Promise<GitFileStatus> {
  const tracked: string[] = [];
  const untracked: string[] = [];
  try {
    const { stdout } = await execAsync("git --no-optional-locks status --porcelain", { cwd });
    const lines = stdout.trim().split("\n").filter((line) => line.length > 0);
    for (const line of lines) {
      const status = line.substring(0, 2);
      const filename = line.substring(2).trim();
      if (status === "??") {
        untracked.push(filename);
      } else if (filename) {
        tracked.push(filename);
      }
    }
  } catch {}
  return { tracked, untracked };
}

/**
 * Stashes all changes (including untracked files) to return git to a clean state.
 */
export async function stashToCleanState(cwd: string, message?: string): Promise<boolean> {
  try {
    const stashMessage = message || `auto-stash - ${new Date().toISOString()}`;
    const { untracked } = await getFileStatus(cwd);

    if (untracked.length > 0) {
      await execAsync(`git add ${untracked.map(u => `"${u}"`).join(" ")}`, { cwd });
    }

    await execAsync(`git stash push --message "${stashMessage}"`, { cwd });
    return true;
  } catch {
    return false;
  }
}

export async function hasUnpushedCommits(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync("git rev-list --count @{u}..HEAD", { cwd });
    return parseInt(stdout.trim(), 10) > 0;
  } catch {
    return false;
  }
}
