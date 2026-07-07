import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.js";
import Spinner from "ink-spinner";
import {
  loadAllSessions,
  bucketByTime,
  formatTokens,
  formatDuration,
  aggregate,
} from "../session/stats.js";
import type { SessionStats, SessionRollup, Aggregate } from "../session/stats.js";
import { costFor, formatCost } from "../session/pricing.js";
import type { PricingTable } from "../session/pricing.js";

interface Props {
  stats: SessionStats;
  pricing: PricingTable;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Box width={10}>
        <Text color="gray">{label}</Text>
      </Box>
      <Box flexGrow={1}>
        <Text>{children}</Text>
      </Box>
    </Box>
  );
}

function Bucket({
  title,
  agg,
  pricing,
}: {
  title: string;
  agg: Aggregate;
  pricing: PricingTable;
}) {
  // cost: only compute if every model in byModel has a price
  let cost = 0;
  let priceable = Object.keys(agg.byModel).length > 0;
  for (const [model, v] of Object.entries(agg.byModel)) {
    const c = costFor(model, v.promptTokens, v.completionTokens, pricing);
    if (c === null) {
      priceable = false;
      break;
    }
    cost += c;
  }
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.accent} bold>{title}</Text>
      <Row label="sessions"><Text>{agg.sessions}</Text></Row>
      <Row label="turns"><Text>{agg.turns} · {agg.requests} requests</Text></Row>
      <Row label="tokens">
        <Text>{formatTokens(agg.promptTokens)} in / {formatTokens(agg.completionTokens)} out</Text>
      </Row>
      <Row label="time">
        <Text>{formatDuration(agg.wallMs)} wall · {formatDuration(agg.apiMs)} api</Text>
      </Row>
      <Row label="cost">
        <Text color={priceable ? theme.accent : theme.muted} dimColor={!priceable}>
          {priceable ? formatCost(cost) : "$— (add pricing to see costs)"}
        </Text>
      </Row>
    </Box>
  );
}

export function UsageScreen({ stats, pricing }: Props) {
  const [sessions, setSessions] = useState<SessionRollup[] | null>(null);

  useEffect(() => {
    loadAllSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  if (!sessions) {
    return (
      <Box borderStyle="round" borderColor={theme.borderActive} paddingX={2} marginY={1}>
        <Text color={theme.accent}><Spinner type="dots" /></Text>
        <Text> loading usage…</Text>
      </Box>
    );
  }

  // include current (in-memory) session as if it had ended now
  const current: SessionRollup = { ...stats.rollup() };
  const merged = [current, ...sessions.filter((s) => s.id !== current.id)];
  const { today, week, allTime } = bucketByTime(merged);

  const byModelEntries = Object.entries(allTime.byModel).sort(
    (a, b) => b[1].promptTokens + b[1].completionTokens - (a[1].promptTokens + a[1].completionTokens)
  );
  const byToolEntries = Object.entries(allTime.toolCounts).sort((a, b) => b[1] - a[1]);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.borderActive} paddingX={2} paddingY={0} marginY={1}>
      <Text color={theme.accent} bold>Usage</Text>

      <Bucket title="Today" agg={today} pricing={pricing} />
      <Bucket title="This week" agg={week} pricing={pricing} />
      <Bucket title="All time" agg={allTime} pricing={pricing} />

      {byModelEntries.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.accent} bold>By model (all time)</Text>
          {byModelEntries.slice(0, 8).map(([m, v]) => (
            <Box key={m}>
              <Box width={28}><Text color="white">{m}</Text></Box>
              <Text color="gray">
                {v.turns}t · {formatTokens(v.promptTokens)} in / {formatTokens(v.completionTokens)} out
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {byToolEntries.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.accent} bold>By tool (all time)</Text>
          <Text color="gray">
            {byToolEntries.map(([n, c]) => `${n}×${c}`).join("  ")}
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>/usage to hide · /status for current session only</Text>
      </Box>
    </Box>
  );
}
