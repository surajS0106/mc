const QUICK_ACTIONS = [
  { icon: "✨", label: "Explain this file", prompt: "Explain the current file in detail" },
  { icon: "🧪", label: "Write tests", prompt: "Write comprehensive tests for this codebase" },
  { icon: "🔧", label: "Fix errors", prompt: "Find and fix any errors or bugs in the current file" },
  { icon: "♻️", label: "Refactor code", prompt: "Refactor the current file for better readability and performance" },
];

export function WelcomeCard({ onQuickAction }: { onQuickAction?: (text: string) => void }) {
  return (
    <div className="welcome">
      <div className="welcome-mark" aria-hidden="true">
        <svg
          width="84"
          height="84"
          viewBox="0 0 84 84"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 22l20 20-20 20" />
          <path className="welcome-cursor" d="M48 62h16" />
        </svg>
      </div>
      <div className="welcome-brand">reno</div>
      <div className="welcome-sub">local coding agent</div>
      <div className="welcome-actions">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            className="quick-card"
            onClick={() => onQuickAction?.(a.prompt)}
          >
            <span className="qc-icon">{a.icon}</span>
            <span className="qc-label">{a.label}</span>
          </button>
        ))}
      </div>
      <div className="welcome-hints">
        <span className="welcome-hint">Ctrl+L attach selection</span>
        <span className="welcome-hint">/ commands</span>
        <span className="welcome-hint">@ mention file</span>
      </div>
    </div>
  );
}
