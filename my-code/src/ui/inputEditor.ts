// Pure editor transforms + width-aware visual-line layout for RichInput.
// No React here — kept side-effect-free so the editor logic is easy to reason about
// and test independently of Ink rendering.

export interface Editor {
  text: string;
  cursor: number;
}

// A wrapped view of the buffer: `rows` is what the user sees (one entry per visual
// line after soft-wrapping at `width`), and `rowStart[i]` is the absolute character
// offset in `text` where visual row `i` begins. Newline characters are consumed
// between logical lines and belong to no row.
export interface Layout {
  rows: string[];
  rowStart: number[];
}

// ── Cursor / text transforms ──────────────────────────────────────────────
export function clampCursor(text: string, cursor: number): number {
  return Math.max(0, Math.min(cursor, text.length));
}

export function insertText(s: Editor, t: string): Editor {
  return { text: s.text.slice(0, s.cursor) + t + s.text.slice(s.cursor), cursor: s.cursor + t.length };
}

export function backspace(s: Editor): Editor {
  if (s.cursor <= 0) return s;
  return { text: s.text.slice(0, s.cursor - 1) + s.text.slice(s.cursor), cursor: s.cursor - 1 };
}

// Start of the current logical line (offset just after the previous newline).
export function lineStart(text: string, cursor: number): number {
  const nl = text.lastIndexOf("\n", cursor - 1);
  return nl === -1 ? 0 : nl + 1;
}

// End of the current logical line (offset of the next newline, or end of text).
export function lineEnd(text: string, cursor: number): number {
  const nl = text.indexOf("\n", cursor);
  return nl === -1 ? text.length : nl;
}

// Start of the word before the cursor: skip trailing spaces, then non-spaces.
export function wordStart(text: string, cursor: number): number {
  let i = cursor;
  while (i > 0 && /\s/.test(text[i - 1])) i--;
  while (i > 0 && !/\s/.test(text[i - 1])) i--;
  return i;
}

// End of the word after the cursor: skip leading spaces, then non-spaces.
export function wordEnd(text: string, cursor: number): number {
  let i = cursor;
  while (i < text.length && /\s/.test(text[i])) i++;
  while (i < text.length && !/\s/.test(text[i])) i++;
  return i;
}

// ── Visual-line layout ────────────────────────────────────────────────────
// Split on newlines, then hard-wrap each logical line into chunks of `width`
// columns. An empty logical line still yields one empty visual row.
export function wrapVisual(text: string, width: number): Layout {
  const w = Math.max(1, Math.floor(width));
  const rows: string[] = [];
  const rowStart: number[] = [];
  const logical = text.split("\n");
  let offset = 0; // absolute offset at the start of the current logical line
  for (const line of logical) {
    if (line.length === 0) {
      rows.push("");
      rowStart.push(offset);
    } else {
      for (let i = 0; i < line.length; i += w) {
        rows.push(line.slice(i, i + w));
        rowStart.push(offset + i);
      }
    }
    offset += line.length + 1; // +1 for the consumed "\n"
  }
  return { rows, rowStart };
}

// Map an absolute cursor offset to its visual { row, col }.
export function offsetToRowCol(layout: Layout, cursor: number): { row: number; col: number } {
  const { rows, rowStart } = layout;
  // Last row whose start is <= cursor.
  let row = 0;
  for (let i = 0; i < rowStart.length; i++) {
    if (rowStart[i] <= cursor) row = i;
    else break;
  }
  const col = Math.min(cursor - rowStart[row], rows[row].length);
  return { row, col };
}

// Map a visual (row, col) back to an absolute cursor offset, clamping into range.
export function rowColToOffset(layout: Layout, row: number, col: number): number {
  const { rows, rowStart } = layout;
  const r = Math.max(0, Math.min(row, rows.length - 1));
  const c = Math.max(0, Math.min(col, rows[r].length));
  return rowStart[r] + c;
}
