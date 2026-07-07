import { useEffect, useState } from "react";
import type { ToolMsg } from "../state.js";
import { THINKING_VERBS } from "../verbs.js";

type DotState = "thinking" | "tool" | "ok" | "error";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function StatusPill({
  busy,
  activeTool,
  lastTool,
}: {
  busy: boolean;
  activeTool: ToolMsg | null;
  lastTool: ToolMsg | null;
}) {
  const [verb, setVerb] = useState<string>(() => pickVerb());
  const [frame, setFrame] = useState(0);
  const [flash, setFlash] = useState<{ state: DotState; until: number } | null>(
    null,
  );

  useEffect(() => {
    if (!busy || activeTool) return;
    const id = window.setInterval(() => setVerb(pickVerb()), 4500);
    return () => clearInterval(id);
  }, [busy, activeTool]);

  useEffect(() => {
    if (!busy || flash) return;
    const id = window.setInterval(
      () => setFrame((f) => (f + 1) % SPINNER_FRAMES.length),
      80,
    );
    return () => clearInterval(id);
  }, [busy, flash]);

  useEffect(() => {
    if (!lastTool) return;
    if (lastTool.status === "ok") {
      setFlash({ state: "ok", until: Date.now() + 240 });
      const t = window.setTimeout(() => setFlash(null), 260);
      return () => clearTimeout(t);
    }
    if (lastTool.status === "error" || lastTool.status === "denied") {
      setFlash({ state: "error", until: Date.now() + 1400 });
      const t = window.setTimeout(() => setFlash(null), 1400);
      return () => clearTimeout(t);
    }
  }, [lastTool?.toolUseId, lastTool?.status]);

  if (!busy && !flash) return null;

  let label: string;
  let dot: DotState;
  let glyph: string;
  if (flash) {
    dot = flash.state;
    label = flash.state === "ok" ? "Done" : "Tool failed";
    glyph = flash.state === "ok" ? "✓" : "✕";
  } else if (activeTool) {
    dot = "tool";
    label = describeTool(activeTool);
    glyph = SPINNER_FRAMES[frame]!;
  } else {
    dot = "thinking";
    label = `${verb}…`;
    glyph = SPINNER_FRAMES[frame]!;
  }

  return (
    <div className={`status-pill state-${dot}`} role="status" aria-live="polite">
      <span className="status-glyph">{glyph}</span>
      <span className="status-label" title={label}>
        {label}
      </span>
    </div>
  );
}

function describeTool(t: ToolMsg): string {
  const name = t.name;
  const a = t.args ?? {};
  const path = pickString(a, [
    "file_path",
    "filePath",
    "path",
    "file",
    "target_file",
    "notebook_path",
  ]);
  const cmd = pickString(a, ["command", "cmd"]);
  const pattern = pickString(a, ["pattern", "query", "regex"]);
  const url = pickString(a, ["url"]);

  switch (name) {
    case "Read":
      return path ? `Reading ${shortPath(path)}` : "Reading file";
    case "Edit":
    case "MultiEdit":
      return path ? `Editing ${shortPath(path)}` : "Editing file";
    case "Write":
      return path ? `Writing ${shortPath(path)}` : "Writing file";
    case "Bash":
      return cmd ? `Running · ${truncate(cmd, 48)}` : "Running shell";
    case "Grep":
      return pattern ? `Searching · ${truncate(pattern, 32)}` : "Searching";
    case "Glob":
      return pattern ? `Finding · ${truncate(pattern, 36)}` : "Finding files";
    case "WebFetch":
    case "WebSearch":
      return url ? `Fetching · ${hostOf(url)}` : "Fetching";
    case "TodoWrite":
      return "Updating todo list";
    case "NotebookEdit":
      return path ? `Editing ${shortPath(path)}` : "Editing notebook";
    default:
      return `Running · ${name}`;
  }
}

function pickString(
  args: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = args[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function shortPath(p: string): string {
  const parts = p.split(/[\\/]/);
  if (parts.length <= 3) return p;
  return ".../" + parts.slice(-2).join("/");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return truncate(url, 40);
  }
}

let lastVerb = "";
function pickVerb(): string {
  let v = lastVerb;
  let i = 0;
  while (v === lastVerb && i++ < 8) {
    v = THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)]!;
  }
  lastVerb = v;
  return v;
}
