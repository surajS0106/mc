import React from "react";
import { Text, useStdout } from "ink";
import { theme } from "./theme.js";
import { supportsUnicode } from "./terminal.js";

// Box-drawing set with ASCII fallback for legacy consoles.
const G = supportsUnicode
  ? { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" }
  : { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" };

export interface CardProps {
  /** Left label rendered on the top border line. */
  title?: string;
  /** Right label rendered on the top border line (e.g. "+12 -3 · 0.1s"). */
  meta?: string;
  /** Pre-formatted body lines. Diff-prefixed lines (+/-) are auto-colored. */
  lines?: string[];
  /** Border color. Defaults to theme.border. */
  color?: string;
  /** Total card width. Defaults to terminal width (clamped 24–96). */
  width?: number;
  /** Optional right-aligned label on the bottom border. */
  footer?: string;
}

function clip(s: string, w: number): string {
  if (w <= 0) return "";
  if (s.length <= w) return s;
  if (w === 1) return "…";
  return s.slice(0, w - 1) + "…";
}

/** Color a body line by its diff prefix so colored content keeps card alignment. */
function lineColor(line: string): string | undefined {
  if (line.startsWith("+") && !line.startsWith("++")) return theme.success;
  if (line.startsWith("-") && !line.startsWith("--")) return theme.danger;
  return undefined;
}

/**
 * A bordered "card" whose title + meta render on the top border line:
 *   ╭ Edit · src/x.ts ───────── +12 -3 · 0.1s ╮
 *   │ body…                                    │
 *   ╰────────────────────────────────────────────╯
 * Body lines are plain strings (padded/clipped here) so the right edge always
 * aligns even when individual lines are colored.
 */
export function Card({ title, meta, lines = [], color, width, footer }: CardProps) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const total = Math.max(24, Math.min(width ?? cols - 4, 96));
  const inner = total - 2; // columns between the two vertical bars
  const bc = color ?? theme.border;

  // Top border pieces: ╭ <title> <dashes> <meta> ╮
  let t = title ? ` ${title} ` : "";
  let m = meta ? ` ${meta} ` : "";
  if (t.length + m.length > inner) {
    // Title gives way first so meta (counts/timing) stays readable.
    t = clip(title ? ` ${title} ` : "", Math.max(0, inner - m.length));
  }
  const dashCount = Math.max(0, inner - t.length - m.length);

  // Bottom border: ╰ <dashes> <footer> ╯
  const f = footer ? ` ${footer} ` : "";
  const botDash = Math.max(0, inner - f.length);

  const bodyWidth = inner - 2; // 1 space padding each side

  return (
    <>
      <Text>
        <Text color={bc}>{G.tl}</Text>
        {t ? <Text color={theme.text} bold>{t}</Text> : null}
        <Text color={bc}>{G.h.repeat(dashCount)}</Text>
        {m ? <Text color={theme.muted}>{m}</Text> : null}
        <Text color={bc}>{G.tr}</Text>
      </Text>
      {lines.map((ln, i) => {
        const body = clip(ln, bodyWidth);
        const pad = " ".repeat(Math.max(0, bodyWidth - body.length));
        const col = lineColor(body);
        return (
          <Text key={i}>
            <Text color={bc}>{G.v}</Text>
            <Text> </Text>
            <Text color={col} dimColor={!col}>{body}</Text>
            <Text>{pad} </Text>
            <Text color={bc}>{G.v}</Text>
          </Text>
        );
      })}
      <Text color={bc}>
        {G.bl}
        {G.h.repeat(botDash)}
        {f ? <Text color={theme.muted}>{f}</Text> : null}
        {G.br}
      </Text>
    </>
  );
}
