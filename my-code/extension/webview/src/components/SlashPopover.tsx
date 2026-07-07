import { useEffect, useRef } from "react";

export interface SlashItem {
  name: string;
  desc: string;
}

const COMMANDS: SlashItem[] = [
  { name: "init", desc: "Scan project and create IG.md" },
  { name: "plan", desc: "Toggle plan mode (read-only)" },
  { name: "compact", desc: "Summarize conversation to free context" },
  { name: "clear", desc: "Reset conversation" },
  { name: "cost", desc: "Show token usage and cost" },
  { name: "model", desc: "Switch model" },
  { name: "models", desc: "List installed models" },
  { name: "tools", desc: "List registered tools" },
  { name: "todos", desc: "Show current task list" },
  { name: "sessions", desc: "List recent sessions" },
  { name: "resume", desc: "Resume a previous session" },
  { name: "config", desc: "Get or set global config" },
  { name: "allow", desc: "Add an allow rule" },
  { name: "deny", desc: "Add a deny rule" },
  { name: "bypass", desc: "Toggle session bypass" },
  { name: "permissions", desc: "Show permission rules" },
  { name: "mcp", desc: "List MCP servers and tools" },
  { name: "worktree", desc: "Show worktree state" },
  { name: "help", desc: "Show all commands" },
];

export function SlashPopover({
  query,
  selectedIndex,
  onPick,
  onHover,
}: {
  query: string;
  selectedIndex: number;
  onPick: (cmd: string) => void;
  onHover: (i: number) => void;
}) {
  const items = filter(query);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-i="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!items.length) return null;

  return (
    <div className="slash-popover" ref={containerRef}>
      {items.map((it, i) => (
        <button
          key={it.name}
          data-i={i}
          type="button"
          className={i === selectedIndex ? "sel" : ""}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(it.name)}
        >
          <span className="cmd">/{it.name}</span>
          <span className="desc">{it.desc}</span>
        </button>
      ))}
    </div>
  );
}

export function filterCommands(query: string): SlashItem[] {
  return filter(query);
}

function filter(query: string): SlashItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return COMMANDS;
  const starts = COMMANDS.filter((c) => c.name.toLowerCase().startsWith(q));
  if (starts.length) return starts;
  return COMMANDS.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q),
  );
}
