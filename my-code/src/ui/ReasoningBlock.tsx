import React from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.js";
import { TEARDROP_ASTERISK } from "./figures.js";

interface Props {
  content: string;
  durationMs: number;
  expanded?: boolean;
}

function formatElapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${(s % 60).toString().padStart(2, "0")}s`;
}

/**
 * The model's reasoning, rendered as one dim collapsed line by default
 * (`✻ Reasoned for 8s  (ctrl+o to expand)`). When expanded, shows the full
 * chain-of-thought, indented and dimmed so it never competes with the answer.
 */
export function ReasoningBlock({ content, durationMs, expanded }: Props) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.accent} dimColor>
        {TEARDROP_ASTERISK} Reasoned for {formatElapsed(durationMs)}
        {!expanded && <Text color={theme.muted}>{"  (ctrl+o to expand)"}</Text>}
      </Text>
      {expanded && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {content.split("\n").map((line, i) => (
            <Text key={i} color={theme.muted} dimColor>
              {line}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
