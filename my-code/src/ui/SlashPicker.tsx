import React, { useEffect, useState } from "react";
import { Box, Text, useStdout } from "ink";
import { theme } from "./theme.js";
import type { SlashCommand } from "./slashCommands.js";

interface Props {
  commands: SlashCommand[];
  selectedIndex: number;
}

const NAME_COL = 24;
const MAX_VISIBLE = 10;

function truncate(s: string, max: number): string {
  if (max <= 1) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function SlashPicker({ commands, selectedIndex }: Props) {
  const { stdout } = useStdout();
  const width = Math.max(40, Math.min(stdout.columns ?? 80, 120));
  const descCol = Math.max(20, width - NAME_COL - 4);
  const [start, setStart] = useState(0);

  // Sticky sliding window: only shifts when the selection would go off-screen.
  useEffect(() => {
    setStart((prev) => {
      if (selectedIndex < prev) return selectedIndex;
      if (selectedIndex >= prev + MAX_VISIBLE) return selectedIndex - MAX_VISIBLE + 1;
      return prev;
    });
  }, [selectedIndex]);

  // Reset window when the list itself changes (filter, length)
  useEffect(() => {
    setStart(0);
  }, [commands.length]);

  if (!commands.length) return null;

  const total = commands.length;
  const clampedStart = Math.max(0, Math.min(start, Math.max(0, total - MAX_VISIBLE)));
  const end = Math.min(total, clampedStart + MAX_VISIBLE);
  const visible = commands.slice(clampedStart, end);

  const hiddenAbove = clampedStart;
  const hiddenBelow = total - end;

  return (
    <Box flexDirection="column" paddingX={1} marginTop={0}>
      {hiddenAbove > 0 && (
        <Box>
          <Box width={2}><Text color="gray" dimColor>↑</Text></Box>
          <Text color="gray" dimColor>{hiddenAbove} more above</Text>
        </Box>
      )}
      {visible.map((cmd, i) => {
        const absoluteIndex = clampedStart + i;
        const selected = absoluteIndex === selectedIndex;
        const label = "/" + cmd.name + (cmd.args ? " " + cmd.args : "");
        return (
          <Box key={cmd.name}>
            <Box width={2}>
              <Text color={theme.accent}>{selected ? "▸" : " "}</Text>
            </Box>
            <Box width={NAME_COL}>
              <Text color={selected ? "white" : "gray"} bold={selected}>
                {truncate(label, NAME_COL - 1)}
              </Text>
            </Box>
            <Box flexGrow={1}>
              <Text color={theme.accent} dimColor={!selected}>
                {truncate(cmd.desc, descCol)}
              </Text>
            </Box>
          </Box>
        );
      })}
      {hiddenBelow > 0 && (
        <Box>
          <Box width={2}><Text color="gray" dimColor>↓</Text></Box>
          <Text color="gray" dimColor>{hiddenBelow} more below</Text>
        </Box>
      )}
      <Box marginLeft={2} marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate · tab complete · enter run · esc cancel  ·  {selectedIndex + 1}/{total}
        </Text>
      </Box>
    </Box>
  );
}
