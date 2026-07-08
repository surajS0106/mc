import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  run: () => void;
}

/** Ctrl/⌘+K quick switcher: fuzzy-ish filter over app actions + recent chats. */
export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}): React.ReactElement | null {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  if (!open) return null;

  const hits = commands.filter((c) => c.label.toLowerCase().includes(q.trim().toLowerCase()));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); hits[sel]?.run(); onClose(); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="cmdk-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk">
        <div className="cmdk-input">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={q}
            placeholder="Type a command or search chats…"
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={onKey}
          />
        </div>
        <div className="cmdk-list">
          {hits.length === 0 && <div className="cmdk-empty">No matches</div>}
          {hits.map((c, i) => (
            <button
              key={c.id}
              className={`cmdk-item ${i === sel ? "sel" : ""}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => { c.run(); onClose(); }}
            >
              <span className="cmdk-label">{c.label}</span>
              {c.hint && <span className="cmdk-kbd">{c.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
