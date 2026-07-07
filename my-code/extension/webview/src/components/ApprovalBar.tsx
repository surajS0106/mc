import type { PermissionRequest } from "../../../src/chat/protocol.js";
import type { PermissionChoice } from "../../../../src/config/permissions.js";

export function ApprovalBar({
  request,
  onDecide,
}: {
  request: PermissionRequest;
  onDecide: (choice: PermissionChoice) => void;
}) {
  const verb = verbFor(request.name);
  const target = summarize(request);
  const sessionRule = request.suggestedRules.session;

  return (
    <div className="approval-bar">
      <div className="approval-summary">
        <span className="approval-verb">{verb}</span>
        <span className="approval-cmd" title={target}>
          {target}
        </span>
      </div>
      <div className="approval-actions">
        <button
          type="button"
          className="approval-btn danger"
          onClick={() => onDecide("no")}
          title="Reject (Esc)"
        >
          No
        </button>
        <button
          type="button"
          className="approval-btn primary"
          onClick={() => onDecide("once")}
          title="Allow once (Alt+Enter)"
        >
          Yes
          <span className="kbd">Alt+⏎</span>
        </button>
        <button
          type="button"
          className="approval-btn primary always"
          onClick={() => onDecide("session")}
          title={`Allow ${sessionRule} for the rest of this session`}
        >
          <span className="always-label">
            Yes, don't ask again for{" "}
            <code className="always-rule">{sessionRule}</code>
          </span>
        </button>
      </div>
    </div>
  );
}

function verbFor(name: string): string {
  if (name === "Bash") return "Run";
  if (name === "Edit") return "Edit";
  if (name === "Write") return "Write";
  if (name === "Read") return "Read";
  if (name === "WebFetch") return "Fetch";
  return name;
}

function summarize(req: PermissionRequest): string {
  const a = req.args;
  if (typeof a.command === "string") return a.command;
  if (typeof a.file_path === "string") return a.file_path;
  if (typeof a.path === "string") return a.path;
  if (typeof a.url === "string") return a.url;
  // fallback: keys only, never values (avoid leaking long content)
  const keys = Object.keys(a);
  return keys.length ? keys.join(", ") : "";
}
