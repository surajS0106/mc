/**
 * Provider-neutral types used by QueryEngine and tools.
 *
 * These intentionally mirror Ollama's wire shape (since OpenAI uses the same
 * shape) and are translated at the provider boundary for Gemini / Anthropic if
 * those are added later.
 */

export interface ToolCall {
  id?: string;
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
  tool_call_id?: string;
}

/**
 * Shape sent to a provider's streamChat as the tool catalog. Matches the
 * OpenAI / Ollama function-calling JSON shape; Gemini converts at the boundary.
 */
export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}

/**
 * One chunk from a streaming response. All providers normalize their wire
 * format to this shape before yielding.
 */
export interface ProviderStreamChunk {
  message?: {
    role: string;
    content: string;
    thinking?: string;
    tool_calls?: ToolCall[];
  };
  done: boolean;
  done_reason?: string;
  /** Cumulative input/prompt tokens for the request (terminal chunk only). */
  prompt_eval_count?: number;
  /** Cumulative output tokens for the request (terminal chunk only). */
  eval_count?: number;
}
