import type {
  ChatProvider,
  ChatStreamOptions,
  ModelInfo,
  ProviderInfo,
} from "../provider.js";
import type { ChatMessage, ProviderStreamChunk } from "../types.js";
import { parseRateLimitHeaders, type QuotaStatus } from "../quota.js";
import { quotaKey, recordQuota, clearQuota, getRecordedQuota } from "../quotaCache.js";

interface OllamaProviderOpts {
  host?: string;
  apiKey?: string;
}

const DEFAULT_HOST = "http://localhost:11434";

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = apiKey ?? process.env.OLLAMA_API_KEY;
  if (key) headers["Authorization"] = `Bearer ${key}`;
  return headers;
}

function cleanMessage(m: ChatMessage) {
  const out: Record<string, unknown> = { role: m.role, content: m.content };
  if (m.tool_calls && m.tool_calls.length) out.tool_calls = m.tool_calls;
  if (m.tool_name) out.tool_name = m.tool_name;
  return out;
}

export class OllamaProvider implements ChatProvider {
  readonly info: ProviderInfo;
  private host: string;
  private apiKey?: string;

  constructor(opts: OllamaProviderOpts = {}) {
    this.host = opts.host ?? DEFAULT_HOST;
    this.apiKey = opts.apiKey;
    this.info = {
      name: "ollama",
      host: this.host,
      isCloud: this.host.includes("ollama.com"),
    };
  }

  async *streamChat(opts: ChatStreamOptions): AsyncGenerator<ProviderStreamChunk> {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages.map(cleanMessage),
      tools: opts.tools && opts.tools.length ? opts.tools : undefined,
      stream: true,
      options: opts.options,
    };
    if (opts.think !== undefined) body.think = opts.think;

    let res: Response;
    try {
      res = await fetch(`${this.host}/api/chat`, {
        method: "POST",
        headers: buildHeaders(this.apiKey),
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (e: unknown) {
      if (opts.signal?.aborted) return;
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Cannot reach Ollama at ${this.host}. Is it running? (${msg})`);
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) {
        // Ollama cloud only reports usage limits here (no quota headers/endpoint).
        // Extract the human message and record it so the accounts overlay can show it.
        let msg = text;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {}
        recordQuota(quotaKey(this.host, this.apiKey), {
          available: false,
          summary: "⚠ session limit reached — upgrade",
          detail: { error: msg },
        });
        throw new Error(`Ollama: ${msg}`);
      }
      throw new Error(`Ollama HTTP ${res.status}: ${text}`);
    }

    // Successful call — clear any stale "limit reached" note for this account.
    clearQuota(quotaKey(this.host, this.apiKey));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

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
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          try {
            yield JSON.parse(line) as ProviderStreamChunk;
          } catch {
            // malformed line — skip
          }
        }
      }
      const tail = buffer.trim();
      if (tail) {
        try {
          yield JSON.parse(tail) as ProviderStreamChunk;
        } catch {
          // malformed trailing fragment — skip
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // already released
      }
    }
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.host}/api/tags`, {
      headers: buildHeaders(this.apiKey),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`Ollama /api/tags returned ${res.status}`);
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((m) => m.name);
  }

  async getModelInfo(model: string): Promise<ModelInfo> {
    const res = await fetch(`${this.host}/api/show`, {
      method: "POST",
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`Ollama /api/show returned ${res.status}`);
    const data = (await res.json()) as {
      model_info?: Record<string, unknown>;
      details?: { parameter_size?: string; family?: string };
    };
    const info = data.model_info ?? {};
    let ctx: number | undefined;
    for (const [k, v] of Object.entries(info)) {
      if (k.endsWith(".context_length") && typeof v === "number") {
        ctx = v;
        break;
      }
    }
    return {
      name: model,
      contextLength: ctx,
      parameterSize: data.details?.parameter_size,
      family: data.details?.family,
    };
  }

  async getQuota(): Promise<QuotaStatus> {
    // Local Ollama has no quota/rate-limit system.
    if (!this.info.isCloud) return { available: false, summary: "N/A (local)" };
    // If this account recently hit its session limit, surface that — it's the
    // only real usage signal Ollama cloud gives (in the 429 body of a chat call).
    const recorded = getRecordedQuota(quotaKey(this.host, this.apiKey));
    if (recorded) return recorded;
    try {
      const res = await fetch(`${this.host}/api/tags`, {
        headers: buildHeaders(this.apiKey),
        signal: AbortSignal.timeout(5_000),
      });
      const parsed = parseRateLimitHeaders(res.headers);
      if (parsed) return parsed;
      if (res.status === 401 || res.status === 403) {
        return { available: false, summary: "⚠ auth failed" };
      }
      if (!res.ok) return { available: false, summary: `HTTP ${res.status}` };
      // Ollama cloud exposes no remaining-usage endpoint/headers (ollama/ollama#15663).
      // Real usage lives on the dashboard; we only learn the limit when it 429s.
      return { available: false, summary: "usage → ollama.com/settings (no API)" };
    } catch {
      return { available: false, summary: "⚠ probe failed" };
    }
  }

  supportsThinking(model: string): boolean {
    const m = model.toLowerCase();
    return (
      m.includes("deepseek-r1") ||
      m.includes("qwen3") ||
      m.includes("qwq") ||
      m.includes("o1") ||
      m.includes("gpt-oss") ||
      m.includes("magistral") ||
      m.includes("glm") ||
      m.includes("reasoning") ||
      m.includes("thinking")
    );
  }

  stripThinkingTags(s: string): string {
    return s.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<think>[\s\S]*$/g, "");
  }
}
