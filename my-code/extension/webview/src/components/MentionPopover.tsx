import { useEffect, useRef } from "react";

export interface MentionItem {
  relPath: string;
  basename: string;
}

export function MentionPopover({
  items,
  selectedIndex,
  onPick,
  onHover,
}: {
  items: MentionItem[];
  selectedIndex: number;
  onPick: (relPath: string) => void;
  onHover: (i: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-i="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!items.length) return null;
  return (
    <div className="slash-popover" ref={containerRef}>
      {items.map((it, i) => (
        <button
          key={it.relPath}
          data-i={i}
          type="button"
          className={i === selectedIndex ? "sel" : ""}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(it.relPath)}
        >
          <span className="cmd">{it.basename}</span>
          <span className="desc">{it.relPath}</span>
        </button>
      ))}
    </div>
  );
}
