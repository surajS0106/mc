import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { AttachedSelection } from "../../../src/chat/protocol.js";
import type { EditMode } from "../../../../src/config/permissions.js";
import { SelectionChip } from "./SelectionChip.js";
import { SlashPopover, filterCommands } from "./SlashPopover.js";
import { MentionPopover, type MentionItem } from "./MentionPopover.js";
import { ModelPicker } from "./ModelPicker.js";
import { onHostMessage, postToHost } from "../vscode.js";
import {
  ChevronUpIcon,
  PaperclipIcon,
  SendIcon,
  StopIcon,
} from "./Icons.js";

export function Composer({
  busy,
  attachedSelection,
  prefill,
  model,
  planMode,
  permissionMode,
  onSubmit,
  onSlash,
  onCancel,
  onDetachSelection,
  onTogglePlan,
  onCyclePermMode,
  onSetModel,
}: {
  busy: boolean;
  attachedSelection: AttachedSelection | null;
  prefill: { text: string; tag: number } | null;
  model: string;
  planMode: boolean;
  permissionMode: EditMode;
  onSubmit: (text: string) => void;
  onSlash: (cmd: string, args: string[]) => void;
  onCancel: () => void;
  onDetachSelection: () => void;
  onTogglePlan: () => void;
  onCyclePermMode: () => void;
  onSetModel: (model: string) => void;
}) {
  const [text, setText] = useState("");
  const [slashSel, setSlashSel] = useState(0);
  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [mentionSel, setMentionSel] = useState(0);
  const [modelOpen, setModelOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const reqIdRef = useRef(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const slashOpen =
    text.startsWith("/") && !text.includes("\n") && text.indexOf(" ") === -1;
  const slashQuery = slashOpen ? text.slice(1) : "";

  const mentionMatch = !slashOpen ? /(?:^|\s)@([\w./-]*)$/.exec(text) : null;
  const mentionOpen = !!mentionMatch;
  const mentionQuery = mentionMatch?.[1] ?? "";

  useEffect(() => {
    const off = onHostMessage((msg) => {
      if (msg.type === "files_found" && msg.reqId === reqIdRef.current) {
        setMentions(msg.files);
        setMentionSel(0);
      }
      if (msg.type === "models_list") {
        setModels(msg.models);
      }
    });
    return off;
  }, []);

  useEffect(() => {
    if (!mentionOpen) {
      setMentions([]);
      return;
    }
    const reqId = ++reqIdRef.current;
    const t = window.setTimeout(() => {
      postToHost({ type: "find_files", query: mentionQuery, reqId });
    }, 60);
    return () => window.clearTimeout(t);
  }, [mentionOpen, mentionQuery]);

  useEffect(() => {
    if (!slashOpen) setSlashSel(0);
  }, [slashOpen]);

  useEffect(() => {
    if (!prefill) return;
    setText(prefill.text);
    queueMicrotask(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 240) + "px";
      ta.setSelectionRange(prefill.text.length, prefill.text.length);
    });
  }, [prefill]);

  function send() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (trimmed.startsWith("/")) {
      const parts = trimmed.slice(1).split(/\s+/);
      const cmd = parts[0]!;
      onSlash(cmd, parts.slice(1));
      reset();
      return;
    }
    onSubmit(trimmed);
    reset();
  }

  function reset() {
    setText("");
    if (taRef.current) taRef.current.style.height = "";
  }

  function pickSlash(name: string) {
    onSlash(name, []);
    reset();
    taRef.current?.focus();
  }

  function pickMention(relPath: string) {
    if (!mentionMatch) return;
    const matched = mentionMatch[0];
    const before = text.slice(0, mentionMatch.index);
    const sep = matched.startsWith(" ") ? " " : "";
    const next = `${before}${sep}@${relPath} `;
    setText(next);
    setMentions([]);
    queueMicrotask(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(next.length, next.length);
    });
  }

  function openModelPicker() {
    setModelOpen((v) => {
      const next = !v;
      if (next) postToHost({ type: "list_models" });
      return next;
    });
  }

  function pickModel(m: string) {
    onSetModel(m);
    setModelOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (slashOpen) {
      const items = filterCommands(slashQuery);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashSel((i) => Math.min(items.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashSel((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const it = items[slashSel];
        if (it) setText("/" + it.name);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const it = items[slashSel];
        if (it) pickSlash(it.name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setText("");
        return;
      }
    }
    if (mentionOpen && mentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionSel((i) => Math.min(mentions.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionSel((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const it = mentions[mentionSel];
        if (it) pickMention(it.relPath);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentions([]);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 240) + "px";
  }

  const canSend = !busy && text.trim().length > 0;

  return (
    <div className="composer">
      {slashOpen && (
        <SlashPopover
          query={slashQuery}
          selectedIndex={slashSel}
          onPick={pickSlash}
          onHover={setSlashSel}
        />
      )}
      {mentionOpen && mentions.length > 0 && (
        <MentionPopover
          items={mentions}
          selectedIndex={mentionSel}
          onPick={pickMention}
          onHover={setMentionSel}
        />
      )}
      {attachedSelection && (
        <div className="composer-attachments">
          <SelectionChip
            selection={attachedSelection}
            onDetach={onDetachSelection}
          />
        </div>
      )}
      <textarea
        ref={taRef}
        placeholder="Ask anything, @ to mention, / for commands"
        value={text}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      <div className="composer-footer">
        <button
          type="button"
          className="icon-btn"
          title="Attach"
          onClick={() => taRef.current?.focus()}
        >
          <PaperclipIcon />
        </button>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="footer-pill"
            onClick={openModelPicker}
            title="Pick model"
          >
            <span>{model || "(no model)"}</span>
            <ChevronUpIcon className="chev" />
          </button>
          {modelOpen && (
            <ModelPicker
              models={models}
              current={model}
              onPick={pickModel}
              onClose={() => setModelOpen(false)}
            />
          )}
        </div>
        <button
          type="button"
          className={`footer-pill ${planMode ? "on" : ""}`}
          onClick={onTogglePlan}
          title="Plan mode blocks writes/edits/bash"
        >
          🧠 Plan
        </button>
        <button
          type="button"
          className={`footer-pill mode-${permissionMode}`}
          onClick={onCyclePermMode}
          title="Cycle permission mode (ask / auto-accept / bypass)"
        >
          {iconForMode(permissionMode)} {labelForMode(permissionMode)}
        </button>
        <span className="spacer" />
        {busy ? (
          <button
            type="button"
            className="send-btn stop"
            onClick={onCancel}
            title="Stop"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            type="button"
            className="send-btn"
            onClick={send}
            disabled={!canSend}
            title="Send (Enter)"
          >
            <SendIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function labelForMode(m: EditMode): string {
  switch (m) {
    case "normal":
      return "Ask";
    case "accept-edits":
      return "Auto-accept";
    case "bypass":
      return "Bypass";
  }
}

function iconForMode(m: EditMode): string {
  switch (m) {
    case "normal":
      return "🛡️";
    case "accept-edits":
      return "⚡";
    case "bypass":
      return "🔓";
  }
}
