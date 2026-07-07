import { useEffect, useMemo, useRef, useState } from "react";

const CLOUD_SUGGESTIONS = [
  "qwen3-next:80b-cloud",
  "qwen3-coder:480b-cloud",
  "gpt-oss:20b-cloud",
  "gpt-oss:120b-cloud",
];

export function ModelPicker({
  models,
  current,
  onPick,
  onClose,
}: {
  models: string[];
  current: string;
  onPick: (model: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const installedSet = useMemo(() => new Set(models), [models]);
  const cloudOnly = useMemo(
    () => CLOUD_SUGGESTIONS.filter((m) => !installedSet.has(m)),
    [installedSet],
  );

  const trimmed = query.trim();
  const lowerQ = trimmed.toLowerCase();

  const filteredInstalled = useMemo(() => {
    if (!trimmed) return models;
    return models.filter((m) => m.toLowerCase().includes(lowerQ));
  }, [models, trimmed, lowerQ]);

  const filteredCloud = useMemo(() => {
    if (!trimmed) return cloudOnly;
    return cloudOnly.filter((m) => m.toLowerCase().includes(lowerQ));
  }, [cloudOnly, trimmed, lowerQ]);

  const knownAll = [...models, ...cloudOnly];
  const exactMatch = trimmed && knownAll.some((m) => m === trimmed);
  const showCustom = trimmed.length > 0 && !exactMatch;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (trimmed && !exactMatch) {
        onPick(trimmed);
        return;
      }
      const first = filteredInstalled[0] ?? filteredCloud[0];
      if (first) onPick(first);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  const hasAnyResult =
    filteredInstalled.length > 0 || filteredCloud.length > 0 || showCustom;

  return (
    <div className="model-picker" ref={ref} onMouseDown={(e) => e.stopPropagation()}>
      <div className="model-picker-search">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search or type a model name…"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {showCustom && (
        <button
          type="button"
          className="model-picker-row custom"
          onClick={() => onPick(trimmed)}
        >
          <span className="model-name">Use “{trimmed}”</span>
          <span className="model-current">enter</span>
        </button>
      )}

      {filteredInstalled.length > 0 && (
        <>
          <div className="model-picker-head">Installed</div>
          {filteredInstalled.map((m) => (
            <button
              key={`i-${m}`}
              type="button"
              className={`model-picker-row ${m === current ? "active" : ""}`}
              onClick={() => onPick(m)}
            >
              <span className="model-name">{m}</span>
              {m === current && <span className="model-current">current</span>}
            </button>
          ))}
        </>
      )}

      {filteredCloud.length > 0 && (
        <>
          <div className="model-picker-head">Cloud</div>
          {filteredCloud.map((m) => (
            <button
              key={`c-${m}`}
              type="button"
              className={`model-picker-row ${m === current ? "active" : ""}`}
              onClick={() => onPick(m)}
              title="Ollama Cloud model. Requires API key if not pulled locally."
            >
              <span className="model-name">{m}</span>
              {m === current ? (
                <span className="model-current">current</span>
              ) : (
                <span className="model-tag">cloud</span>
              )}
            </button>
          ))}
        </>
      )}

      {!hasAnyResult && (
        <div className="model-picker-empty">
          No models match. Type a model name above and press Enter to use it.
        </div>
      )}
    </div>
  );
}
