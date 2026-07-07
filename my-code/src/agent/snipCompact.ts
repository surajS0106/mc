/**
 * Snip compaction — the lightest tier of context compression.
 * 
 * Instead of summarizing (expensive LLM call), snip just truncates
 * large tool outputs in-place. This preserves conversation structure
 * while freeing tokens.
 *
 * Modeled after beta's services/compact/snipCompact.ts
 */

import type { ChatMessage } from "../agent/types.js";

/** Maximum characters for a tool result after snipping. */
const SNIP_THRESHOLD = 4_000;

/** Tool results above this are candidates for microcompact (more aggressive). */
const MICROCOMPACT_THRESHOLD = 1_500;

/**
 * Snip: truncate oversized tool results in the message history.
 * Returns the number of messages that were snipped.
 */
export function snipToolOutputs(
  messages: ChatMessage[],
  opts?: { threshold?: number; preserveTail?: number }
): { messages: ChatMessage[]; snippedCount: number } {
  const threshold = opts?.threshold ?? SNIP_THRESHOLD;
  const preserveTail = opts?.preserveTail ?? 4;
  let snippedCount = 0;

  const result = messages.map((msg, i) => {
    // Don't snip system messages, recent messages, or short messages
    if (msg.role !== "tool") return msg;
    if (i >= messages.length - preserveTail) return msg;
    if (msg.content.length <= threshold) return msg;

    snippedCount++;
    const kept = msg.content.slice(0, threshold);
    const droppedChars = msg.content.length - threshold;
    return {
      ...msg,
      content: kept + `\n\n[...snipped ${droppedChars} characters]`,
    };
  });

  return { messages: result, snippedCount };
}

/**
 * Microcompact: more aggressive inline compression.
 * Replaces tool outputs with compact summaries (first/last lines + stats).
 */
export function microcompactToolOutputs(
  messages: ChatMessage[],
  opts?: { threshold?: number; preserveTail?: number }
): { messages: ChatMessage[]; compactedCount: number } {
  const threshold = opts?.threshold ?? MICROCOMPACT_THRESHOLD;
  const preserveTail = opts?.preserveTail ?? 4;
  let compactedCount = 0;

  const result = messages.map((msg, i) => {
    if (msg.role !== "tool") return msg;
    if (i >= messages.length - preserveTail) return msg;
    if (msg.content.length <= threshold) return msg;

    compactedCount++;
    const lines = msg.content.split("\n");
    const firstLines = lines.slice(0, 5).join("\n");
    const lastLines = lines.slice(-3).join("\n");

    return {
      ...msg,
      content: `${firstLines}\n\n[...${lines.length - 8} lines omitted (${msg.content.length} chars total)]\n\n${lastLines}`,
    };
  });

  return { messages: result, compactedCount };
}

/**
 * Collapse consecutive read/search tool results into summaries.
 * Groups of 3+ consecutive read-only tool calls get collapsed.
 */
export function collapseReadSearchGroups(
  messages: ChatMessage[],
  opts?: { minGroupSize?: number; preserveTail?: number }
): { messages: ChatMessage[]; collapsedGroups: number } {
  const minGroupSize = opts?.minGroupSize ?? 3;
  const preserveTail = opts?.preserveTail ?? 6;
  const readToolNames = new Set(["Read", "Grep", "Glob", "WebFetch", "WebSearch"]);

  // Don't touch the tail
  const safeEnd = Math.max(0, messages.length - preserveTail);
  let collapsedGroups = 0;
  const result: ChatMessage[] = [];

  let i = 0;
  while (i < messages.length) {
    if (i >= safeEnd) {
      result.push(messages[i]!);
      i++;
      continue;
    }

    // Look for a group of consecutive tool results from read-only tools
    const groupStart = i;
    const groupTools: string[] = [];
    while (
      i < safeEnd &&
      messages[i]!.role === "tool" &&
      messages[i]!.tool_name &&
      readToolNames.has(messages[i]!.tool_name!)
    ) {
      groupTools.push(messages[i]!.tool_name!);
      i++;
    }

    if (groupTools.length >= minGroupSize) {
      // Collapse the group into a single summary message
      collapsedGroups++;
      const toolCounts = new Map<string, number>();
      for (const t of groupTools) {
        toolCounts.set(t, (toolCounts.get(t) ?? 0) + 1);
      }
      const summary = Array.from(toolCounts.entries())
        .map(([name, count]) => `${name}×${count}`)
        .join(", ");

      result.push({
        role: "tool",
        tool_name: "system",
        content: `[Collapsed ${groupTools.length} read-only tool results: ${summary}]`,
      });
    } else {
      // Not a big enough group — keep them
      for (let j = groupStart; j < i; j++) {
        result.push(messages[j]!);
      }
      if (i === groupStart) {
        result.push(messages[i]!);
        i++;
      }
    }
  }

  return { messages: result, collapsedGroups };
}

/**
 * Estimate token count for a message array (rough: 1 token ≈ 4 chars).
 */
export function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    chars += msg.content.length;
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        chars += JSON.stringify(tc.function.arguments).length;
      }
    }
  }
  return Math.ceil(chars / 4);
}
