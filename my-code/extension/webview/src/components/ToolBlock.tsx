import { useState } from "react";
import type { ToolMsg } from "../state.js";
import type { PermissionChoice } from "../../../../src/config/permissions.js";
import { DiffPreview } from "./DiffPreview.js";

const TOOL_ICON: Record<string, string> = {
  Read: "📖",
  Grep: "🔍",
  Glob: "🔎",
  WebFetch: "🌐",
  WebSearch: "🌐",
  Bash: "⚡",
  Edit: "✎",
  Write: "✎",
  TodoWrite: "✓",
  Sleep: "⏱",
  EnterPlanMode: "📋",
  ExitPlanMode: "📋",
  EnterWorktree: "🌿",
  ExitWorktree: "🌿",
  NotebookEdit: "📓",
};

export function ToolBlock({
  tool,
  onDiffDecision,
  onOpenDiff,
}: {
  tool: ToolMsg;
  onPermissionDecision: (toolUseId: string, choice: PermissionChoice) => void;
  onDiffDecision: (toolUseId: string, decision: "apply" | "reject") => void;
  onOpenDiff: (toolUseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const icon = TOOL_ICON[tool.name] ?? "🔧";
  const headline = formatHeadline(tool);
  const hasBody =
    !!tool.permissionRequest ||
    !!tool.diff ||
    !!tool.progress ||
    !!tool.result;

  return (
    <div className={`tool-line ${tool.status}`}>
      <button
        className="tool-line-row"
        type="button"
        onClick={() => hasBody && setOpen((o) => !o)}
        disabled={!hasBody}
        aria-expanded={open}
      >
        <span className="caret">{hasBody ? (open ? "▾" : "▸") : " "}</span>
        <span className="icon" aria-hidden="true">
          {icon}
        </span>
        <span className="name">{tool.name}</span>
        <span className="headline" title={headline}>
          {headline}
        </span>
        <ToolStatus tool={tool} />
        {tool.status === "running" && !tool.permissionRequest && !tool.diff && (
          <span className="progress-bar" />
        )}
      </button>
      {open && hasBody && (
        <div className="tool-line-body">
          {tool.permissionRequest && (
            <div className="tool-waiting">
              <span className="dot" />
              <span>Waiting for your approval — see bar below</span>
            </div>
          )}
          {tool.diff && (
            <DiffPreview
              diff={tool.diff}
              state={tool.diffState ?? "pending"}
              onView={() => onOpenDiff(tool.toolUseId)}
              onApply={() => onDiffDecision(tool.toolUseId, "apply")}
              onReject={() => onDiffDecision(tool.toolUseId, "reject")}
            />
          )}
          {tool.progress && <div className="progress">{tool.progress}</div>}
          {tool.result && !tool.diff && (
            <pre className="result">{trimResult(tool.result)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function ToolStatus({ tool }: { tool: ToolMsg }) {
  if (tool.status === "running") {
    if (tool.permissionRequest) {
      return <span className="status needs-approval">needs approval</span>;
    }
    if (tool.diffState === "pending") {
      return <span className="status review">review</span>;
    }
    return <span className="status running">running</span>;
  }
  if (tool.status === "error") return <span className="status err">✕</span>;
  if (tool.status === "denied") return <span className="status err">⊘</span>;
  if (tool.diffState === "applied") {
    return <span className="status ok">✓ applied</span>;
  }
  if (tool.diffState === "rejected") {
    return <span className="status err">✕ rejected</span>;
  }
  const count = countFromResult(tool);
  return (
    <span className="status ok">
      ✓{count !== undefined && <span className="count"> {count}</span>}
    </span>
  );
}

function countFromResult(tool: ToolMsg): number | undefined {
  const r = tool.result || "";
  if (!r) return undefined;
  if (tool.name === "Grep") return r.split("\n").filter(Boolean).length;
  if (tool.name === "Read") return r.split("\n").length;
  return undefined;
}

function formatHeadline(tool: ToolMsg): string {
  const a = tool.args as Record<string, unknown>;
  const first = (k: string) =>
    typeof a[k] === "string" ? (a[k] as string) : "";
  switch (tool.name) {
    case "Read":
      return first("file_path") || first("path") || "";
    case "Grep":
      return `"${first("pattern")}"${first("path") ? ` in ${first("path")}` : ""}`;
    case "Glob":
      return first("pattern");
    case "WebFetch":
    case "WebSearch":
      return first("url") || first("query");
    case "Bash":
      return first("command");
    case "Edit":
    case "Write":
      return first("file_path");
    default: {
      const keys = Object.keys(a);
      if (!keys.length) return "";
      return keys.join(", ");
    }
  }
}

function trimResult(s: string): string {
  const MAX = 4000;
  if (s.length <= MAX) return s;
  return s.slice(0, MAX) + `\n… (${s.length - MAX} more chars)`;
}
