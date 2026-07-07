import React from "react";
import { Text, useStdout } from "ink";
import { theme } from "./theme.js";

/**
 * A borderless "light-background" block — the calm elevated container OpenCode
 * wraps tool output in (header line + body, full width). Ink's <Box> has no
 * background, and <Text backgroundColor> only tints the literal characters it
 * wraps, so every line is space-padded to a common width and each piece (incl.
 * the trailing pad) carries a `backgroundColor` to make the fill span
 * edge-to-edge. A segment may override the block tint via its own `bg` (used by
 * diff add/del cells). On low-color terminals the tints are `undefined`, so this
 * degrades to plain colored text with no fill.
 */
export interface PanelSeg {
  text: string;
  color?: string;
  dim?: boolean;
  bold?: boolean;
  /** Per-segment background override (defaults to the block tint). */
  bg?: string;
}
export interface PanelLine {
  segments: PanelSeg[];
}

function visLen(segs: PanelSeg[]): number {
  let n = 0;
  for (const s of segs) n += s.text.length;
  return n;
}

/** Clip a line's segments to at most `max` visible columns, adding an ellipsis. */
function clipSegments(segs: PanelSeg[], max: number): PanelSeg[] {
  if (visLen(segs) <= max) return segs;
  const out: PanelSeg[] = [];
  let used = 0;
  for (const s of segs) {
    if (used >= max) break;
    const room = max - used;
    if (s.text.length <= room) {
      out.push(s);
      used += s.text.length;
    } else {
      out.push({ ...s, text: s.text.slice(0, Math.max(0, room - 1)) + "…" });
      used = max;
      break;
    }
  }
  return out;
}

interface Props {
  lines: PanelLine[];
  /** Inner width. Defaults to the terminal width minus `indent`. */
  width?: number;
  /** Columns reserved outside the block (left margin + right margin). */
  indent?: number;
  /** Add a blank tinted line above and below for a card-like vertical pad. */
  pad?: boolean;
}

export function Panel({ lines, width, indent = 0, pad = false }: Props): React.ReactElement {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const inner = Math.max(8, width ?? cols - indent);
  const blockBg = theme.panelBg;
  const rows: PanelLine[] = pad
    ? [{ segments: [] }, ...lines, { segments: [] }]
    : lines;

  return (
    <>
      {rows.map((ln, i) => {
        const clipped = clipSegments(ln.segments, inner);
        const tail = " ".repeat(Math.max(0, inner - visLen(clipped)));
        return (
          <Text key={i}>
            {clipped.map((s, j) => (
              <Text
                key={j}
                color={s.color}
                dimColor={s.dim}
                bold={s.bold}
                backgroundColor={s.bg ?? blockBg}
              >
                {s.text}
              </Text>
            ))}
            <Text backgroundColor={blockBg}>{tail}</Text>
          </Text>
        );
      })}
    </>
  );
}
