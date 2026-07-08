import React, { useEffect, useRef, useState } from "react";
import { Markdown } from "../Markdown";
import { ToolCard } from "./ToolCard";
import { Logo } from "./Logo";
import { Icon } from "./Icon";
import type { Item } from "../transcript";
import type { Mode } from "../../../electron/ipc";

export interface TranscriptProps {
  items: Item[];
  mode: Mode;
  busy: boolean;
  mood: string;
  greeting: string;
}

export function Transcript({ items, mode, busy, mood }: TranscriptProps): React.ReactElement {
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const prevLen = useRef(0);

  // Auto-scroll only when the user is already near the bottom, so scrolling up
  // to read older messages during a stream doesn't yank the view back down.
  // Smooth-scroll only when a *new* item arrives; token deltas jump instantly so
  // rapid streaming never fights an in-flight smooth animation.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) {
      const isNewItem = items.length !== prevLen.current;
      endRef.current?.scrollIntoView({ block: "end", behavior: isNewItem ? "smooth" : "auto" });
    }
    prevLen.current = items.length;
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="transcript empty">
        <div className="home">
          <Logo size={76} tile className="home-logo" mood="idle" />
          <div className="home-title">
            {mode === "code" ? "What should my-code build?" : "How can I help?"}
          </div>
          <div className="home-sub">
            {mode === "code"
              ? "Full coding agent — reads, edits, runs commands in your project."
              : "Ask anything. Chat mode keeps to read-only tools."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="transcript" ref={scrollRef}>
      <div className="thread">
        {items.map((it) => (
          <Row key={it.id} it={it} />
        ))}
        {busy && mood === "thinking" && (
          <div className="status-line">
            <Logo size={22} mood="thinking" />
            <span className="status-shimmer">Thinking…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// Memoized so a streaming turn only re-renders the item that actually changed.
// App's reducers preserve object identity for untouched items, so shallow-equal
// props let every prior row skip re-render while the last one streams.
const Row = React.memo(function Row({ it }: { it: Item }): React.ReactElement | null {
  switch (it.kind) {
    case "user":
      return (
        <div className="row user">
          <div className="bubble user-bubble">{it.text}</div>
        </div>
      );
    case "assistant":
      return (
        <div className="row assistant">
          <div className="bubble assistant-bubble">
            <Markdown content={it.text} />
            {it.streaming && <span className="caret" />}
          </div>
        </div>
      );
    case "thinking":
      return <ThinkingBlock text={it.text} streaming={it.streaming} durationMs={it.durationMs} />;
    case "tool":
      return (
        <div className="row assistant">
          <ToolCard it={it} />
        </div>
      );
    case "notice":
      return <div className={`row notice ${it.tone}`}>{it.text}</div>;
    default:
      return null;
  }
});

function ThinkingBlock({
  text,
  streaming,
  durationMs,
}: {
  text: string;
  streaming: boolean;
  durationMs?: number;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const label = streaming
    ? "Thinking…"
    : durationMs
      ? `Thought for ${(durationMs / 1000).toFixed(0)}s`
      : "Thought";
  return (
    <div className="row assistant">
      <div className={`thinking ${open ? "open" : ""}`}>
        <button className={`thinking-head ${streaming ? "live" : ""}`} onClick={() => setOpen((o) => !o)}>
          <span className="spark"><Icon name="sparkle" size={13} /></span>
          <span className="lab">{label}</span>
          <span className="chev"><Icon name="chevronDown" size={13} /></span>
        </button>
        <div className="thinking-wrap"><div className="thinking-body">{text}</div></div>
      </div>
    </div>
  );
}
