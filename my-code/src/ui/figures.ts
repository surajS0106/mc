// Unicode glyphs used across the UI. macOS gets the "filled circle" variant
// that aligns better in monospace fonts; everything else uses the basic one.
// On terminals without reliable unicode (legacy Windows cmd.exe / conhost) we
// fall back to ASCII so nothing renders as garbage boxes.

import { supportsUnicode } from "./terminal.js";

const isMac = process.platform === "darwin";

export const BLACK_CIRCLE = supportsUnicode ? (isMac ? "⏺" : "●") : "*";
export const BULLET = supportsUnicode ? "∙" : "-";
export const TEARDROP_ASTERISK = supportsUnicode ? "✻" : "*";
// Spinner frames — braille on capable terminals, classic ASCII twirl otherwise.
export const SPARKLE_FRAMES = supportsUnicode
  ? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  : ["|", "/", "-", "\\"];
// Dim scanline divider used by the banner / status bar.
export const SCANLINE = supportsUnicode ? "─" : "-";
export const RESULT_ARROW = supportsUnicode ? "⎿" : "\\";
export const ARROW_RIGHT = supportsUnicode ? "▸" : ">";
export const HORIZONTAL_LINE = supportsUnicode ? "─" : "-";
export const GIT_BRANCH = supportsUnicode ? "⎇" : "git:";
// Context-usage meter cells (filled / empty).
export const METER_FILL = supportsUnicode ? "▰" : "#";
export const METER_EMPTY = supportsUnicode ? "▱" : "-";
// Status-bar segment separator.
export const SEP = supportsUnicode ? "┃" : "|";
// Per-turn footer / sub-line elbow.
export const CORNER = supportsUnicode ? "└" : "`-";
// Tree connectors for subagent child tool calls.
export const TREE_BRANCH = supportsUnicode ? "├" : "|-";
export const TREE_VERTICAL = supportsUnicode ? "│" : "| ";
export const TREE_CORNER = supportsUnicode ? "└" : "`-";
