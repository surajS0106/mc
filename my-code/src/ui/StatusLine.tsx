import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.js";
import { SEP, SPARKLE_FRAMES, BLACK_CIRCLE } from "./figures.js";
import { ContextMeter } from "./ContextMeter.js";

interface Props {
  model: string;
  account?: string;
  providerName?: string;
  isCloud?: boolean;
  lastPromptTokens: number;
  contextLength?: number;
  busy?: boolean;
  busyVerb?: string | null;
  busyStartedAt?: number;
  bgTasks?: number;
  queued?: number;
}

/**
 * Single-row live status bar. Holds the *dynamic* session essentials —
 * model · provider·cloud · account · context meter — plus a busy segment.
 * No mode/git segment, no cost, no version, no cumulative Σ (bypass/YOLO is
 * signalled by the input box border color instead).
 */
export function StatusLine({
  model,
  account,
  providerName,
  isCloud,
  lastPromptTokens,
  contextLength,
  busy,
  busyVerb,
  busyStartedAt,
  bgTasks = 0,
  queued = 0,
}: Props) {
  // Tick once a second while busy so the elapsed counter + spinner advance.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const shortModel = model.replace(/:.*$/, "").replace(/-cloud$/, "");
  const elapsed = busy && busyStartedAt ? Math.max(0, Math.floor((Date.now() - busyStartedAt) / 1000)) : 0;
  const frame = SPARKLE_FRAMES[elapsed % SPARKLE_FRAMES.length];

  const Seg = ({ children }: { children: React.ReactNode }) => (
    <>
      <Text color={theme.divider}>{SEP}</Text>
      <Text>
        {" "}
        {children}
        {" "}
      </Text>
    </>
  );

  return (
    <Box paddingX={1}>
      {bgTasks > 0 && (
        <Seg>
          <Text color={theme.warning} dimColor>{bgTasks} bg</Text>
        </Seg>
      )}
      {queued > 0 && (
        <Seg>
          <Text color={theme.muted} dimColor>{queued} queued</Text>
        </Seg>
      )}
      {busy && busyVerb ? (
        <Seg>
          <Text color={theme.accent}>{frame} </Text>
          <Text color={theme.accent} bold>{busyVerb}</Text>
          <Text color={theme.muted} dimColor>{` ${elapsed}s · esc to interrupt`}</Text>
        </Seg>
      ) : null}
      <Seg>
        <Text color={theme.accent}>{BLACK_CIRCLE} </Text>
        <Text color={theme.text}>{shortModel}</Text>
      </Seg>
      {providerName ? (
        <Seg>
          <Text color={theme.muted} dimColor>
            {providerName}
            {isCloud ? " · cloud" : " · local"}
          </Text>
        </Seg>
      ) : null}
      {account ? (
        <Seg>
          <Text color={theme.muted}>{account}</Text>
        </Seg>
      ) : null}
      <Seg>
        <ContextMeter used={lastPromptTokens} limit={contextLength} />
      </Seg>
      <Text color={theme.divider}>{" " + SEP}</Text>
    </Box>
  );
}
