import type {
  ChatProvider,
  ChatStreamOptions,
  ModelInfo,
  ProviderInfo,
} from "../provider.js";
import type { ChatMessage, ProviderStreamChunk, ToolCall } from "../types.js";
import type { QuotaStatus } from "../quota.js";

/**
 * Azure OpenAI / AI Foundry provider (deployment-based chat completions API).
 *
 * Calls  {endpoint}/openai/deployments/{deployment}/chat/completions?api-version=…
 * with an `api-key` header. The wire format is OpenAI's Server-Sent-Events stream,
 * which differs from Ollama's NDJSON in two ways we normalize here:
 *   1. Events are `data: {json}` lines (with a trailing `data: [DONE]`).
 *   2. Tool calls arrive as *fragments* keyed by an `index`, with the argument
 *      JSON streamed a few characters at a time. We accumulate those fragments
 *      and emit one complete, parsed tool_calls array on the terminal chunk —
 *      because QueryEngine expects `function.arguments` as an object, not a
 *      partial string.
 */

interface AzureFoundryOpts {
  /** Azure OpenAI resource base URL, e.g. https://my-res.openai.azure.com */
  endpoint?: string;
  apiKey?: string;
  /** Deployment name — goes in the URL path (this is what actually selects the model). */
  deployment?: string;
  /** REST API version query param. */
  apiVersion?: string;
  /** Underlying model name (display + thinking detection only). */
  model?: string;
}

const DEFAULT_API_VERSION = "2024-10-21";

/** Serialize an internal ChatMessage into OpenAI chat-completions wire shape. */
function toOpenAIMessage(m: ChatMessage): Record<string, unknown> {
  const out: Record<string, unknown> = { role: m.role, content: m.content ?? "" };
  if (m.role === "tool" && m.tool_call_id) out.tool_call_id = m.tool_call_id;
  if (m.tool_calls && m.tool_calls.length) {
    out.tool_calls = m.tool_calls.map((tc, i) => ({
      id: tc.id ?? `call_${i}`,
      type: "function",
      function: {
        name: tc.function.name,
        // Internal args are objects; OpenAI wants a JSON string.
        arguments:
          typeof tc.function.arguments === "string"
            ? tc.function.arguments
            : JSON.stringify(tc.function.arguments ?? {}),
      },
    }));
  }
  return out;
}

/** OpenAI streaming delta shape (only the fields we read). */
interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

export class AzureFoundryProvider implements ChatProvider {
  readonly info: ProviderInfo;
  private endpoint: string;
  private apiKey?: string;
  private deployment?: string;
  private apiVersion: string;
  private model?: string;

  constructor(opts: AzureFoundryOpts = {}) {
    this.endpoint = (opts.endpoint ?? "").replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.deployment = opts.deployment;
    this.apiVersion = opts.apiVersion || DEFAULT_API_VERSION;
    this.model = opts.model;
    this.info = {
      name: "azure-foundry",
      host: this.endpoint || undefined,
      isCloud: true,
    };
  }

  /**
   * Build the chat/completions URL, tolerating the several shapes an Azure
   * endpoint comes in:
   *   https://res.openai.azure.com                              (bare resource)
   *   https://res.cognitiveservices.azure.com/openai           (Foundry, ends in /openai)
   *   https://res…/openai/deployments/<dep>                     (already deployment-scoped)
   *   https://res…/openai/deployments/<dep>/chat/completions    (fully qualified)
   */
  private chatUrl(deployment: string): string {
    const base = this.endpoint;
    let url: string;
    if (/\/chat\/completions/.test(base)) {
      url = base;
    } else if (/\/deployments\//.test(base)) {
      url = `${base}/chat/completions`;
    } else {
      // Strip a trailing /openai so we don't end up with /openai/openai/…
      const root = base.replace(/\/openai$/, "");
      url = `${root}/openai/deployments/${deployment}/chat/completions`;
    }
    if (!/[?&]api-version=/.test(url)) {
      url += (url.includes("?") ? "&" : "?") + `api-version=${this.apiVersion}`;
    }
    return url;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["api-key"] = this.apiKey;
    return h;
  }

