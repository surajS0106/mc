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

  // Auto-scroll only when the user is already near the bottom, so scrolling up
  // to read older messages during a stream doesn't yank the view back down.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) endRef.current?.scrollIntoView({ block: "end" });
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="transcript empty">
        <div className="home">
          <Logo size={76} tile className="home-logo" />
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
          <div className="working">
            <span className="dot" /> <span className="dot" /> <span className="dot" />
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function Row({ it }: { it: Item }): React.ReactElement | null {
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
}

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
      <div className="thinking">
        <button className="thinking-head" onClick={() => setOpen((o) => !o)}>
          <span className="spark"><Icon name="sparkle" size={13} /></span>
          {label}
          <span className="chev"><Icon name={open ? "chevronUp" : "chevronDown"} size={13} /></span>
        </button>
        {open && <div className="thinking-body">{text}</div>}
      </div>
    </div>
  );
}
