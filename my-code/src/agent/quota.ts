/**
 * Per-account quota / rate-limit status.
 *
 * Providers expose remaining quota almost exclusively through rate-limit
 * *response headers* (Anthropic `anthropic-ratelimit-*`, Azure/OpenAI
 * `x-ratelimit-*`), not a dedicated endpoint. `parseRateLimitHeaders` turns a
 * fetch Response's headers into a one-line summary the accounts overlay renders.
 * Reusable by every provider's getQuota().
 */

export interface QuotaStatus {
  /** false => no quota info available / not applicable (e.g. local Ollama). */
  available: boolean;
  /** Compact one-line summary for the overlay row. */
  summary: string;
  /** Optional structured fields (requests/tokens/reset) for future detail views. */
  detail?: Record<string, string>;
}

function fmtNum(n: string | null): string | null {
  if (n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return n;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(v);
}

function fmtReset(secs: string | null): string | null {
  if (secs == null) return null;
  const v = Number(secs);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 3600) return `${Math.round(v / 3600)}h`;
  if (v >= 60) return `${Math.round(v / 60)}m`;
  return `${Math.round(v)}s`;
}

/**
 * Recognize Anthropic and Azure/OpenAI rate-limit headers. Returns null when no
 * known headers are present (caller decides what to show then).
 */
export function parseRateLimitHeaders(h: Headers): QuotaStatus | null {
  const retryAfter = h.get("retry-after");

  // --- Anthropic ---
  const aReq = h.get("anthropic-ratelimit-requests-remaining");
  const aIn = h.get("anthropic-ratelimit-input-tokens-remaining");
  const aOut = h.get("anthropic-ratelimit-output-tokens-remaining");
  const aReset = h.get("anthropic-ratelimit-tokens-reset")
    ?? h.get("anthropic-ratelimit-requests-reset");
  if (aReq != null || aIn != null || aOut != null) {
    const parts: string[] = [];
    if (aReq != null) parts.push(`${fmtNum(aReq)} req`);
    const tok = aIn ?? aOut;
    if (tok != null) parts.push(`${fmtNum(tok)} tok`);
    const reset = fmtReset(aReset);
    let summary = parts.join(" · ") + " left";
    if (reset) summary += ` · resets ${reset}`;
    return {
      available: true,
      summary,
      detail: {
        requestsRemaining: aReq ?? "-",
        inputTokensRemaining: aIn ?? "-",
        outputTokensRemaining: aOut ?? "-",
      },
    };
  }

  // --- Azure / OpenAI ---
  const xReq = h.get("x-ratelimit-remaining-requests");
  const xTok = h.get("x-ratelimit-remaining-tokens");
  const xReset = h.get("x-ratelimit-reset-tokens") ?? h.get("x-ratelimit-reset-requests");
  if (xReq != null || xTok != null) {
    const parts: string[] = [];
    if (xReq != null) parts.push(`${fmtNum(xReq)} req`);
    if (xTok != null) parts.push(`${fmtNum(xTok)} tok`);
    const reset = fmtReset(xReset);
    let summary = parts.join(" · ") + " left";
    if (reset) summary += ` · resets ${reset}`;
    return {
      available: true,
      summary,
      detail: {
        requestsRemaining: xReq ?? "-",
        tokensRemaining: xTok ?? "-",
      },
    };
  }

  // --- Ollama Cloud (proposed in ollama/ollama#15663/#15132, not shipped yet) ---
  // Future-proof: if Ollama ever returns these, usage shows automatically.
  const oRem = h.get("x-ollama-quota-remaining");
  const oLim = h.get("x-ollama-quota-limit");
  const oReset = h.get("x-ollama-quota-reset");
  if (oRem != null || oLim != null) {
    let summary = oLim != null ? `${fmtNum(oRem)}/${fmtNum(oLim)} left` : `${fmtNum(oRem)} left`;
    const reset = fmtReset(oReset);
    if (reset) summary += ` · resets ${reset}`;
    return {
      available: true,
      summary,
      detail: { remaining: oRem ?? "-", limit: oLim ?? "-", used: h.get("x-ollama-quota-used") ?? "-" },
    };
  }

  // --- Generic 429 hint ---
  if (retryAfter != null) {
    return { available: true, summary: `rate-limited · retry in ${fmtReset(retryAfter) ?? retryAfter}` };
  }

  return null;
}
