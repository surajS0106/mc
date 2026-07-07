import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "./theme.js";
import Spinner from "ink-spinner";
import type { ChatProvider } from "../agent/provider.js";

interface Props {
  provider: ChatProvider;
  currentModel: string;
  onSelect: (model: string) => void;
  onCancel: () => void;
}

const MAX_VISIBLE = 8;

export function ModelPicker({ provider, currentModel, onSelect, onCancel }: Props) {
  const [models, setModels] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [start, setStart] = useState(0);

  useEffect(() => {
    let cancelled = false;
    provider
      .listModels()
      .then((m) => {
        if (cancelled) return;
        setModels(m);
        const idx = m.indexOf(currentModel);
        if (idx >= 0) setSelected(idx);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [provider, currentModel]);

  // Sliding window — only shift when the selection would scroll off-screen.
  useEffect(() => {
    setStart((prev) => {
      if (selected < prev) return selected;
      if (selected >= prev + MAX_VISIBLE) return selected - MAX_VISIBLE + 1;
      return prev;
    });
  }, [selected]);

  useInput((_input, key) => {
    if (key.escape) return onCancel();
    if (!models || models.length === 0) return;
    if (key.upArrow) return setSelected((i) => Math.max(0, i - 1));
    if (key.downArrow) return setSelected((i) => Math.min(models.length - 1, i + 1));
    if (key.pageUp) return setSelected((i) => Math.max(0, i - MAX_VISIBLE));
    if (key.pageDown) return setSelected((i) => Math.min(models!.length - 1, i + MAX_VISIBLE));
    if (key.return) return onSelect(models[selected]);
  });

  const noModelsHint =
    provider.info.name === "ollama"
      ? '(no models installed — run "ollama pull <model>" first)'
      : `(no models available for provider "${provider.info.name}")`;

  const total = models?.length ?? 0;
  const clampedStart = Math.max(0, Math.min(start, Math.max(0, total - MAX_VISIBLE)));
  const end = Math.min(total, clampedStart + MAX_VISIBLE);
  const visible = models ? models.slice(clampedStart, end) : [];
  const hiddenAbove = clampedStart;
  const hiddenBelow = total - end;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.borderActive}
      paddingX={2}
      paddingY={0}
      marginBottom={1}
    >
      <Text bold color={theme.accent}>
        Select model · provider: {provider.info.name}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {error && <Text color="red">error: {error}</Text>}
        {!error && !models && (
          <Text color="gray">
            <Spinner type="dots" /> <Text> loading installed models…</Text>
          </Text>
        )}
        {models && models.length === 0 && <Text color="yellow">{noModelsHint}</Text>}

        {hiddenAbove > 0 && (
          <Box>
            <Box width={2}>
              <Text color="gray" dimColor>↑</Text>
            </Box>
            <Text color="gray" dimColor>
              {hiddenAbove} more above
            </Text>
          </Box>
        )}

        {visible.map((m, i) => {
          const absoluteIndex = clampedStart + i;
          const isCurrent = m === currentModel;
          const isSelected = absoluteIndex === selected;
          const isCloud = m.endsWith("-cloud") || provider.info.isCloud;
          return (
            <Box key={m}>
              <Box width={2}>
                <Text color={isSelected ? theme.accent : theme.muted}>{isSelected ? "▸" : " "}</Text>
              </Box>
              <Text color={isSelected ? theme.accent : theme.text} bold={isSelected}>
                {m}
              </Text>
              {isCloud && (
                <Text color="blue" dimColor={!isSelected}>
                  {" (cloud)"}
                </Text>
              )}
              {isCurrent && (
                <Text color="green" dimColor={!isSelected}>
                  {" ← current"}
                </Text>
              )}
            </Box>
          );
        })}

        {hiddenBelow > 0 && (
          <Box>
            <Box width={2}>
              <Text color="gray" dimColor>↓</Text>
            </Box>
            <Text color="gray" dimColor>
              {hiddenBelow} more below
            </Text>
          </Box>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate · pgup/pgdn page · enter select · esc cancel
          {total > 0 ? `  ·  ${selected + 1}/${total}` : ""}
        </Text>
      </Box>
    </Box>
  );
}
