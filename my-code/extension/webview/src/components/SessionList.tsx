interface SessionMeta {
  id: string;
  cwd: string;
  model: string;
  startedAt: number;
  turns: number;
  promptTokens: number;
  completionTokens: number;
}

export function SessionList({
  sessions,
  onResume,
  onClose,
}: {
  sessions: SessionMeta[];
  onResume: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-head">
          <strong>Recent Sessions</strong>
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="session-rows">
          {sessions.length === 0 ? (
            <div className="muted">No sessions yet.</div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                className="session-row"
                onClick={() => onResume(s.id)}
              >
                <div className="left">
                  <div className="age">{relTime(s.startedAt)}</div>
                  <div className="model">
                    {s.model.split(":")[0]} · {s.turns}t
                  </div>
                </div>
                <div className="middle">
                  <div className="cwd">{shortenCwd(s.cwd)}</div>
                  <div className="tokens">
                    {fmtTokens(s.promptTokens + s.completionTokens)} tokens
                  </div>
                </div>
                <div className="right">↻</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function relTime(at: number): string {
  const d = Date.now() - at;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)}h ago`;
  return `${Math.round(d / 86_400_000)}d ago`;
}

function shortenCwd(cwd: string): string {
  const parts = cwd.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

function fmtTokens(n: number): string {
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}k`;
}
