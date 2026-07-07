import React, { useMemo } from "react";
import { Box, Static, Text } from "ink";
import type { TranscriptItem } from "./types.js";
import type { ChatProvider } from "../agent/provider.js";
import { MessageBlock } from "./MessageBlock.js";
import { Banner } from "./Banner.js";

/**
 * Bounded transcript renderer. Ink's <Static> only renders each item once
 * (it emits to the scrollback and doesn't re-render), so React reconciliation
 * cost scales with *new* items, not total items. The concern is the JS array
 * itself: passing a 10k-element array on every render still allocates.
 *
 * So we window the logical list: keep the first-ever banner and the most
 * recent `window` items. Items dropped from the middle get collapsed into a
 * single "… N older messages truncated" marker so the user knows they're gone.
 *
 * The truncation marker is rendered inside the Static list so it scrolls with
 * the rest; once past the viewport, terminal scrollback preserves the full
 * history anyway.
 */
interface Props {
  finalized: TranscriptItem[];
  bannerProps: {
    model: string;
    cwd: string;
    provider: ChatProvider;
    bypassAll: boolean;
    modelOrigin?: string;
    branch?: string;
    version: string;
  };
  /** Max number of finalized items to keep in the React list. */
  window?: number;
}

export function VirtualMessageList({
  finalized,
  bannerProps,
  window = 500,
}: Props): React.ReactElement {
  const items = useMemo<Array<TranscriptItem | { kind: "__banner" } | { kind: "__gap"; count: number; id: string }>>(
    () => {
      if (finalized.length <= window) {
        return [{ kind: "__banner" }, ...finalized];
      }
      const dropped = finalized.length - window;
      return [
        { kind: "__banner" },
        { kind: "__gap", count: dropped, id: `gap-${dropped}` },
        ...finalized.slice(-window),
      ];
    },
    [finalized, window]
  );

  return (
    <Static items={items}>
      {(item, index) => {
        if (item.kind === "__banner") {
          return <Banner key="banner" {...bannerProps} />;
        }
        if (item.kind === "__gap") {
          return (
            <Box key={item.id} marginY={0}>
              <Text dimColor>
                … {item.count} older message{item.count === 1 ? "" : "s"} hidden (see terminal scrollback)
              </Text>
            </Box>
          );
        }
        return <MessageBlock key={(item as TranscriptItem).id ?? index} item={item as TranscriptItem} />;
      }}
    </Static>
  );
}
