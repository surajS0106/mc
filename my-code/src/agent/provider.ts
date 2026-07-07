import type {
  ChatMessage,
  ProviderStreamChunk,
  ToolSchema,
} from "./types.js";
import type { QuotaStatus } from "./quota.js";

export interface ChatStreamOptions {
  model: string;
  messages: ChatMessage[];
  tools?: ToolSchema[];
  signal?: AbortSignal;
  options?: {
    temperature?: number;
    num_ctx?: number;
    num_predict?: number;
    seed?: number;
  };
  /** Reasoning/thinking mode for models that support it. */
  think?: boolean;
}

export interface ModelInfo {
  name: string;
  contextLength?: number;
  parameterSize?: string;
  family?: string;
}

export interface ProviderInfo {
  /** Provider id: "ollama", "openai", "gemini", … */
  name: string;
  /** Endpoint base URL (display only; some providers won't have one). */
  host?: string;
  /** True if calls go to a remote/paid endpoint rather than local. */
  isCloud: boolean;
}

/**
 * The single seam every provider implements. QueryEngine talks to this — it
 * does not know about Ollama, OpenAI, or Gemini directly.
 */
export interface ChatProvider {
  readonly info: ProviderInfo;

  streamChat(opts: ChatStreamOptions): AsyncGenerator<ProviderStreamChunk>;

  /** List models the provider has available. May throw if endpoint unreachable. */
  listModels(): Promise<string[]>;

  /** Optional metadata fetch (context length, etc.). May not be supported by all providers. */
  getModelInfo?(model: string): Promise<ModelInfo>;

  /** True if the model supports a "thinking" / reasoning mode (qwen3, deepseek-r1, o1, …). */
  supportsThinking(model: string): boolean;

  /** Strip provider-specific reasoning markers (e.g. <think>...</think>) from streamed text. */
  stripThinkingTags(text: string): string;

  /**
   * Optional: probe remaining quota / rate-limit for this provider's current
   * credentials. Used by the accounts overlay. May make a lightweight request.
   */
  getQuota?(): Promise<QuotaStatus>;
}
