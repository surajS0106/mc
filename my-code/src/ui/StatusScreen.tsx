import React from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.js";
import { formatTokens, formatDuration } from "../session/stats.js";
import type { SessionStats } from "../session/stats.js";
import type { PermissionEngine } from "../config/permissions.js";
import type { ChatProvider } from "../agent/provider.js";

interface Props {
  model: string;
  provider: ChatProvider;
  contextLength?: number;
  stats: SessionStats;
  permissions: PermissionEngine;
  bypassAll: boolean;
  costText?: string;
}

function ctxColor(pct: number): "green" | "yellow" | "red" {
  if (pct < 0.6) return "green";
  if (pct < 0.8) return "yellow";
  return "red";
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

export function StatusScreen({
  model,
  provider,
  contextLength,
  stats,
  permissions,
  bypassAll,
  costText,
}: Props) {
  const totals = stats.totals();
  const last = stats.lastPromptTokens;
  const pct = contextLength && last ? last / contextLength : 0;
  const isCloud = provider.info.isCloud || model.endsWith("-cloud");
  const snap = permissions.snapshot();
  const sessionRules = snap.session.allow.length + snap.session.deny.length;
  const projectRules =
    (snap.project.permissions?.allow?.length ?? 0) + (snap.project.permissions?.deny?.length ?? 0);
  const globalRules =
    (snap.global.permissions?.allow?.length ?? 0) + (snap.global.permissions?.deny?.length ?? 0);
  const toolLine =
    Object.entries(totals.toolCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `${n}×${c}`)
      .join(" ") || "(none)";

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.borderActive} paddingX={2} paddingY={0} marginY={1}>
      <Text color={theme.accent} bold>Status</Text>
      <Box marginTop={1} flexDirection="column">
        <Row label="model">
          <Text color="white" bold>{model}</Text>
          {isCloud && <Text color={theme.accent}> (cloud)</Text>}
        </Row>
        <Row label="provider">
          <Text color="white">{provider.info.name}</Text>
          {provider.info.host && <Text color="gray" dimColor>{`  ${provider.info.host}`}</Text>}
        </Row>
        <Row label="context">
          {last > 0 ? (
            <Text color={contextLength ? ctxColor(pct) : "white"}>
              {last.toLocaleString()} tokens used
            </Text>
          ) : (
            <Text color="gray" dimColor>0 (no request yet)</Text>
          )}
        </Row>
        <Row label="session">
          <Text>
            {totals.turns} turns · {formatDuration(totals.wallMs)} wall · {formatDuration(totals.apiMs)} api
          </Text>
        </Row>
        <Row label="tokens">
          <Text>
            {formatTokens(totals.promptTokens)} in / {formatTokens(totals.completionTokens)} out
          </Text>
        </Row>
        <Row label="by tool">
          <Text color="gray">{toolLine}</Text>
        </Row>
        <Row label="cost">
          <Text color={costText ? theme.accent : theme.muted} dimColor={!costText}>
            {costText ?? "$— (no pricing configured — see ~/.my-code/pricing.json)"}
          </Text>
        </Row>
        <Row label="bypass">
          <Text color={bypassAll ? "red" : "green"} bold={bypassAll}>
            {bypassAll ? "ON (⚠ all tools auto-approve)" : "off"}
          </Text>
        </Row>
        <Row label="rules">
          <Text color="gray">
            session:{sessionRules}  project:{projectRules}  global:{globalRules}
          </Text>
        </Row>
      </Box>
    </Box>
  );
}
