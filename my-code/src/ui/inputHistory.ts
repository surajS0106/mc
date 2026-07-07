// In-memory command history for the prompt box. Module-level so it survives
// RichInput remounts (e.g. while a permission prompt is shown) within a session.

const MAX = 200;
const history: string[] = [];

export function pushHistory(entry: string): void {
  const trimmed = entry.trim();
  if (!trimmed) return;
  if (history[history.length - 1] === trimmed) return; // skip consecutive dupes
  history.push(trimmed);
  if (history.length > MAX) history.shift();
}

export function historyLength(): number {
  return history.length;
}

// `fromEnd` counts back from the newest: 1 = most recent entry.
export function historyAt(fromEnd: number): string | undefined {
  if (fromEnd < 1 || fromEnd > history.length) return undefined;
  return history[history.length - fromEnd];
}
