import React from "react";
import { Text } from "ink";
import { theme } from "./theme.js";
import { METER_FILL, METER_EMPTY } from "./figures.js";
import { formatTokens } from "../session/stats.js";

/** Fill color by usage ratio — green → yellow → red as the window fills. */
export function meterColor(ratio: number): string {
  if (ratio >= 0.8) return theme.danger;
  if (ratio >= 0.6) return theme.warning;
  return theme.meterFill;
}

interface Props {
  used: number;
  limit?: number;
  /** Number of meter cells. Default 6. */
  cells?: number;
}

/**
 * Context-usage meter: `▰▰▱▱▱▱ 5% · 12.4k/256k`. When the capacity is unknown,
 * falls back to the raw used-token count.
 */
export function ContextMeter({ used, limit, cells = 6 }: Props) {
  if (!limit || limit <= 0) {
    return <Text color={theme.muted}>{used ? formatTokens(used) : "—"}</Text>;
  }
  const ratio = Math.min(1, used / limit);
  const filled = Math.min(cells, Math.round(ratio * cells));
  const pct = Math.round(ratio * 100);
  return (
    <Text>
      <Text color={meterColor(ratio)}>{METER_FILL.repeat(filled)}</Text>
      <Text color={theme.meterEmpty}>{METER_EMPTY.repeat(Math.max(0, cells - filled))}</Text>
      <Text color={theme.muted}>{` ${pct}% · ${formatTokens(used)}/${formatTokens(limit)}`}</Text>
    </Text>
  );
}
