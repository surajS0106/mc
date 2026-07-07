import React from "react";
import { Box, Text, useStdout } from "ink";
import type { ChatProvider } from "../agent/provider.js";
import { theme } from "./theme.js";
import { supportsUnicode } from "./terminal.js";
import { GIT_BRANCH, HORIZONTAL_LINE, BULLET, TEARDROP_ASTERISK } from "./figures.js";
import { pickTip, stripTipPrefix, WHATS_NEW } from "./tips.js";

interface Props {
  model: string;
  cwd: string;
  provider: ChatProvider;
  bypassAll?: boolean;
  modelOrigin?: string;
  branch?: string;
  version: string;
}

// A small fox face — my-code ≈ *renard*. Unicode variant on capable terminals,
// plain ASCII otherwise. All glyphs are width-1 so fixed-width column layout
// stays aligned.
const FOX = supportsUnicode
  ? ["/\\   /\\", "( •.• )", " >   < "]
  : ["/\\_/\\", "( o.o )", " > ^ < "];

// Static identity panel. Only data known synchronously at first paint may be
// used here — the banner is rendered once into Ink's <Static> scrollback, so
// anything async (e.g. the active account) would render blank/stale. Live
// session state (model, provider, account, context) lives in the status bar.

function shortPath(p: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  let s = p;
  if (home && p.startsWith(home)) s = "~" + p.slice(home.length);
  s = s.replace(/\\/g, "/");
  const parts = s.split("/");
  if (parts.length > 4) {
    return [parts[0], "…", ...parts.slice(-2)].join("/");
  }
  return s;
}

// Prettify a raw model id for display: "claude-opus-4-8[1m]" → "Opus 4.8 (1M)".
// Falls back to the cleaned id (same normalization the status bar uses).
function friendlyModel(model: string): string {
  const m = model.replace(/:.*$/, "").replace(/-cloud$/, "");
  const claude = m.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d+)(?:-\d+)?(\[1m\])?$/i);
  if (claude) {
    const tier = claude[1][0].toUpperCase() + claude[1].slice(1);
    const ctx = claude[4] ? " (1M)" : "";
    return `${tier} ${claude[2]}.${claude[3]}${ctx}`;
  }
  return m;
}

// Truncate to n columns with an ellipsis (… is width-1). Guards every cell so
// content can never overflow its fixed-width column and break the border.
function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  if (n <= 1) return s.slice(0, Math.max(n, 0));
  return s.slice(0, n - 1) + "…";
}

export function Banner({ model, cwd, provider, branch, version }: Props) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const tip = stripTipPrefix(pickTip());
  const path = shortPath(cwd);
  const providerName = provider.info.name;
  const modelLabel = friendlyModel(model);

  // Fall back to a single-column box on narrow terminals, and to a plain text
  // mark when unicode box-drawing isn't reliable.
  const compact = !supportsUnicode || cols < 64;
  if (compact) {
    const meta = clip(`${modelLabel} · ${providerName}`, cols - 4);
    const loc = clip(`${path}${branch ? `  ${GIT_BRANCH} ${branch}` : ""}`, cols - 4);
    return (
      <Box flexDirection="column" marginY={1}>
        <Text bold color={theme.accent}>
          {TEARDROP_ASTERISK} my-code{version ? ` v${version}` : ""}
        </Text>
        <Text bold color={theme.text}>Welcome back!</Text>
        <Text color={theme.muted} dimColor>{meta}</Text>
        <Text color={theme.muted} dimColor>{loc}</Text>
        {tip ? <Text color={theme.suggestion}>{TEARDROP_ASTERISK} {clip(tip, cols - 4)}</Text> : null}
      </Box>
    );
  }

  // --- Full two-column box ----------------------------------------------------
  const W = Math.min(Math.max(cols - 1, 60), 80); // total box width (incl. border)
  const interior = W - 2;   // columns between the corner glyphs
  const contentW = W - 4;   // columns between "│ " and " │"
  const LEFT_W = 26;
  const RIGHT_W = contentW - LEFT_W;

  // Top border carries the version as a title; bottom is a plain rule.
  const title = ` my-code v${version} `;
  const head = HORIZONTAL_LINE + title;
  const topBorder =
    "╭" + head + HORIZONTAL_LINE.repeat(Math.max(interior - head.length, 0)) + "╮";
  const bottomBorder = "╰" + HORIZONTAL_LINE.repeat(interior) + "╯";

  // Left column: mascot, then session identity.
  const metaModel = clip(modelLabel, LEFT_W);
  const metaRest = clip(` · ${providerName}`, Math.max(LEFT_W - metaModel.length, 0));
  const leftCells: React.ReactNode[] = [
    ...FOX.map((line, i) => (
      <Text key={`fox${i}`} color={theme.accent}>{line}</Text>
    )),
    <Text key="welcome" bold color={theme.text}>Welcome back!</Text>,
    <React.Fragment key="model">
      <Text color={theme.text}>{metaModel}</Text>
      <Text color={theme.muted} dimColor>{metaRest}</Text>
    </React.Fragment>,
    <Text key="cwd" color={theme.muted} dimColor>
      {clip(`${path}${branch ? `  ${GIT_BRANCH} ${branch}` : ""}`, LEFT_W)}
    </Text>,
  ];

  // Right column: a tip, then what's new.
  const news = WHATS_NEW.slice(0, 2);
  const rightCells: React.ReactNode[] = [
    <Text key="tips-h" bold color={theme.heading}>Tips for getting started</Text>,
    <Text key="tip" color={theme.text}>{clip(tip, RIGHT_W)}</Text>,
    <Text key="rule" color={theme.divider}>{HORIZONTAL_LINE.repeat(RIGHT_W)}</Text>,
    <Text key="new-h" bold color={theme.heading}>What's new</Text>,
    ...news.map((item, i) => (
      <Text key={`new${i}`} color={theme.muted}>{clip(`${BULLET} ${item}`, RIGHT_W)}</Text>
    )),
  ];

  const rowCount = Math.max(leftCells.length, rightCells.length);
  const rows: React.ReactNode[] = [];
  // A blank leading row for breathing room (matches the Claude Code panel).
  for (let i = -1; i < rowCount; i++) {
    rows.push(
      <Box key={`row${i}`}>
        <Text color={theme.border}>│ </Text>
        <Box width={LEFT_W}>{i >= 0 ? leftCells[i] ?? <Text> </Text> : <Text> </Text>}</Box>
        <Box width={RIGHT_W}>{i >= 0 ? rightCells[i] ?? <Text> </Text> : <Text> </Text>}</Box>
        <Text color={theme.border}> │</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Text color={theme.border}>{topBorder}</Text>
      {rows}
      <Text color={theme.border}>{bottomBorder}</Text>
    </Box>
  );
}
