import React from "react";
import { Box, Text } from "ink";
import { structuredPatch } from "diff";
import { theme } from "./theme.js";
import { supportsUnicode } from "./terminal.js";
import type { PanelSeg, PanelLine } from "./Panel.js";

/**
 * Diff helpers.
 *
 *  - `StructuredDiff` (component): compact single-column unified diff with a
 *    +/- gutter — used by the permission prompt.
 *  - `diffPanelLines` (function): produces OpenCode-style side-by-side rows as
 *    flat PanelLine[] so they can live inside the same full-width light-bg block
 *    as the rest of a tool's output. OLD on the left column, NEW on the right,
 *    each with its own line-number gutter and red/green tint. Falls back to a
 *    unified single column when the terminal is too narrow for two.
 */
interface Props {
  filePath: string;
  before: string;
  after: string;
  /** Max lines of context on each side of a hunk (default 2). */
  context?: number;
  /** Show the per-line number gutter (default true). */
  showLineNumbers?: boolean;
  /** Drop the "── file" header + "@@" hunk markers for a tight inline look. */
  compact?: boolean;
  /** File line where `before`/`after` begin, so gutters show real file numbers. */
  startLine?: number;
}

function gutter(n: number | null): string {
  return (n === null ? "" : String(n)).padStart(4, " ");
}

function clip(s: string, w: number): string {
  if (w <= 0) return "";
  if (s.length <= w) return s;
  if (w === 1) return "…";
  return s.slice(0, w - 1) + "…";
}

type CellType = "context" | "del" | "add" | "empty";
interface Cell {
  num: number | null;
  text: string;
  type: CellType;
}
interface Row {
  left: Cell;
  right: Cell;
}

/** Convert one structuredPatch hunk into paired side-by-side rows. */
function hunkToRows(
  hunk: { oldStart: number; newStart: number; lines: string[] },
  offset: number
): Row[] {
  const rows: Row[] = [];
  let oldLine = hunk.oldStart + offset;
  let newLine = hunk.newStart + offset;
  const L = hunk.lines;
  let i = 0;
  while (i < L.length) {
    const sign = L[i][0];
    if (sign === " ") {
      const body = L[i].slice(1);
      rows.push({
        left: { num: oldLine++, text: body, type: "context" },
        right: { num: newLine++, text: body, type: "context" },
      });
      i++;
      continue;
    }
    // Buffer a run of deletions, then a run of additions, and zip them.
    const dels: string[] = [];
    while (i < L.length && L[i][0] === "-") {
      dels.push(L[i].slice(1));
      i++;
    }
    const adds: string[] = [];
    while (i < L.length && L[i][0] === "+") {
      adds.push(L[i].slice(1));
      i++;
    }
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) {
      const left: Cell =
        k < dels.length
          ? { num: oldLine++, text: dels[k], type: "del" }
          : { num: null, text: "", type: "empty" };
      const right: Cell =
        k < adds.length
          ? { num: newLine++, text: adds[k], type: "add" }
          : { num: null, text: "", type: "empty" };
      rows.push({ left, right });
    }
  }
  return rows;
}

function cellStyle(type: CellType): { fg: string | undefined; bg: string | undefined } {
  switch (type) {
    case "add":
      return { fg: theme.diffAddText, bg: theme.diffAddBg };
    case "del":
      return { fg: theme.diffDelText, bg: theme.diffDelBg };
    case "context":
      return { fg: theme.muted, bg: theme.panelBg };
    case "empty":
      return { fg: undefined, bg: theme.panelBg };
  }
}

const MIN_TEXT = 16;

function halfSegs(cell: Cell, textW: number, gutterW: number, showNums: boolean): PanelSeg[] {
  const { fg, bg } = cellStyle(cell.type);
  const shown = clip(cell.text, textW);
  const padded = shown + " ".repeat(Math.max(0, textW - shown.length));
  const segs: PanelSeg[] = [];
  if (showNums) {
    const numStr = (cell.num === null ? "" : String(cell.num)).padStart(gutterW) + " ";
    segs.push({ text: numStr, color: theme.diffGutter, bg });
  }
  segs.push({ text: padded, color: fg, dim: cell.type === "context", bg });
  return segs;
}

/**
 * Render a diff as flat PanelLine[] — side-by-side when it fits, unified
 * otherwise. `cols` is the panel's inner width the diff should fill.
 */
