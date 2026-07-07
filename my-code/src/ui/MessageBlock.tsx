import React from "react";
import { Box, Text, useStdout } from "ink";
import Spinner from "ink-spinner";
import type { TranscriptItem } from "./types.js";
import { toolBodyLines } from "./ToolPreview.js";
import { Panel, type PanelLine, type PanelSeg } from "./Panel.js";
import { theme } from "./theme.js";
import { Markdown } from "./Markdown.js";
import { BLACK_CIRCLE, ARROW_RIGHT, TREE_BRANCH, TREE_CORNER } from "./figures.js";
import { ReasoningBlock } from "./ReasoningBlock.js";

const TOOL_COLORS: Record<string, string> = {
  Read: theme.toolFile,
  Write: theme.toolEdit,
  Edit: theme.toolEdit,
  Bash: theme.toolShell,
  Glob: theme.toolSearch,
  Grep: theme.toolSearch,
  TodoWrite: theme.toolTask,
  WebFetch: theme.toolWeb,
  WebSearch: theme.toolWeb,
  NotebookEdit: theme.toolNotebook,
  EnterPlanMode: theme.toolPlan,
  ExitPlanMode: theme.toolPlan,
  EnterWorktree: theme.toolWorktree,
  ExitWorktree: theme.toolWorktree,
  Sleep: theme.muted,
};

function colorFor(toolName: string): string {
  if (TOOL_COLORS[toolName]) return TOOL_COLORS[toolName];
  // MCP tools all get the same neutral hue
  if (toolName.startsWith("mcp__")) return "blueBright";
  return theme.toolGeneric;
}

function summarizeArgs(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "Read":
    case "Write":
    case "Edit": {
      const p = String(args.file_path ?? "");
      const parts = p.replace(/\\/g, "/").split("/");
      return parts.slice(-2).join("/");
    }
    case "Bash": {
      const cmd = String(args.command ?? "");
      return cmd.length > 60 ? cmd.slice(0, 57) + "…" : cmd;
    }
    case "Grep":
      return `"${args.pattern ?? ""}"${args.path ? ` in ${args.path}` : ""}`;
    case "Glob":
      return String(args.pattern ?? "");
    case "TodoWrite":
      return "";
    case "Agent":
    case "Task": {
      const t = String(args.task ?? "").replace(/\s+/g, " ").trim();
      if (!t) return "";
      return `"${t.length > 60 ? t.slice(0, 57) + "…" : t}"`;
    }
    case "WebFetch":
    case "WebSearch":
      return String(args.url ?? args.query ?? "");
    case "NotebookEdit":
      return `${args.mode} ${args.cell_id ?? "(end)"}`;
    case "EnterPlanMode":
    case "ExitPlanMode":
      return "";
    case "EnterWorktree":
      return String(args.branch ?? "");
    case "ExitWorktree":
      return String(args.path ?? "");
    case "Sleep":
      return `${args.ms}ms`;
    default:
      try {
        const j = JSON.stringify(args);
        return j.length > 80 ? j.slice(0, 77) + "…" : j;
      } catch {
        return "";
      }
  }
}

interface Props {
  item: TranscriptItem;
  streaming?: boolean;
  expanded?: boolean;
}

export function MessageBlock({ item, streaming, expanded }: Props) {
  const { stdout } = useStdout();

  // User message — Claude-style: amber `>` prefix, content in bold.
  if (item.kind === "user") {
    return (
      <Box marginY={1} paddingX={1}>
        <Text color={theme.accent} bold>{"> "}</Text>
        <Text bold color={theme.text}>{item.content}</Text>
      </Box>
    );
  }

  // Reasoning — collapsed dim line by default, full text when expanded.
  if (item.kind === "reasoning") {
    return (
      <ReasoningBlock
        content={item.content}
        durationMs={item.durationMs}
        expanded={item.expanded ?? expanded}
      />
    );
  }

  // Assistant message — dot prefix in left gutter, content flows in column.
  if (item.kind === "assistant") {
    if (!item.content.trim()) return null;
    return (
      <Box marginBottom={1} flexDirection="row">
        <Box width={2} flexShrink={0}>
          <Text color={theme.text}>{BLACK_CIRCLE}</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <Markdown content={item.content} />
          {streaming && <Text inverse> </Text>}
        </Box>
      </Box>
    );
  }

  // System / notice messages
  if (item.kind === "system") {
    if (item.tone === "error") {
      return (
        <Box marginBottom={1}>
          <Text color={theme.danger}>✗ </Text>
          <Text color={theme.danger}>{item.content}</Text>
        </Box>
      );
    }
    if (item.tone === "warn") {
      return (
        <Box marginBottom={1}>
          <Text color={theme.warning}>⚠ </Text>
          <Text color={theme.warning}>{item.content}</Text>
        </Box>
      );
    }
    const isAutoAllow = item.content.startsWith("✔");
    return (
      <Box marginBottom={1}>
        <Text color={isAutoAllow ? theme.success : theme.muted} dimColor={!isAutoAllow}>
          {item.content}
        </Text>
      </Box>
    );
  }

  // Tool call block — flat OpenCode-style line: `▸ Name summary`, wrapped (with
  // its output) in a single full-width light-background block.
  const color = colorFor(item.name);
  const summary = summarizeArgs(item.name, item.args);
  const isRunning = item.result === undefined;
  const markerColor = item.isError ? theme.danger : color;
  const children = item.children;

  // Running tools stay outside the block (the spinner is animated, not a line).
  if (isRunning) {
    return (
      <Box marginBottom={1} marginLeft={1}>
        <Box width={2} flexShrink={0}>
          <Text color={markerColor}>
            <Spinner type="dots" />
          </Text>
        </Box>
        <Text color={markerColor} bold>{item.name}</Text>
        {summary ? (
          <Text color={theme.muted}>{" "}<Text color={color}>{summary}</Text></Text>
        ) : null}
      </Box>
    );
  }

  const cols = stdout?.columns ?? 80;
  const innerWidth = Math.max(20, cols - 2);

  const headerSegs: PanelSeg[] = [
    { text: `${ARROW_RIGHT} `, color: markerColor, bold: true },
    { text: item.name, color: markerColor, bold: true },
  ];
  if (summary) headerSegs.push({ text: ` ${summary}`, color });
  const headerLine: PanelLine = { segments: headerSegs };

  // Subagent children render as a ├ │ └ tree under the Agent header.
  const childLines: PanelLine[] = (children ?? []).map((child, i) => {
    const last = i === (children?.length ?? 0) - 1;
    const cColor = child.isError ? theme.danger : colorFor(child.name);
    const cSummary = summarizeArgs(child.name, child.args);
    const segs: PanelSeg[] = [
      { text: `${last ? TREE_CORNER : TREE_BRANCH} `, color: theme.muted },
      { text: child.name, color: cColor, bold: true },
    ];
    if (cSummary) segs.push({ text: ` ${cSummary}`, color: cColor });
    if (child.isError) segs.push({ text: "  ✗", color: theme.danger });
    return { segments: segs };
  });

  const body = toolBodyLines({
    toolName: item.name,
    args: item.args,
    result: item.result,
    isError: item.isError,
    expanded: item.expanded ?? expanded,
    diff: item.diff,
    cols: innerWidth,
  });

  const allLines = [headerLine, ...childLines, ...body];
  const hasBody = body.length > 0 || childLines.length > 0;

  return (
    <Box flexDirection="column" marginLeft={1} marginBottom={hasBody ? 1 : 0}>
      <Panel lines={allLines} indent={2} pad={hasBody} />
    </Box>
  );
}
