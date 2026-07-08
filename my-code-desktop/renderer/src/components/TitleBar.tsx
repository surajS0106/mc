import React from "react";
import { Logo, type MascotMood } from "./Logo";
import { Icon } from "./Icon";
import type { Mode } from "../../../electron/ipc";

export interface TitleBarProps {
  mode: Mode;
  onMode: (m: Mode) => void;
  onToggleSidebar: () => void;
  /** When set, the title-bar mark reacts to the agent (undefined = calm/static). */
  mood?: MascotMood;
}

export function TitleBar({ mode, onMode, onToggleSidebar, mood }: TitleBarProps): React.ReactElement {
  return (
    <header className="titlebar">
      <div className="titlebar-left">
        <button className="icon-btn no-drag" onClick={onToggleSidebar} title="Toggle sidebar">
          <Icon name="menu" size={17} />
        </button>
        <Logo size={20} className="titlebar-logo" mood={mood} />
        <span className="titlebar-brand">my-code</span>
      </div>

      <div className="mode-tabs no-drag">
        <button className={`mode-tab ${mode === "chat" ? "active" : ""}`} onClick={() => onMode("chat")}>Chat</button>
        <button className={`mode-tab ${mode === "code" ? "active" : ""}`} onClick={() => onMode("code")}>Code</button>
      </div>

      <div className="titlebar-right no-drag">
        <button className="win-btn" onClick={() => window.mycode.windowMinimize()} title="Minimize">
          <Icon name="minimize" size={15} />
        </button>
        <button className="win-btn" onClick={() => window.mycode.windowToggleMaximize()} title="Maximize">
          <Icon name="maximize" size={13} />
        </button>
        <button className="win-btn close" onClick={() => window.mycode.windowClose()} title="Close">
          <Icon name="close" size={15} />
        </button>
      </div>
    </header>
  );
}
