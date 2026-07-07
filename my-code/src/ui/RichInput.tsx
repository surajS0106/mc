import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { SlashPicker } from "./SlashPicker.js";
import { MentionPicker } from "./MentionPicker.js";
import { filterCommands } from "./slashCommands.js";
import { pushHistory, historyAt, historyLength } from "./inputHistory.js";
import { ensureScan, matchFiles, cachedFiles } from "./fileMentions.js";
import type { EditMode } from "../config/permissions.js";
import { theme } from "./theme.js";
import { supportsUnicode } from "./terminal.js";
import {
  type Editor,
  clampCursor,
  insertText,
  backspace,
  lineStart,
  lineEnd,
  wordStart,
  wordEnd,
  wrapVisual,
  offsetToRowCol,
  rowColToOffset,
} from "./inputEditor.js";

interface Props {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  editMode?: EditMode;
  bypassAll?: boolean;
  cwd?: string;
}

// Most rows we'll render inside the box before windowing kicks in. Keeps a long
// paste from ballooning the input to fill the screen.
const MAX_ROWS = 10;
const PROMPT = "❯ ";
const PAD_X = 1;

// Detect a trailing `@token` immediately before the cursor (no spaces inside).
function mentionContext(text: string, cursor: number): { query: string; at: number } | null {
  const before = text.slice(0, cursor);
  const m = before.match(/(?:^|\s)@([^\s@]*)$/);
  if (!m) return null;
  return { query: m[1], at: cursor - m[1].length - 1 };
}

