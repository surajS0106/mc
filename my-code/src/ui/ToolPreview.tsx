import { diffPanelLines } from "./StructuredDiff.js";
import type { PanelLine } from "./Panel.js";
import { theme } from "./theme.js";
import { RESULT_ARROW } from "./figures.js";
import type { ToolDiff } from "./types.js";

/**
 * Produces a tool's output body as flat PanelLine[] so it can render inside the
 * same full-width light-background block as the tool's header (OpenCode look).
 * Returns [] for tools that should render as a single header line (running
 * tools and read-only Read/Glob/Grep).
 */

interface Todo {
  content: string;
  activeForm?: string;
  status: "pending" | "in_progress" | "completed";
}

function progressBar(done: number, total: number, width = 6): string {
  if (total <= 0) return "";
  const filled = Math.round((width * done) / total);
  return "▰".repeat(filled) + "▱".repeat(Math.max(0, width - filled));
}

// Recover todos from the rendered result text when structured args aren't kept.
function parseTodos(result: string): Todo[] {
  return result
    .split("\n")
    .map((l): Todo | null => {
      const m = l.match(/^\s*\[([ x~])\]\s*(.*)$/);
      if (!m) return null;
      const status = m[1] === "x" ? "completed" : m[1] === "~" ? "in_progress" : "pending";
      return { content: m[2], status };
    })
    .filter((t): t is Todo => t !== null);
}

const PREVIEW_LINES = 6;

/** A `⎿ summary` lead-in line. */
function elbow(text: string, color = "gray"): PanelLine {
  return { segments: [{ text: `${RESULT_ARROW} `, color: "green" }, { text, color }] };
}
/** A plain content line (empty → blank tinted row). */
function plain(text: string, color?: string, dim?: boolean): PanelLine {
  return { segments: [{ text: text.length ? text : " ", color, dim }] };
}
function moreHint(n: number, noun = "lines"): PanelLine {
  return { segments: [{ text: `… +${n} ${noun}  (ctrl+o to expand)`, color: "gray", dim: true }] };
}

interface Params {
  toolName: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  expanded?: boolean;
  diff?: ToolDiff;
  /** Inner width of the surrounding panel — the diff fills this. */
  cols: number;
}

export function toolBodyLines({
  toolName,
  args,
  result,
  isError,
  expanded,
  diff,
  cols,
}: Params): PanelLine[] {
  if (result === undefined) return []; // still running

  // Error — red text.
  if (isError) {
    const lines = result.split("\n").slice(0, expanded ? undefined : 6);
    return lines.map((l, i) =>
      i === 0
        ? { segments: [{ text: "✗ ", color: theme.danger }, { text: l, color: theme.danger }] }
        : plain(`  ${l}`, theme.diffDelText, true)
    );
  }

  // Read / Glob / Grep — read-only tools render as a single header line only.
  if (toolName === "Read" || toolName === "Glob" || toolName === "Grep") return [];

  // Write — created file, content shown plain on the block.
  if (toolName === "Write") {
    const content = String(args.content ?? "");
    const all = content.split("\n");
    const shown = expanded ? all : all.slice(0, PREVIEW_LINES);
    const hidden = all.length - shown.length;
    const out = [elbow(`Created ${all.length}-line file`)];
    for (const l of shown) out.push(plain(l, theme.text));
    if (hidden > 0) out.push(moreHint(hidden));
    return out;
  }

  // Edit — side-by-side diff with real file line numbers.
  if (toolName === "Edit") {
    const before = diff?.before ?? String(args.old_string ?? "");
    const after = diff?.after ?? String(args.new_string ?? "");
    const file = diff?.filePath ?? String(args.file_path ?? "edit");
    const startLine = diff?.startLine ?? 1;
    const out = [elbow(result || `Edited ${file}`)];
    if (before || after) {
      out.push(
        ...diffPanelLines({
          filePath: file,
          before,
          after,
          context: expanded ? 3 : 1,
          startLine,
          showLineNumbers: true,
          cols,
        })
      );
    }
    return out;
  }

  // TodoWrite — checklist with a progress bar.
  if (toolName === "TodoWrite") {
    const todos: Todo[] = Array.isArray(args.todos)
      ? (args.todos as Todo[])
      : parseTodos(result);
    const total = todos.length;
    const done = todos.filter((t) => t.status === "completed").length;
    const out: PanelLine[] = [
      { segments: [{ text: `${progressBar(done, total)} ${done}/${total}`, color: theme.muted }] },
    ];
    for (const t of todos) {
      const glyph = t.status === "completed" ? "✓" : t.status === "in_progress" ? "◐" : "○";
      const gColor =
        t.status === "completed"
          ? theme.success
          : t.status === "in_progress"
          ? theme.accent
          : theme.muted;
      const label = t.status === "in_progress" && t.activeForm ? t.activeForm : t.content;
      out.push({
        segments: [
          { text: `${glyph} `, color: gColor },
          {
            text: label,
            color: t.status === "pending" ? theme.muted : theme.text,
            dim: t.status === "pending",
          },
        ],
      });
    }
    return out;
  }

  // WebSearch — result cards (title + URL).
  if (toolName === "WebSearch") {
    if (result.startsWith("(no results")) return [elbow("no results")];
    const blocks = result.split(/\n\s*\n/).filter(Boolean);
    const shown = expanded ? blocks : blocks.slice(0, 4);
    const hidden = blocks.length - shown.length;
    const out = [elbow(`${blocks.length} result${blocks.length !== 1 ? "s" : ""}`)];
    for (const b of shown) {
      const bl = b.split("\n");
      out.push(plain(bl[0]?.trim() ?? "", theme.text));
      const url = bl[1]?.trim();
      if (url) out.push(plain(`   ${url}`, theme.suggestion, true));
    }
    if (hidden > 0) out.push(moreHint(hidden, "more"));
    return out;
  }

  // Bash — `$ command` then output.
  if (toolName === "Bash") {
    const command = String(args.command ?? "").trim();
    const all = result.split("\n");
    const shown = expanded ? all : all.slice(0, PREVIEW_LINES);
    const hidden = all.length - shown.length;
    const out: PanelLine[] = [];
    if (command) out.push({ segments: [{ text: `$ ${command}`, color: theme.accent, bold: true }] });
    for (const l of shown) out.push(plain(l, theme.text, true));
    if (hidden > 0) out.push(moreHint(hidden));
    return out;
  }

  // Generic fallback — first line as summary, rest below.
  const all = result.split("\n");
  const shown = expanded ? all : all.slice(0, PREVIEW_LINES);
  const hidden = all.length - shown.length;
  const out = [elbow(shown[0] ?? "")];
  for (const l of shown.slice(1)) out.push(plain(l, theme.text, true));
  if (hidden > 0) out.push(moreHint(hidden, "more"));
  return out;
}
