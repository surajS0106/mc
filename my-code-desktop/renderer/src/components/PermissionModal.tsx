import React, { useEffect } from "react";
import { Icon } from "./Icon";
import type { PendingPermission } from "../transcript";
import type { PermissionChoice } from "../../../electron/ipc";

export interface PermissionModalProps {
  req: PendingPermission;
  cwd: string | null;
  onAnswer: (choice: PermissionChoice) => void;
}

/** Best-effort one-line preview of what the tool is about to do. */
function preview(name: string, args: Record<string, unknown>): string {
  const a = args as Record<string, string>;
  return (a.command ?? a.file_path ?? a.path ?? a.url ?? a.pattern ?? "").toString();
}

export function PermissionModal({ req, cwd, onAnswer }: PermissionModalProps): React.ReactElement {
  const detail = preview(req.name, req.args);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onAnswer("no"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAnswer]);
  return (
    <div className="modal-backdrop" onClick={() => onAnswer("no")}>
      <div className="perm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="perm-title">my-code wants to use a tool</div>
        <div className="perm-tool">
          <span className="tool-glyph"><Icon name="dot" size={11} /></span> {req.name}
        </div>
        {detail && <pre className="perm-detail">{detail}</pre>}
        {cwd && <div className="perm-cwd">in {cwd}</div>}
        <div className="perm-actions">
          <button className="btn primary" onClick={() => onAnswer("once")}>Allow once</button>
          <button className="btn" onClick={() => onAnswer("session")}>Allow for session</button>
          <button className="btn" onClick={() => onAnswer("project")}>Always allow</button>
          <button className="btn danger" onClick={() => onAnswer("no")}>Deny</button>
        </div>
      </div>
    </div>
  );
}
