import React from "react";
import { Logo, type MascotMood } from "./Logo";
import { Icon } from "./Icon";
import type { Mode } from "../../../electron/ipc";

export interface TitleBarProps {
  mode: Mode;
  onMode: (m: Mode) => void;
  onOpenSettings: () => void;
  onOpenCommand: () => void;
  /** When set, the title-bar mark reacts to the agent (undefined = calm/static). */
  mood?: MascotMood;
}

export function TitleBar({ mode, onMode, onOpenSettings, onOpenCommand, mood }: TitleBarProps): React.ReactElement {
  return (
    <header className="titlebar">
      <div className="titlebar-left">
        {/* macOS-style traffic lights — wired to the real window controls */}
        <div className="traffic no-drag">
          <button className="tl tl-close" onClick={() => window.mycode.windowClose()} title="Close" aria-label="Close" />
          <button className="tl tl-min" onClick={() => window.mycode.windowMinimize()} title="Minimize" aria-label="Minimize" />
          <button className="tl tl-max" onClick={() => window.mycode.windowToggleMaximize()} title="Zoom" aria-label="Zoom" />
        </div>
        <Logo size={20} className="titlebar-logo" mood={mood} />
        <span className="titlebar-brand">Sunday</span>
      </div>

      <div className="mode-tabs no-drag">
        <button className={`mode-tab ${mode === "chat" ? "active" : ""}`} onClick={() => onMode("chat")}>Chat</button>
        <button className={`mode-tab ${mode === "code" ? "active" : ""}`} onClick={() => onMode("code")}>Code</button>
      </div>

      <div className="titlebar-right no-drag">
        <button className="kbd-hint" onClick={onOpenCommand} title="Command palette (Ctrl/⌘+K)">⌘K</button>
        <button className="icon-btn" onClick={onOpenSettings} title="Settings">
          <Icon name="sliders" size={16} />
        </button>
      </div>
    </header>
  );
}
