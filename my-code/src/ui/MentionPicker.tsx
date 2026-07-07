import React from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.js";
import { ARROW_RIGHT } from "./figures.js";

interface Props {
  matches: string[];
  selectedIndex: number;
  scanning?: boolean;
}

export function MentionPicker({ matches, selectedIndex, scanning }: Props) {
  if (matches.length === 0) {
    if (scanning) {
      return (
        <Box paddingX={1}>
          <Text color={theme.muted} dimColor>scanning files…</Text>
        </Box>
      );
    }
    return null;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {matches.map((f, i) => {
        const selected = i === selectedIndex;
        const slash = f.lastIndexOf("/");
        const dir = slash >= 0 ? f.slice(0, slash + 1) : "";
        const base = slash >= 0 ? f.slice(slash + 1) : f;
        return (
          <Box key={f}>
            <Box width={2}>
              <Text color={theme.accent}>{selected ? ARROW_RIGHT : " "}</Text>
            </Box>
            <Text color={theme.muted} dimColor>{dir}</Text>
            <Text color={selected ? theme.text : theme.muted} bold={selected}>{base}</Text>
          </Box>
        );
      })}
      <Box marginLeft={2}>
        <Text color={theme.muted} dimColor>↑↓ pick · tab/enter insert · esc cancel</Text>
      </Box>
    </Box>
  );
}
