import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import type { Bootstrap, Mode, SessionMeta } from "../../../electron/ipc";

export interface SidebarProps {
  boot: Bootstrap | null;
  mode: Mode;
  sessions: SessionMeta[];
  activeTitle: string | null;
  loadingId: string | null;
  onNewChat: () => void;
  onResume: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  boot,
  mode,
  sessions,
  activeTitle,
  loadingId,
  onNewChat,
  onResume,
  onRename,
  onDelete,
  onOpenSettings,
}: SidebarProps): React.ReactElement {
  return (
    <aside className="sidebar">
      <button className="new-chat" onClick={onNewChat}>
        <span className="plus"><Icon name="plus" size={17} /></span> New {mode === "code" ? "task" : "chat"}
      </button>

      <nav className="side-nav">
        <button className="side-link" disabled><Icon name="folder" size={16} /> Projects</button>
        <button className="side-link" disabled><Icon name="layers" size={16} /> Artifacts</button>
        <button className="side-link" onClick={onOpenSettings}><Icon name="sliders" size={16} /> Customize</button>
      </nav>

      <div className="recents">
        <div className="recents-label">Recents</div>
        <div className="recents-list">
          {sessions.length === 0 && <div className="recents-empty">No sessions yet</div>}
          {sessions.map((s) => (
            <RecentRow
              key={s.id}
              session={s}
              active={!!activeTitle && s.firstPrompt === activeTitle}
              loading={loadingId === s.id}
              onResume={() => onResume(s.id)}
              onRename={(title) => onRename(s.id, title)}
              onDelete={() => onDelete(s.id)}
            />
          ))}
        </div>
      </div>

      <div className="sidebar-foot">
        <div className="account">
          <span className="avatar"><Icon name="user" size={16} /></span>
          <div className="account-meta">
            <div className="account-name">my-code</div>
            <div className="account-sub">{boot?.model ?? "…"}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function RecentRow({
  session,
  active,
  loading,
  onResume,
  onRename,
  onDelete,
}: {
  session: SessionMeta;
  active: boolean;
  loading: boolean;
  onResume: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.firstPrompt ?? session.id);
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const label = session.firstPrompt ?? session.id;

  if (editing) {
    return (
      <div className="recent-row" ref={rowRef}>
        <input
          className="recent-edit"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRename(draft.trim() || label);
              setEditing(false);
            } else if (e.key === "Escape") {
              setEditing(false);
              setDraft(label);
            }
          }}
          onBlur={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className={`recent-row ${active ? "active" : ""}`} ref={rowRef}>
      <button className="recent-item" title={label} onClick={onResume} disabled={loading}>
        {label}
      </button>
      <div className="recent-tail">
        {loading ? (
          <span className="mini-spinner" aria-label="loading" />
        ) : (
          <button
            className="dots-btn"
            title="More"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
          >
            <Icon name="more" size={16} />
          </button>
        )}
      </div>
      {menuOpen && (
        <div className="recent-menu">
          <button
            onClick={() => {
              setEditing(true);
              setMenuOpen(false);
            }}
          >
            Rename
          </button>
          <button className="danger" onClick={() => { setMenuOpen(false); onDelete(); }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
