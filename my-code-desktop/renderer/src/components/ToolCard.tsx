import React, { useState } from "react";
import { Icon } from "./Icon";
import type { Item } from "../transcript";
import type { DiffPayload } from "../../../electron/ipc";

type ToolItem = Extract<Item, { kind: "tool" }>;

/** One-line summary of a tool's target (path / pattern / command). */
function summarize(name: string, args: Record<string, unknown>): string {
  const a = args as Record<string, string>;
  return (
    a.file_path ?? a.path ?? a.pattern ?? a.command ?? a.query ?? a.url ?? a.prompt ?? ""
  ).toString();
}

export function ToolCard({ it }: { it: ToolItem }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const summary = summarize(it.name, it.args);
  const status = it.running ? "running" : it.isError ? "error" : "done";

  return (
    <div className={`tool-card ${status}`}>
      <button className="tool-head" onClick={() => setOpen((o) => !o)}>
        <span className="tool-glyph">
          <Icon name={it.running ? "spinner" : it.isError ? "close" : "dot"} size={it.running ? 13 : 11} className={it.running ? "icon-spin" : undefined} />
        </span>
        <span className="tool-name">{it.name}</span>
        {summary && <span className="tool-summary">{summary}</span>}
        <span className="chev"><Icon name={open ? "chevronUp" : "chevronDown"} size={14} /></span>
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

      {open && !it.diff && it.result && (
        <pre className="tool-result">{it.result.slice(0, 4000)}</pre>
      )}
    </div>
  );
}

function DiffView({ diff }: { diff: DiffPayload }): React.ReactElement {
  const before = diff.before.split("\n");
  const after = diff.after.split("\n");
  return (
    <div className="diff">
      <div className="diff-file">{diff.filePath}</div>
      <pre className="diff-body">
        {before.map((l, i) => (
          <div key={`b${i}`} className="diff-line del">
            <span className="ln">{diff.startLine + i}</span>- {l}
          </div>
        ))}
        {after.map((l, i) => (
          <div key={`a${i}`} className="diff-line add">
            <span className="ln">{diff.startLine + i}</span>+ {l}
          </div>
        ))}
      </pre>
    </div>
  );
}
