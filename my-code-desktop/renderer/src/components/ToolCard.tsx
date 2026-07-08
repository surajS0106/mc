import React, { useState } from "react";
import { Icon, type IconName } from "./Icon";
import type { Item } from "../transcript";
import type { DiffPayload } from "../../../electron/ipc";

type ToolItem = Extract<Item, { kind: "tool" }>;

/** Map a tool name to a colored icon tile + whether its output is shell-like. */
function toolVisual(name: string): { icon: IconName; cls: string } {
  const n = name.toLowerCase();
  if (/(bash|shell|powershell|pwsh|exec|command|run)/.test(n)) return { icon: "terminal", cls: "t-bash" };
  if (/(read|view|cat|open)/.test(n)) return { icon: "eye", cls: "t-read" };
  if (/(edit|write|multiedit|create|apply|patch)/.test(n)) return { icon: "edit", cls: "t-edit" };
  if (/(grep|glob|search|find|ripgrep)/.test(n)) return { icon: "search", cls: "t-search" };
  if (/(web|fetch|http|url|browse)/.test(n)) return { icon: "globe", cls: "t-web" };
  if (/^task/.test(n)) return { icon: "check", cls: "t-task" };
  if (/(skill|mcp)/.test(n)) return { icon: "puzzle", cls: "t-mcp" };
  return { icon: "dot", cls: "t-default" };
}
function isShellTool(name: string): boolean {
  return /(bash|shell|powershell|pwsh|exec|command)/i.test(name);
}

/** One-line summary of a tool's target (path / pattern / command). */
function summarize(name: string, args: Record<string, unknown>): string {
  const a = args as Record<string, string>;
  return (
    a.file_path ?? a.path ?? a.pattern ?? a.command ?? a.query ?? a.url ?? a.prompt ?? ""
  ).toString();
}

export const ToolCard = React.memo(ToolCardImpl);

function ToolCardImpl({ it }: { it: ToolItem }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const summary = summarize(it.name, it.args);
  const status = it.running ? "running" : it.isError ? "error" : "done";
  const hasResult = !it.diff && !!it.result;
  const visual = toolVisual(it.name);

  return (
    <div className={`tool-card ${status} ${open ? "open" : ""}`}>
      <button className={`tool-head ${hasResult ? "" : "static"}`} onClick={hasResult ? () => setOpen((o) => !o) : undefined}>
        <span className={`tool-tile ${visual.cls} ${it.isError ? "err" : ""}`}>
          {it.running ? (
            <Icon name="spinner" size={13} className="icon-spin" />
          ) : it.isError ? (
            <Icon name="close" size={12} />
          ) : (
            <Icon name={visual.icon} size={13} />
          )}
        </span>
        <span className="tool-name">{it.name}</span>
        {summary && <span className="tool-summary">{summary}</span>}
        {hasResult && <span className="chev"><Icon name="chevronDown" size={14} /></span>}
      </button>

      {it.diff && <DiffView diff={it.diff} />}

      {it.children && it.children.length > 0 && (
        <div className="subagent">
          {it.children.map((c, i) => (
            <div key={i} className={`sub-tool ${c.isError ? "error" : ""}`}>
              <span className="tool-glyph"><Icon name={c.isError ? "close" : "dot"} size={10} /></span>
              <span className="tool-name">{c.name}</span>
              <span className="tool-summary">{summarize(c.name, c.args)}</span>
            </div>
          ))}
        </div>
      )}

      {hasResult && (
        <div className="tool-wrap">
          <div className="tool-inner">
            <pre className={`tool-result ${isShellTool(it.name) ? "term" : ""}`}>{it.result!.slice(0, 4000)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function DiffView({ diff }: { diff: DiffPayload }): React.ReactElement {
  const before = diff.before.split("\n");
  const after = diff.after.split("\n");
  // Stagger the reveal, but cap the delay so a large diff doesn't crawl in.
  const delay = (n: number): React.CSSProperties => ({ animationDelay: `${Math.min(n, 24) * 0.018}s` });
  return (
    <div className="diff">
      <div className="diff-file">{diff.filePath}</div>
      <pre className="diff-body">
        {before.map((l, i) => (
          <div key={`b${i}`} className="diff-line del" style={delay(i)}>
            <span className="ln">{diff.startLine + i}</span>- {l}
          </div>
        ))}
        {after.map((l, i) => (
          <div key={`a${i}`} className="diff-line add" style={delay(before.length + i)}>
            <span className="ln">{diff.startLine + i}</span>+ {l}
          </div>
        ))}
      </pre>
    </div>
  );
}
