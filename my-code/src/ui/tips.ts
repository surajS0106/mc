export const TIPS: string[] = [
  "Tip: /compact to summarize the conversation and free context",
  "Tip: /status shows tokens, context, rules, bypass state",
  "Tip: /usage shows today / week / all-time across sessions",
  "Tip: /model without args opens the model picker",
  "Tip: /allow project Bash(npm test:*) to auto-approve test runs",
  "Tip: shift+tab cycles edit-approval mode (normal / accept-edits / yolo)",
  "Tip: ctrl+o expands the most recent truncated tool output",
  "Tip: drop a my-code.md in your project — it's loaded into the system prompt",
  "Tip: esc interrupts the current turn",
  "Tip: /permissions shows every allow/deny rule from every scope",
];

// Short "What's new" lines shown in the startup banner's right column. Keep
// these terse (they sit beside the mascot) and edit on each notable release.
export const WHATS_NEW: string[] = [
  "Plugins auto-load from .my-code/skills — no marketplace needed",
  "/usage shows today / week / all-time across sessions",
  "Worktree isolation for parallel edits via /worktree",
];

let lastTip = "";
export function pickTip(): string {
  if (TIPS.length === 0) return "";
  let t = lastTip;
  while (t === lastTip) {
    t = TIPS[Math.floor(Math.random() * TIPS.length)];
  }
  lastTip = t;
  return t;
}

// The TIPS strings carry a "Tip: " prefix for the (legacy) footer use; the
// banner renders its own "Tips for getting started" heading, so strip it.
export function stripTipPrefix(tip: string): string {
  return tip.replace(/^Tip:\s*/, "");
}
