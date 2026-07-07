import type { AttachedSelection } from "../../../src/chat/protocol.js";

export function SelectionChip({
  selection,
  onDetach,
  compact,
}: {
  selection: AttachedSelection;
  onDetach?: () => void;
  compact?: boolean;
}) {
  const file = basename(selection.filePath);
  const range =
    selection.startLine === selection.endLine
      ? `${selection.startLine}`
      : `${selection.startLine}-${selection.endLine}`;
  return (
    <div className={`chip ${compact ? "compact" : ""}`}>
      <span className="chip-icon">📎</span>
      <span className="chip-label">
        {file}:{range}
      </span>
      {onDetach && (
        <button
          type="button"
          className="chip-close"
          onClick={onDetach}
          aria-label="Detach selection"
        >
          ×
        </button>
      )}
    </div>
  );
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}
