/**
 * Side Query — Phase 27
 *
 * A lightweight, non-streaming LLM call that runs outside the main
 * conversation loop. Used by internal services (session memory, agent summary,
 * compaction prompts) to get a quick answer without polluting the main context.
 *
 * Clean-room port of beta's utils/sideQuery.ts — no OAuth, no fingerprinting,
 * no analytics. Uses our ChatProvider directly via streamChat (collect mode).
 */

import type { ChatProvider, ChatStreamOptions } from "../agent/provider.js";
import type { ChatMessage } from "../agent/types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SideQueryOptions {
  /** Provider to use (inherits from the parent engine) */
  provider: ChatProvider;
  /** Model name */
  model: string;
  /** Optional system prompt prepended as a system message */
  system?: string;
  /** Conversation messages */
  messages: ChatMessage[];
  /** Max tokens to generate (default: 1024) */
  maxTokens?: number;
  /** Abort signal */
  signal?: AbortSignal;
  /** Temperature (0–1, default: provider default) */
  temperature?: number;
  /** Label for debugging/logging */
  label?: string;
}

export interface SideQueryResult {
  /** Text of the first assistant response (empty string if no text was produced) */
  text: string;
  /** Whether the call completed successfully */
  ok: boolean;
  /** Error message if ok is false */
  error?: string;
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Run a lightweight LLM call outside the main conversation.
 * Collects all streamed chunks and returns the final text.
 * Never throws — returns { ok: false, error: ... } on failure.
 */
export async function sideQuery(opts: SideQueryOptions): Promise<SideQueryResult> {
  const {
    provider,
    model,
    system,
    messages,
    maxTokens = 1024,
    signal,
    temperature,
    label = "side_query",
  } = opts;

  // Build message array with optional system prefix
  const fullMessages: ChatMessage[] = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  const streamOpts: ChatStreamOptions = {
    model,
    messages: fullMessages,
    signal,
    options: {
      ...(temperature !== undefined && { temperature }),
      num_predict: maxTokens,
    },
  };

  try {
    let text = "";
    for await (const chunk of provider.streamChat(streamOpts)) {
      if (signal?.aborted) break;
      if (chunk.message?.content) {
        text += chunk.message.content;
      }
    }
    // Strip reasoning tags (e.g. <think>...</think> from qwen3/deepseek)
    const clean = provider.stripThinkingTags(text).trim();
    return { ok: true, text: clean };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Don't log abort errors as failures — they're intentional
    if (signal?.aborted || message.includes("abort") || message.includes("cancel")) {
      return { ok: false, text: "", error: "aborted" };
    }
    return { ok: false, text: "", error: `[${label}] ${message}` };
  }
}

// ─── Convenience: single user message ─────────────────────────────────────────

/**
 * Ask a single question in a fresh context. The most common use case:
 *
 * ```ts
 * const { text } = await askOnce(provider, model, "Summarize this in 1 sentence", content);
 * ```
 */
export async function askOnce(
  provider: ChatProvider,
  model: string,
  prompt: string,
  context?: string,
  signal?: AbortSignal,
): Promise<SideQueryResult> {
  const userContent = context ? `${context}\n\n${prompt}` : prompt;
  return sideQuery({
    provider,
    model,
    messages: [{ role: "user", content: userContent }],
    maxTokens: 512,
    signal,
    label: "ask_once",
  });
}
