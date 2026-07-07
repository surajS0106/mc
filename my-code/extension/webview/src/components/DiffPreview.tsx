import type { DiffStaged } from "../../../src/chat/protocol.js";

export function DiffPreview({
  diff,
  state,
  onView,
  onApply,
  onReject,
}: {
  diff: DiffStaged;
  state: "pending" | "applied" | "rejected";
  onView: () => void;
  onApply: () => void;
  onReject: () => void;
}) {
  const filename = basename(diff.filePath);
  return (
    <div className="diff-preview">
      <div className="diff-head">
        <span className="diff-op">{diff.op}</span>
        <span className="diff-file" title={diff.filePath}>
          {filename}
        </span>
        <span className="diff-stats">
          <span className="add">+{diff.addedLines}</span>{" "}
          <span className="rem">−{diff.removedLines}</span>
        </span>
      </div>
      {diff.preview && (
        <pre className="diff-mini">{colorize(diff.preview)}</pre>
      )}
      <div className="diff-actions">
        <button type="button" onClick={onView}>
          View Diff
        </button>
        {state === "pending" ? (
          <>
            <button type="button" className="apply" onClick={onApply}>
              Apply
            </button>
            <button type="button" className="reject" onClick={onReject}>
              Reject
            </button>
          </>
        ) : (
          <span className={`diff-state ${state}`}>
            {state === "applied" ? "✓ Applied" : "✗ Rejected"}
          </span>
        )}
      </div>
    </div>
  );
}

function colorize(preview: string): React.ReactNode {
  return preview.split("\n").map((l, i) => {
    const cls = l.startsWith("+ ")
      ? "add"
      : l.startsWith("- ")
        ? "rem"
        : "ctx";
    return (
      <span key={i} className={cls}>
        {l}
        {"\n"}
      </span>
    );
  });
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}
