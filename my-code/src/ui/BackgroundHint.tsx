import React from "react";
import { Box, Text, useInput } from "ink";

const isBackgroundTasksDisabled = !!process.env.IG_DISABLE_BACKGROUND_TASKS;

/**
 * Shown during long-running foreground commands.
 * Displays "Ctrl+B to run in background" hint.
 * When Ctrl+B is pressed, calls backgroundAll() via the callback.
 */
export function BackgroundHint({
  onBackground,
}: {
  onBackground?: () => void;
} = {}): React.ReactElement | null {
  useInput((_input, key) => {
    if (key.ctrl && _input === "b") {
      onBackground?.();
    }
  });

  if (isBackgroundTasksDisabled) return null;

  return (
    <Box paddingLeft={5}>
      <Text dimColor>(ctrl+b to run in background)</Text>
    </Box>
  );
}
