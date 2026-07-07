/**
 * Compat shim — the Ollama-specific provider has moved to
 * `./providers/ollama.ts` and provider-neutral types live in `./types.ts`.
 *
 * This file is kept only so older imports keep resolving. New code should
 * import from `./types.js` or `./providers/ollama.js` directly.
 */

export type { ChatMessage, ToolCall, ProviderStreamChunk, ToolSchema } from "./types.js";
export type { ModelInfo } from "./provider.js";
export { OllamaProvider } from "./providers/ollama.js";

import { OllamaProvider } from "./providers/ollama.js";
import type { ChatStreamOptions } from "./provider.js";
import type { ProviderStreamChunk } from "./types.js";

/** @deprecated Use `getProvider("ollama").streamChat(...)` instead. */
export async function* streamChat(
  opts: ChatStreamOptions & { host?: string; apiKey?: string }
): AsyncGenerator<ProviderStreamChunk> {
  const provider = new OllamaProvider({ host: opts.host, apiKey: opts.apiKey });
  for await (const chunk of provider.streamChat(opts)) yield chunk;
}

/** @deprecated Use `getProvider("ollama").listModels()` instead. */
export async function listModels(host?: string, apiKey?: string): Promise<string[]> {
  return new OllamaProvider({ host, apiKey }).listModels();
}

/** @deprecated Use `getProvider("ollama").getModelInfo(model)` instead. */
export async function getModelInfo(model: string, host?: string, apiKey?: string) {
  return new OllamaProvider({ host, apiKey }).getModelInfo(model);
}

/** @deprecated Use `provider.supportsThinking(model)` instead. */
export function isReasoningModel(model: string): boolean {
  return new OllamaProvider().supportsThinking(model);
}

/** @deprecated Use `provider.stripThinkingTags(text)` instead. */
export function stripThinkingTags(s: string): string {
  return new OllamaProvider().stripThinkingTags(s);
}

// Legacy alias for the schema shape (now `ToolSchema` in types.ts).
export type { ToolSchema as OllamaTool } from "./types.js";
