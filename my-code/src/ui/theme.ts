// Color palette aligned with Claude Code's CLI — phosphor green on black.
// Truecolor terminals get hex; terminals without 24-bit support fall back to
// the nearest named ANSI color so nothing prints raw escape codes.

import { supportsTrueColor } from "./terminal.js";

// Brand colors that need a named fallback on low-color terminals.
const HEX = {
  accent: "#7ce38b",
  accentBright: "#a8efb2",
  danger: "#e06c6c",
  warning: "#e0c66c",
  success: "#3eb868",
  suggestion: "#6f8f78",
  heading: "#7ce38b",
  text: "#ffffff",
  divider: "#1f3a26",
  selection: "#1f3a26",
  // Card/panel borders — calm green; the active/focused variant is brighter.
  border: "#2f5a3c",
  borderActive: "#7ce38b",
  // Context meter.
  meterFill: "#7ce38b",
  meterEmpty: "#1f3a26",
  // Side-by-side diff — bright text on subtle dark tints.
  diffAddText: "#a8efb2",
  diffDelText: "#f0b0b0",
  diffAddBg: "#10301c" as string | undefined,
  diffDelBg: "#3a1414" as string | undefined,
  diffGutter: "#2f5a3c",
  // Light-background execution panel (Bash output, tool bodies).
  panelBg: "#15211a" as string | undefined,
  panelBorder: "#23402d",
};
const NAMED = {
  accent: "green",
  accentBright: "greenBright",
  danger: "red",
  warning: "yellow",
  success: "green",
  suggestion: "gray",
  heading: "green",
  text: "white",
  divider: "gray",
  selection: "gray",
  border: "gray",
  borderActive: "green",
  meterFill: "green",
  meterEmpty: "gray",
  // Low-color terminals: foreground only; no subtle backgrounds (undefined = none).
  diffAddText: "greenBright",
  diffDelText: "red",
  diffAddBg: undefined as string | undefined,
  diffDelBg: undefined as string | undefined,
  diffGutter: "gray",
  panelBg: undefined as string | undefined,
  panelBorder: "gray",
};
const c = supportsTrueColor ? HEX : NAMED;

export const theme = {
  // Brand accent — phosphor green. `>`, headings, model name, spinner, selections.
  accent: c.accent,
  accentBright: c.accentBright,

  // Danger — YOLO / bypass mode + destructive operations.
  danger: c.danger,
  // Soft warning yellow — permission prompts, non-destructive cautions.
  warning: c.warning,
  // Success green — auto-allow, completed tasks, "+" diff lines.
  success: c.success,
  // Hint green-gray — footers, "see also" lines.
  suggestion: c.suggestion,
  // Headings inside the banner / panels.
  heading: c.heading,
  // Pure body text.
  text: c.text,
  // Dim gray — meta rows, hints, secondary info.
  muted: "gray",
  // Even-dimmer separator/divider character color.
  divider: c.divider,
  // Inverse / selection background.
  selection: c.selection,
  // Card/panel border — calm by default, bright when focused/active.
  border: c.border,
  borderActive: c.borderActive,
  // Context-usage meter.
  meterFill: c.meterFill,
  meterEmpty: c.meterEmpty,

  // Side-by-side diff colors (text + subtle backgrounds; bg undefined on low-color).
  diffAddText: c.diffAddText,
  diffDelText: c.diffDelText,
  diffAddBg: c.diffAddBg,
  diffDelBg: c.diffDelBg,
  diffGutter: c.diffGutter,
  // Light-background execution panel.
  panelBg: c.panelBg,
  panelBorder: c.panelBorder,

  // Tool category colors — kept calm so one green accent dominates. Only
  // mutations (magenta) and shell commands (yellow) get a louder color.
  toolFile: "green",     // Read
  toolEdit: "magenta",   // Write / Edit
  toolShell: "yellow",   // Bash
  toolSearch: "green",   // Glob / Grep
  toolTask: "green",     // TodoWrite
  toolWeb: "green",      // WebFetch / WebSearch
  toolNotebook: "magenta",
  toolPlan: "green",
  toolWorktree: "yellow",
  toolGeneric: "white",
};

// Return accent, but swap to danger when in bypass/YOLO mode.
export function modeAccent(bypassAll: boolean | undefined): string {
  return bypassAll ? theme.danger : theme.accent;
}
