/**
 * Unified Diff Utility — Phase 28b
 *
 * Generates unified diffs between two strings without spawning a child process.
 * Used by FileEditTool to show what changed, and by /review to format diffs.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiffLine {
  type: "context" | "add" | "remove";
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface UnifiedDiff {
  oldFile: string;
  newFile: string;
  hunks: DiffHunk[];
  /** Pre-formatted unified diff string */
  text: string;
}

// ─── LCS-based diff algorithm ─────────────────────────────────────────────────

type EditOp = { type: "=" | "+" | "-"; value: string };

function computeEdits(oldLines: string[], newLines: string[]): EditOp[] {
  const m = oldLines.length;
  const n = newLines.length;

  // Myers diff via DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }

  // Trace back LCS
  const ops: EditOp[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: "=", value: oldLines[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.push({ type: "+", value: newLines[j - 1]! });
      j--;
    } else {
      ops.push({ type: "-", value: oldLines[i - 1]! });
      i--;
    }
  }

  return ops.reverse();
}

// ─── Hunk builder ─────────────────────────────────────────────────────────────

const CONTEXT_LINES = 3;

function buildHunks(edits: EditOp[]): DiffHunk[] {
  // Convert edits to DiffLines with line numbers
  const lines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const op of edits) {
    if (op.type === "=") {
      lines.push({ type: "context", content: op.value, oldLine, newLine });
      oldLine++;
      newLine++;
    } else if (op.type === "-") {
      lines.push({ type: "remove", content: op.value, oldLine });
      oldLine++;
    } else {
      lines.push({ type: "add", content: op.value, newLine });
      newLine++;
    }
  }

  // Group into hunks around changed lines
  const hunks: DiffHunk[] = [];
  let i = 0;

  while (i < lines.length) {
    // Find next changed line
    while (i < lines.length && lines[i]!.type === "context") i++;
    if (i >= lines.length) break;

    // Start of hunk: go back CONTEXT_LINES
    const start = Math.max(0, i - CONTEXT_LINES);
    const hunkLines: DiffLine[] = [];

    // Scan forward: include changed lines + CONTEXT_LINES after last change
    let lastChange = i;
    let j = start;

    while (j < lines.length) {
      hunkLines.push(lines[j]!);
      if (lines[j]!.type !== "context") lastChange = j;
      if (j > lastChange + CONTEXT_LINES) break;
      j++;
    }

    // Calculate hunk header
    const oldStart = hunkLines.find((l) => l.oldLine !== undefined)?.oldLine ?? 1;
    const newStart = hunkLines.find((l) => l.newLine !== undefined)?.newLine ?? 1;
    const oldCount = hunkLines.filter((l) => l.type !== "add").length;
    const newCount = hunkLines.filter((l) => l.type !== "remove").length;

    hunks.push({ oldStart, oldCount, newStart, newCount, lines: hunkLines });
    i = j + 1;
  }

  return hunks;
}

// ─── Formatter ────────────────────────────────────────────────────────────────

function formatHunk(hunk: DiffHunk): string {
  const header = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`;
  const body = hunk.lines
    .map((l) => {
      const prefix = l.type === "add" ? "+" : l.type === "remove" ? "-" : " ";
      return `${prefix}${l.content}`;
    })
    .join("\n");
  return `${header}\n${body}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a unified diff between two strings.
 *
 * @param oldText - Original content
 * @param newText - Modified content
 * @param oldFile - Label for the old file (default: "a/file")
 * @param newFile - Label for the new file (default: "b/file")
 */
export function unifiedDiff(
  oldText: string,
  newText: string,
  oldFile = "a/file",
  newFile = "b/file",
): UnifiedDiff {
  if (oldText === newText) {
    return { oldFile, newFile, hunks: [], text: "" };
  }

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const edits = computeEdits(oldLines, newLines);
  const hunks = buildHunks(edits);

  const header = `--- ${oldFile}\n+++ ${newFile}`;
  const body = hunks.map(formatHunk).join("\n");
  const text = hunks.length > 0 ? `${header}\n${body}` : "";

  return { oldFile, newFile, hunks, text };
}

/**
 * Quick helper: just get the diff string.
 */
export function diffText(
  oldText: string,
  newText: string,
  oldFile?: string,
  newFile?: string,
): string {
  return unifiedDiff(oldText, newText, oldFile, newFile).text;
}

/**
 * Count added/removed lines in a diff.
 */
export function diffStats(diff: UnifiedDiff): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      if (line.type === "add") added++;
      else if (line.type === "remove") removed++;
    }
  }
  return { added, removed };
}
