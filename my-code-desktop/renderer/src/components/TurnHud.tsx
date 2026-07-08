import React, { useEffect, useState } from "react";

export interface TurnHudProps {
  busy: boolean;
  tokens: { prompt?: number; completion?: number };
  /** Epoch ms when the current turn started, or null between turns. */
  turnStart: number | null;
}

/**
 * Compact live turn readout in the header: total tokens · generation rate ·
 * elapsed. Ticks once a second only while busy, then freezes on the final turn.
 */
export function TurnHud({ busy, tokens, turnStart }: TurnHudProps): React.ReactElement | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!busy || !turnStart) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [busy, turnStart]);

  const total = (tokens.prompt ?? 0) + (tokens.completion ?? 0);
  if (!turnStart && total === 0) return null;

  const elapsedS = turnStart ? Math.max(0, (now - turnStart) / 1000) : 0;
  const rate = elapsedS > 0.5 ? Math.round((tokens.completion ?? 0) / elapsedS) : 0;

  return (
    <span className="hud" title="Tokens · generation rate · elapsed">
      {busy && <span className="hud-dot" />}
      <b>{total.toLocaleString()}</b> tok
      {rate > 0 && <> · <b>{rate}</b>/s</>}
      {elapsedS >= 1 && <> · <b>{elapsedS < 60 ? `${Math.round(elapsedS)}s` : `${Math.floor(elapsedS / 60)}m ${Math.round(elapsedS % 60)}s`}</b></>}
    </span>
  );
}
