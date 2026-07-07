import { useEffect, useRef, useState } from "react";
import type { ChatMsg } from "../state.js";

const VISIBLE_WINDOW = 200;
import type { PermissionChoice } from "../../../../src/config/permissions.js";
import { MarkdownView } from "./MarkdownView.js";
import { ToolBlock } from "./ToolBlock.js";
import { SelectionChip } from "./SelectionChip.js";
import { BrandMark } from "./Icons.js";

export function MessageList({
  messages,
  empty,
  footer,
  onPermissionDecision,
  onDiffDecision,
  onOpenDiff,
}: {
  messages: ChatMsg[];
  empty?: React.ReactNode;
  footer?: React.ReactNode;
  onPermissionDecision: (toolUseId: string, choice: PermissionChoice) => void;
  onDiffDecision: (toolUseId: string, decision: "apply" | "reject") => void;
  onOpenDiff: (toolUseId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [showAll, setShowAll] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const total = messages.length;
  const sliceStart = showAll ? 0 : Math.max(0, total - VISIBLE_WINDOW);
  const visible = messages.slice(sliceStart);
  const hidden = sliceStart;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, footer]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    stickRef.current = distanceFromBottom < 24;
    setShowFab(distanceFromBottom > 120);
  }

  function scrollToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  return (
    <div className="messages" ref={scrollRef} onScroll={onScroll}>
      {total === 0 ? (
        empty
      ) : (
        <>
          {hidden > 0 && (
            <button
              type="button"
              className="load-earlier"
              onClick={() => setShowAll(true)}
            >
              Load {hidden} earlier message{hidden === 1 ? "" : "s"}
            </button>
          )}
          {visible.map((m) => (
            <MessageRow
              key={m.id}
              msg={m}
              onPermissionDecision={onPermissionDecision}
              onDiffDecision={onDiffDecision}
              onOpenDiff={onOpenDiff}
            />
          ))}
          {footer}
        </>
      )}
      {showFab && (
        <button
          type="button"
          className="scroll-fab"
          onClick={scrollToBottom}
        >
          ↓ New messages
        </button>
      )}
    </div>
  );
}

function MessageRow({
  msg,
  onPermissionDecision,
  onDiffDecision,
  onOpenDiff,
}: {
  msg: ChatMsg;
  onPermissionDecision: (toolUseId: string, choice: PermissionChoice) => void;
  onDiffDecision: (toolUseId: string, decision: "apply" | "reject") => void;
  onOpenDiff: (toolUseId: string) => void;
}) {
  if (msg.kind === "user") {
    return (
      <div className="msg-row">
        <div className="msg-avatar user-av" aria-hidden="true">U</div>
        <div className="msg user">
          {msg.attachedSelection && (
            <SelectionChip selection={msg.attachedSelection} compact />
          )}
          <div className="body">{msg.text}</div>
        </div>
      </div>
    );
  }
  if (msg.kind === "assistant") {
    return (
      <div className="msg-row">
        <div className="msg-avatar ai-av" aria-hidden="true">
          <BrandMark />
        </div>
        <div className="msg assistant">
          <div className="body">
            <MarkdownView text={msg.text} streaming={!msg.done} />
          </div>
        </div>
      </div>
    );
  }
  if (msg.kind === "tool") {
    return (
      <div className="msg tool-row">
        <ToolBlock
          tool={msg}
          onPermissionDecision={onPermissionDecision}
          onDiffDecision={onDiffDecision}
          onOpenDiff={onOpenDiff}
        />
      </div>
    );
  }
  return (
    <div className={`msg notice ${msg.tone}`}>
      <div className="body">{msg.text}</div>
    </div>
  );
}