export function RichInput({ onSubmit, disabled, placeholder, editMode, bypassAll, cwd }: Props) {
  const [editor, setEditor] = useState<Editor>({ text: "", cursor: 0 });
  const [pickerIdx, setPickerIdx] = useState(0);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionOff, setMentionOff] = useState(false);
  // History browsing: null = editing fresh; otherwise distance from newest (1-based).
  const [histPos, setHistPos] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  // Sticky column for vertical cursor moves (null = use the current column).
  const [desiredCol, setDesiredCol] = useState<number | null>(null);
  // Timestamp of the last Esc, for double-Esc-to-clear.
  const lastEsc = useRef(0);
  // Bumped when the file scan finishes so matches recompute.
  const [, setScanTick] = useState(0);

  const buffer = editor.text;
  const cursor = editor.cursor;

  // ── Terminal width → wrapping ──
  const { stdout } = useStdout();
  const [cols, setCols] = useState(stdout?.columns ?? 80);
  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setCols(stdout.columns ?? 80);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  // Usable text columns per row: terminal − borders(2) − paddingX(2) − prompt gutter.
  const textWidth = Math.max(8, cols - 2 - PAD_X * 2 - PROMPT.length);
  const layout = useMemo(() => wrapVisual(buffer, textWidth), [buffer, textWidth]);

  const lastLine = buffer.split("\n").pop() ?? "";
  const showingPicker =
    !disabled && buffer.startsWith("/") && !buffer.includes(" ") && !buffer.includes("\n");
  const slashQuery = showingPicker ? lastLine.slice(1) : "";
  const matches = showingPicker ? filterCommands(slashQuery) : [];
  const boundedIdx = matches.length ? Math.min(pickerIdx, matches.length - 1) : 0;

  // @-mention popover state.
  const mention = !disabled && !showingPicker && !mentionOff ? mentionContext(buffer, cursor) : null;
  const mentionActive = !!mention;
  useEffect(() => {
    if (mentionActive && cwd) ensureScan(cwd, () => setScanTick((t) => t + 1));
  }, [mentionActive, cwd]);
  const fileMatches = mention && cwd ? matchFiles(cwd, mention.query) : [];
  const scanning = !!mention && !!cwd && cachedFiles(cwd) === null;
  const boundedMention = fileMatches.length ? Math.min(mentionIdx, fileMatches.length - 1) : 0;
  const showingMention = !!mention && (fileMatches.length > 0 || scanning);

  // Mark that we've left history browsing / re-enabled the mention popover.
  const onEdit = () => {
    setHistPos(null);
    setMentionOff(false);
    setPickerIdx(0);
    setMentionIdx(0);
    setDesiredCol(null);
  };

  const applyMention = (file: string) => {
    if (!mention) return;
    const next = buffer.slice(0, mention.at) + "@" + file + " " + buffer.slice(cursor);
    setEditor({ text: next, cursor: mention.at + 1 + file.length + 1 });
    setMentionOff(false);
    setMentionIdx(0);
  };

  const recallHistory = (dir: -1 | 1) => {
    const len = historyLength();
    if (len === 0) return;
    if (dir === -1) {
      const nextPos = histPos === null ? 1 : Math.min(histPos + 1, len);
      if (histPos === null) setDraft(buffer);
      const entry = historyAt(nextPos) ?? "";
      setHistPos(nextPos);
      setEditor({ text: entry, cursor: entry.length });
    } else {
      if (histPos === null) return;
      const nextPos = histPos - 1;
      if (nextPos < 1) {
        setHistPos(null);
        setEditor({ text: draft, cursor: draft.length });
      } else {
        const entry = historyAt(nextPos) ?? "";
        setHistPos(nextPos);
        setEditor({ text: entry, cursor: entry.length });
      }
    }
  };

  function resetAll() {
    setEditor({ text: "", cursor: 0 });
    setPickerIdx(0);
    setMentionIdx(0);
    setMentionOff(false);
    setHistPos(null);
    setDraft("");
    setDesiredCol(null);
  }

  // Move the cursor one visual row up/down. Returns false if already at the
  // top/bottom edge (so the caller can fall through to history recall).
  function moveVertical(dir: -1 | 1): boolean {
    const { row, col } = offsetToRowCol(layout, cursor);
    const targetRow = row + dir;
    if (targetRow < 0 || targetRow >= layout.rows.length) return false;
    const goalCol = desiredCol == null ? col : desiredCol;
    const next = rowColToOffset(layout, targetRow, goalCol);
    setDesiredCol(goalCol);
    setEditor((s) => ({ ...s, cursor: next }));
    return true;
  }

  useInput((input, key) => {
    if (disabled) return;

    // shift+enter → newline at cursor
    if (key.return && key.shift) {
      onEdit();
      setEditor((s) => insertText(s, "\n"));
      return;
    }

    if (key.return) {
      if (showingMention && fileMatches[boundedMention]) {
        applyMention(fileMatches[boundedMention]);
        return;
      }
      if (showingPicker && matches[boundedIdx]) {
        const chosen = matches[boundedIdx];
        const typedExact = chosen.name === slashQuery;
        if (!typedExact && !chosen.args) {
          onSubmit("/" + chosen.name);
          resetAll();
          return;
        }
        if (!typedExact && chosen.args) {
          setEditor({ text: "/" + chosen.name + " ", cursor: chosen.name.length + 2 });
          setPickerIdx(0);
          return;
        }
      }
      const trimmed = buffer.trim();
      if (trimmed) {
        pushHistory(trimmed);
        onSubmit(trimmed);
        resetAll();
      }
      return;
    }

    if (key.tab) {
      if (showingMention && fileMatches[boundedMention]) {
        applyMention(fileMatches[boundedMention]);
        return;
      }
      if (showingPicker && matches[boundedIdx]) {
        const chosen = matches[boundedIdx];
        setEditor({
          text: "/" + chosen.name + (chosen.args ? " " : ""),
          cursor: chosen.name.length + (chosen.args ? 2 : 1),
        });
        setPickerIdx(0);
      }
      return;
    }

    if (key.upArrow) {
      if (showingMention) return setMentionIdx((i) => Math.max(0, i - 1));
      if (showingPicker) return setPickerIdx((i) => Math.max(0, i - 1));
      // Navigate within a multi-line buffer; recall history only at the top edge.
      if (moveVertical(-1)) return;
      recallHistory(-1);
      return;
    }
    if (key.downArrow) {
      if (showingMention) return setMentionIdx((i) => Math.min(fileMatches.length - 1, i + 1));
      if (showingPicker) return setPickerIdx((i) => Math.min(matches.length - 1, i + 1));
      if (moveVertical(1)) return;
      recallHistory(1);
      return;
    }

    if (key.leftArrow) {
      setDesiredCol(null);
      const byWord = key.ctrl || key.meta;
      setEditor((s) => ({
        ...s,
        cursor: byWord ? wordStart(s.text, s.cursor) : clampCursor(s.text, s.cursor - 1),
      }));
      return;
    }
    if (key.rightArrow) {
      setDesiredCol(null);
      const byWord = key.ctrl || key.meta;
      setEditor((s) => ({
        ...s,
        cursor: byWord ? wordEnd(s.text, s.cursor) : clampCursor(s.text, s.cursor + 1),
      }));
      return;
    }

    // Readline-style editing shortcuts.
    if (key.ctrl) {
      const c = input.toLowerCase();
      if (c === "a") {
        setDesiredCol(null);
        return setEditor((s) => ({ ...s, cursor: lineStart(s.text, s.cursor) }));
      }
      if (c === "e") {
        setDesiredCol(null);
        return setEditor((s) => ({ ...s, cursor: lineEnd(s.text, s.cursor) }));
      }
      if (c === "u") {
        onEdit();
        return setEditor((s) => {
          const start = lineStart(s.text, s.cursor);
          return { text: s.text.slice(0, start) + s.text.slice(s.cursor), cursor: start };
        });
      }
      if (c === "k") {
        onEdit();
        return setEditor((s) => {
          const end = lineEnd(s.text, s.cursor);
          return { text: s.text.slice(0, s.cursor) + s.text.slice(end), cursor: s.cursor };
        });
      }
      if (c === "w") {
        onEdit();
        return setEditor((s) => {
          const start = wordStart(s.text, s.cursor);
          return { text: s.text.slice(0, start) + s.text.slice(s.cursor), cursor: start };
        });
      }
      return; // other ctrl combos handled at app level
    }
    if (key.meta) return;

    if (key.backspace || key.delete) {
      onEdit();
      setEditor((s) => backspace(s));
      return;
    }

    if (key.escape) {
      if (showingMention) {
        setMentionOff(true);
        return;
      }
      // Non-destructive: a single Esc no longer wipes the draft. Press Esc twice
      // quickly to clear (Ctrl+U still clears the current line).
      const now = Date.now();
      if (buffer && now - lastEsc.current < 600) {
        resetAll();
        lastEsc.current = 0;
        return;
      }
      lastEsc.current = now;
      return;
    }

    // Printable input (single char or a paste chunk).
    if (input && (input.length > 1 || input.charCodeAt(0) >= 32)) {
      const text = input.replace(/\r/g, "\n").replace(/\t/g, "  ");
      onEdit();
      setEditor((s) => insertText(s, text));
    }
  });

  // ── Render ──
  const { row: curRow, col: curCol } = offsetToRowCol(layout, cursor);
  const total = layout.rows.length;

  // Window the visible rows around the cursor so the box height stays bounded.
  let start = 0;
  if (total > MAX_ROWS) {
    start = Math.min(Math.max(curRow - Math.floor(MAX_ROWS / 2), 0), total - MAX_ROWS);
  }
  const end = Math.min(start + MAX_ROWS, total);
  const hiddenAbove = start;
  const hiddenBelow = total - end;

  const borderColor = disabled
    ? theme.divider
    : bypassAll || editMode === "bypass"
    ? theme.danger
    : editMode === "accept-edits"
    ? theme.warning
    : theme.muted;

  const pad = " ".repeat(PROMPT.length);

  return (
    <Box flexDirection="column">
      {/* Popovers above the box */}
      {showingMention && (
        <MentionPicker matches={fileMatches} selectedIndex={boundedMention} scanning={scanning} />
      )}
      {!showingMention && showingPicker && matches.length > 0 && (
        <SlashPicker commands={matches} selectedIndex={boundedIdx} />
      )}
      {!showingMention && showingPicker && matches.length === 0 && slashQuery.length > 0 && (
        <Box paddingX={1}>
          <Text color={theme.muted} dimColor>no command matches "/{slashQuery}" — /help to see all</Text>
        </Box>
      )}

      {/* Input box */}
      <Box borderStyle={supportsUnicode ? "round" : "classic"} borderColor={borderColor} flexDirection="column" paddingX={PAD_X}>
        {buffer ? (
          <>
            {hiddenAbove > 0 && (
              <Text color={theme.muted} dimColor>{pad}↑ {hiddenAbove} more</Text>
            )}
            {layout.rows.slice(start, end).map((line, idx) => {
              const i = start + idx;
              const isCursorLine = i === curRow && !disabled;
              const before = isCursorLine ? line.slice(0, curCol) : line;
              const at = isCursorLine ? line[curCol] ?? " " : "";
              const after = isCursorLine ? line.slice(curCol + 1) : "";
              return (
                <Box key={i}>
                  {i === 0 ? (
                    <Text color={theme.accent} bold>{PROMPT}</Text>
                  ) : (
                    <Text>{pad}</Text>
                  )}
                  <Text color={theme.text}>{before}</Text>
                  {isCursorLine && <Text inverse>{at}</Text>}
                  <Text color={theme.text}>{after}</Text>
                </Box>
              );
            })}
            {hiddenBelow > 0 && (
              <Text color={theme.muted} dimColor>{pad}↓ {hiddenBelow} more</Text>
            )}
          </>
        ) : (
          <Box>
            <Text color={theme.accent} bold>{PROMPT}</Text>
            {!disabled && <Text inverse> </Text>}
            {!disabled && (
              <Text color={theme.muted} dimColor>
                {placeholder ?? "ask anything or type / for commands"}
              </Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
