import { useEffect, useRef, useState } from "react";
import {
  PlusIcon,
  HistoryIcon,
  MoreIcon,
  GearIcon,
  BrandMark,
} from "./Icons.js";

export function Header({
  model,
  cwd,
  promptTokens,
  completionTokens,
  onNewChat,
  onHistory,
  onOpenSettings,
}: {
  model: string;
  cwd: string;
  promptTokens: number;
  completionTokens: number;
  onNewChat: () => void;
  onHistory: () => void;
  onOpenSettings: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function onDoc(e: MouseEvent) {
      if (!moreRef.current) return;
      if (!moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  return (
    <div className="header" ref={moreRef}>
      <span className="brand">
        <span className="brand-mark" aria-hidden="true">
          <BrandMark />
        </span>
        <span className="brand-name">reno</span>
        <span
          className="brand-status"
          title="Local model ready"
          aria-label="Local model ready"
        />
      </span>
      {model && (
        <span className="header-model" title={model}>
          {model.split(":")[0]}
        </span>
      )}
      <span className="spacer" />
      <button
        type="button"
        className="icon-btn"
        title="New chat"
        onClick={onNewChat}
      >
        <PlusIcon />
      </button>
      <button
        type="button"
        className="icon-btn"
        title="Past conversations"
        onClick={onHistory}
      >
        <HistoryIcon />
      </button>
      <button
        type="button"
        className="icon-btn"
        title="Settings"
        onClick={onOpenSettings}
      >
        <GearIcon />
      </button>
      <button
        type="button"
        className="icon-btn"
        title="More"
        onClick={() => setMoreOpen((v) => !v)}
      >
        <MoreIcon />
      </button>
      {moreOpen && (
        <div className="more-menu" onMouseDown={(e) => e.stopPropagation()}>
          <div className="more-menu-section">
            <div className="more-menu-row">
              <span className="k">model</span>
              <span className="v" title={model}>
                {model || "(none)"}
              </span>
            </div>
            <div className="more-menu-row">
              <span className="k">cwd</span>
              <span className="v" title={cwd}>
                {shortenPath(cwd)}
              </span>
            </div>
            <div className="more-menu-row">
              <span className="k">tokens</span>
              <span className="v">
                {promptTokens + completionTokens > 0
                  ? `${promptTokens}↑ ${completionTokens}↓`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function shortenPath(p: string): string {
  if (!p) return "";
  const parts = p.split(/[\\/]/);
  if (parts.length <= 3) return p;
  return ".../" + parts.slice(-2).join("/");
}