export function diffPanelLines(opts: {
  filePath: string;
  before: string;
  after: string;
  context?: number;
  startLine?: number;
  showLineNumbers?: boolean;
  cols: number;
}): PanelLine[] {
  const {
    filePath,
    before,
    after,
    context = 1,
    startLine = 1,
    showLineNumbers = true,
    cols,
  } = opts;
  if (before === after) return [];
  const patch = structuredPatch(filePath, filePath, before, after, "", "", { context });
  if (patch.hunks.length === 0) return [];

  const offset = startLine - 1;
  const hunkRows = patch.hunks.map((h) => hunkToRows(h, offset));
  const maxNum = hunkRows
    .flat()
    .reduce((m, r) => Math.max(m, r.left.num ?? 0, r.right.num ?? 0), 0);
  const gutterW = Math.max(3, String(maxNum).length);

  const sep = supportsUnicode ? " │ " : " | ";
  const numCols = showLineNumbers ? (gutterW + 1) * 2 : 0;
  const textW = Math.floor((cols - numCols - sep.length) / 2);

  const out: PanelLine[] = [];

  if (textW >= MIN_TEXT) {
    // Side-by-side.
    hunkRows.forEach((rows, hi) => {
      if (hi > 0) out.push({ segments: [] });
      for (const row of rows) {
        out.push({
          segments: [
            ...halfSegs(row.left, textW, gutterW, showLineNumbers),
            { text: sep, color: theme.muted, bg: theme.panelBg },
            ...halfSegs(row.right, textW, gutterW, showLineNumbers),
          ],
        });
      }
    });
    return out;
  }

  // Unified fallback (single column).
  patch.hunks.forEach((hunk, hi) => {
    let oldLine = hunk.oldStart + offset;
    let newLine = hunk.newStart + offset;
    if (hi > 0) out.push({ segments: [] });
    for (const line of hunk.lines) {
      const sign = line[0];
      const body = line.slice(1);
      let num: number;
      if (sign === "+") num = newLine++;
      else if (sign === "-") num = oldLine++;
      else {
        num = newLine++;
        oldLine++;
      }
      const color =
        sign === "+" ? theme.diffAddText : sign === "-" ? theme.diffDelText : theme.muted;
      const bg = sign === "+" ? theme.diffAddBg : sign === "-" ? theme.diffDelBg : theme.panelBg;
      const segs: PanelSeg[] = [];
      if (showLineNumbers) {
        segs.push({ text: String(num).padStart(gutterW) + " ", color: theme.diffGutter, bg });
      }
      segs.push({
        text: (sign === " " ? "  " : sign + " ") + body,
        color,
        dim: sign === " ",
        bg,
      });
      out.push({ segments: segs });
    }
  });
  return out;
}

/** Compact unified-diff component — used by the permission prompt preview. */
export function StructuredDiff({
  filePath,
  before,
  after,
  context = 2,
  showLineNumbers = true,
  compact = false,
  startLine = 1,
}: Props): React.ReactElement | null {
  if (before === after) return null;
  const patch = structuredPatch(filePath, filePath, before, after, "", "", { context });
  if (patch.hunks.length === 0) return null;
  const offset = startLine - 1;

  return (
    <Box flexDirection="column">
      {!compact && <Text color={theme.toolFile}>── {filePath}</Text>}
      {patch.hunks.map((hunk, i) => {
        let oldLine = hunk.oldStart + offset;
        let newLine = hunk.newStart + offset;
        return (
          <Box key={i} flexDirection="column" marginTop={i === 0 ? 0 : 1}>
            {!compact && (
              <Text color={theme.muted} dimColor>
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </Text>
            )}
            {hunk.lines.map((line, j) => {
              const sign = line[0];
              const body = line.slice(1);
              let num: number | null;
              if (sign === "+") {
                num = newLine++;
              } else if (sign === "-") {
                num = oldLine++;
              } else {
                num = newLine++;
                oldLine++;
              }
              const color =
                sign === "+" ? theme.success : sign === "-" ? theme.danger : theme.muted;
              return (
                <Box key={j}>
                  {showLineNumbers && (
                    <Text color={theme.muted} dimColor>{gutter(num)} </Text>
                  )}
                  <Text color={color} dimColor={sign === " "}>
                    {sign === " " ? "  " : sign + " "}
                    {body}
                  </Text>
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
