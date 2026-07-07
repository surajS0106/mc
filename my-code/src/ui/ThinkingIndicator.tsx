import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.js";
import { SPARKLE_FRAMES } from "./figures.js";

interface Props {
  verb: string;
  startedAt: number;
  completionTokens: number;
  activeTool?: string;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${(s % 60).toString().padStart(2, "0")}s`;
}

export function ThinkingIndicator({ verb, startedAt, completionTokens, activeTool }: Props) {
  const [frame, setFrame] = useState(0);
  const [tick, setTick] = useState(0);
  const [shimmer, setShimmer] = useState(false);

  // Braille glyph cycle — fast so the spinner reads as smooth motion.
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % SPARKLE_FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);

  // Slow shimmer — toggles bright/dim every 800ms for a subtle pulse.
  useEffect(() => {
    const id = setInterval(() => setShimmer((s) => !s), 800);
    return () => clearInterval(id);
  }, []);

  // Tick every second so elapsed counter updates.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = formatElapsed(Date.now() - startedAt);
  const label = activeTool ?? verb;
  const meta = completionTokens > 0
    ? `(${elapsed} · ${completionTokens} tokens · esc to interrupt)`
    : `(${elapsed} · esc to interrupt)`;

  void tick; // referenced so React keeps re-rendering each second

  const glyphColor = shimmer ? theme.accentBright : theme.accent;

  return (
    <Box marginY={1}>
      <Text color={glyphColor}>{SPARKLE_FRAMES[frame]}</Text>
      <Text color={theme.accent} bold>{" " + label}</Text>
      <Text color={theme.accent}>…  </Text>
      <Text color={theme.muted} dimColor>{meta}</Text>
    </Box>
  );
}