  async *streamChat(opts: ChatStreamOptions): AsyncGenerator<ProviderStreamChunk> {
    const deployment = this.deployment ?? opts.model;
    if (!this.endpoint) throw new Error("Azure Foundry: no endpoint configured (set the resource base URL).");
    if (!deployment) throw new Error("Azure Foundry: no deployment configured.");
    if (!this.apiKey) throw new Error("Azure Foundry: no API key configured.");

    const body: Record<string, unknown> = {
      messages: opts.messages.map(toOpenAIMessage),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (opts.tools && opts.tools.length) {
      body.tools = opts.tools;
      body.tool_choice = "auto";
    }
    if (opts.options?.temperature !== undefined) body.temperature = opts.options.temperature;
    if (opts.options?.num_predict !== undefined) body.max_completion_tokens = opts.options.num_predict;
    if (opts.options?.seed !== undefined) body.seed = opts.options.seed;

    let res: Response;
    try {
      res = await fetch(this.chatUrl(deployment), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (e: unknown) {
      if (opts.signal?.aborted) return;
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Cannot reach Azure OpenAI at ${this.endpoint}. (${msg})`);
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      let detail = text;
      try {
        const j = JSON.parse(text) as { error?: { message?: string } };
        if (j?.error?.message) detail = j.error.message;
      } catch {}
      throw new Error(`Azure OpenAI HTTP ${res.status}: ${detail}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // Accumulators for the streamed tool-call fragments, keyed by choice index.
    const toolAccum = new Map<number, { id?: string; name?: string; args: string }>();
    let finishReason: string | undefined;
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    const handleParsed = function* (
      this: AzureFoundryProvider,
      chunk: OpenAIStreamChunk
    ): Generator<ProviderStreamChunk> {
      if (chunk.usage) {
        if (typeof chunk.usage.prompt_tokens === "number") promptTokens = chunk.usage.prompt_tokens;
        if (typeof chunk.usage.completion_tokens === "number") completionTokens = chunk.usage.completion_tokens;
      }
      const choice = chunk.choices?.[0];
      if (!choice) return;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta;
      if (!delta) return;
      if (delta.reasoning_content) {
        yield { message: { role: "assistant", content: "", thinking: delta.reasoning_content }, done: false };
      }
      if (delta.content) {
        yield { message: { role: "assistant", content: delta.content }, done: false };
      }
      for (const tc of delta.tool_calls ?? []) {
        const cur = toolAccum.get(tc.index) ?? { args: "" };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name = tc.function.name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        toolAccum.set(tc.index, cur);
      }
    }.bind(this);

    try {
      while (true) {
        if (opts.signal?.aborted) {
          await reader.cancel().catch(() => {});
          return;
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const raw = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!raw || !raw.startsWith("data:")) continue;
          const payload = raw.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            yield* handleParsed(JSON.parse(payload) as OpenAIStreamChunk);
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // already released
      }
    }

    // Emit the terminal chunk: complete tool calls (args parsed to objects) + usage.
    const tool_calls: ToolCall[] = [...toolAccum.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, t]) => {
        let args: Record<string, unknown> = {};
        try {
          args = t.args ? (JSON.parse(t.args) as Record<string, unknown>) : {};
        } catch {
          args = {};
        }
        return { id: t.id, function: { name: t.name ?? "", arguments: args } };
      });

    yield {
      message: tool_calls.length ? { role: "assistant", content: "", tool_calls } : undefined,
      done: true,
      done_reason: finishReason,
      prompt_eval_count: promptTokens,
      eval_count: completionTokens,
    };
  }

  async listModels(): Promise<string[]> {
    // Azure has no public per-key model list; the deployment IS the callable unit.
    const id = this.model || this.deployment;
    return id ? [id] : [];
  }

  async getModelInfo(model: string): Promise<ModelInfo> {
    const m = (this.model || model).toLowerCase();
    // Best-effort context windows for common Azure OpenAI models.
    let contextLength: number | undefined;
    if (m.includes("gpt-4.1")) contextLength = 1_047_576;
    else if (m.includes("gpt-5")) contextLength = 400_000;
    else if (m.includes("o1") || m.includes("o3")) contextLength = 200_000;
    else if (m.includes("gpt-4o") || m.includes("gpt-4-turbo")) contextLength = 128_000;
    return { name: model, contextLength };
  }

  supportsThinking(model: string): boolean {
    const m = (this.model || model).toLowerCase();
    return (
      m.includes("o1") ||
      m.includes("o3") ||
      m.includes("gpt-5") ||
      m.includes("deepseek-r1") ||
      m.includes("reasoning")
    );
  }

  stripThinkingTags(s: string): string {
    return s.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<think>[\s\S]*$/g, "");
  }

  async getQuota(): Promise<QuotaStatus> {
    // Azure exposes usage/limits per-resource in the portal, not via a simple key probe.
    if (!this.apiKey) return { available: false, summary: "no key" };
    return { available: true, summary: "usage → portal.azure.com" };
  }
}
