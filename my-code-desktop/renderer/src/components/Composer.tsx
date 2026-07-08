import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import type { Mode } from "../../../electron/ipc";

export interface ComposerProps {
  mode: Mode;
  model: string;
  busy: boolean;
  tokens: { prompt?: number; completion?: number };
  contextLength?: number;
  variant?: "hero" | "docked";
  /** When this changes to a non-empty value, prefill the input (starter chips). */
  seed?: string;
  onSubmit: (text: string) => void;
  onAbort: () => void;
}

export function Composer({
  mode,
  model,
  busy,
  tokens,
  contextLength,
  variant = "docked",
  seed,
  onSubmit,
  onAbort,
}: ComposerProps): React.ReactElement {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Prefill + focus when a starter chip seeds the input.
  useEffect(() => {
    if (seed) {
      setText(seed);
      const el = ref.current;
      if (el) {
        el.focus();
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 220) + "px";
      }
    }
  }, [seed]);

  const send = () => {
    if (!text.trim() || busy) return;
    onSubmit(text);
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  };

  const used = tokens.prompt ?? 0;
  const pct = contextLength ? Math.min(100, Math.round((used / contextLength) * 100)) : null;
  const level = pct === null ? "ok" : pct >= 90 ? "crit" : pct >= 70 ? "warn" : "ok";

  return (
    <div className={`composer-wrap composer-${variant}`}>
      <div className="composer">
        <textarea
          ref={ref}
          className="composer-input"
          placeholder="How can I help you today?"
          value={text}
          rows={1}
          autoFocus={variant === "hero"}
          onChange={(e) => {
            setText(e.target.value);
            grow(e.target);
          }}
          onKeyDown={onKey}
        />
        <div className="composer-bar">
          <div className="composer-left">
            <button className="icon-chip" title="Attach (coming soon)" disabled>
              <Icon name="plus" size={18} />
            </button>
          </div>
          <div className="composer-right">
            <ModelPicker current={model} />
            {/* One persistent button so the arrow can morph into the stop square. */}
            <button
              className={`send ${busy ? "stop" : ""}`}
              onClick={busy ? onAbort : send}
              title={busy ? "Stop" : "Send"}
              disabled={!busy && !text.trim()}
              aria-label={busy ? "Stop" : "Send"}
            >
              <span className="ic ic-arrow"><Icon name="send" size={17} /></span>
              <span className="ic ic-square"><Icon name="stop" size={14} /></span>
            </button>
          </div>
        </div>
      </div>
      {pct !== null && variant === "docked" && (
        <div className="context-meter">
          <div className="meter-track">
            <div className={`meter-fill ${level}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="meter-label">{pct}% context · {used.toLocaleString()} tokens</span>
        </div>
      )}
    </div>
  );
}

/** Human label for a provider id. */
function providerLabel(p: string): string {
  switch (p) {
    case "azure-foundry": return "Azure Foundry";
    case "ollama": return "Ollama";
    case "openai": return "OpenAI";
    case "gemini": return "Gemini";
    default: return p || "Provider";
  }
}

/** Model pill that opens a dropdown of installed models and switches live. */
function ModelPicker({ current }: { current: string }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [selected, setSelected] = useState(current);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setSelected(current), [current]);

  useEffect(() => {
    if (!open) return;
    void window.mycode
      .getModelSettings()
      .then((s) => {
        setModels(s.models);
        setProvider(s.provider);
      })
      .catch(() => {});
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (m: string) => {
    setSelected(m);
    setOpen(false);
    void window.mycode.setModel(m);
  };

  return (
    <div className="model-picker" ref={wrapRef}>
      <button className="model-pill" title="Switch model" onClick={() => setOpen((o) => !o)}>
        {selected || "…"} <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <div className="model-menu">
          {models.length === 0 && <div className="model-empty">No models found</div>}
          {models.length > 0 && <div className="model-group">{providerLabel(provider)}</div>}
          {models.map((m) => (
            <button key={m} className={`model-opt ${m === selected ? "on" : ""}`} onClick={() => pick(m)}>
              <span className="model-check">{m === selected ? <Icon name="check" size={13} /> : null}</span>
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
