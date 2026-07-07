/**
 * Trust dialog — shown on first launch in a new directory.
 * Modeled after beta's components/TrustDialog/.
 *
 * Prevents the AI from reading/executing in untrusted directories
 * until the user explicitly grants trust.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const TRUST_FILE = ".my-code/trusted";

/** Directories that should never require trust (always trusted). */
const ALWAYS_TRUSTED = new Set([
  os.homedir(),
  os.tmpdir(),
]);

/**
 * Check if a directory has been explicitly trusted by the user.
 */
export async function isDirectoryTrusted(cwd: string): Promise<boolean> {
  // Home and temp directories are always trusted
  if (ALWAYS_TRUSTED.has(cwd)) return true;

  // Check if trust file exists in the project
  const trustPath = path.join(cwd, TRUST_FILE);
  try {
    await fs.access(trustPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark a directory as trusted by creating the trust file.
 */
export async function trustDirectory(cwd: string): Promise<void> {
  const trustPath = path.join(cwd, TRUST_FILE);
  await fs.mkdir(path.dirname(trustPath), { recursive: true });
  await fs.writeFile(trustPath, `trusted at ${new Date().toISOString()}\n`, "utf8");

  // Add to .gitignore if it exists
  const gitignorePath = path.join(cwd, ".my-code", ".gitignore");
  try {
    let content = "";
    try {
      content = await fs.readFile(gitignorePath, "utf8");
    } catch {
      // file doesn't exist yet
    }
    if (!content.includes("trusted")) {
      content += (content.endsWith("\n") || content === "" ? "" : "\n") + "trusted\n";
      await fs.writeFile(gitignorePath, content, "utf8");
    }
  } catch {
    // non-fatal
  }
}

/**
 * Format the trust prompt as a clean, aligned card (no ASCII ╔═╗ box).
 * Plain text — printed before the Ink UI mounts.
 */
export function formatTrustMessage(cwd: string): string {
  const INNER = 58; // columns between the vertical bars
  const title = " Trust this directory? ";
  const dash = "─".repeat(Math.max(0, INNER - title.length));
  const top = `╭${title}${dash}╮`;
  const bottom = `╰${"─".repeat(INNER)}╯`;
  const row = (s: string) => {
    const body = s.length > INNER - 2 ? s.slice(0, INNER - 3) + "…" : s;
    return `│ ${body}${" ".repeat(INNER - 2 - body.length)} │`;
  };
  return [
    top,
    row(""),
    row("my-code will read, run commands, and edit files in:"),
    row(`  ${cwd}`),
    row(""),
    row("[y] Yes, trust it       [n] No, exit"),
    row(""),
    bottom,
  ].join("\n");
}
