/**
 * Retry utility with exponential backoff + jitter.
 * Modeled after the beta's recovery strategies for API calls.
 */

export interface RetryOptions {
  /** Max number of attempts (including the first). Default: 3. */
  maxAttempts?: number;
  /** Base delay in ms before the first retry. Default: 1000. */
  baseDelayMs?: number;
  /** Maximum delay in ms (caps the exponential growth). Default: 30000. */
  maxDelayMs?: number;
  /** Jitter factor 0–1 to randomize delays. Default: 0.3. */
  jitter?: number;
  /** Optional abort signal to cancel retries. */
  signal?: AbortSignal;
  /** Called before each retry with the error and attempt number. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** Predicate: return true if this error is retryable. Default: retries everything. */
  isRetryable?: (error: unknown) => boolean;
}

/**
 * Known error categories from LLM APIs.
 */
export type ApiErrorKind =
  | "rate_limit"       // 429 — back off and retry
  | "prompt_too_long"  // context overflow — need to compact
  | "network"          // fetch failed, ECONNRESET, etc.
  | "server"           // 5xx
  | "auth"             // 401/403 — do NOT retry
  | "unknown";

/**
 * Classify an error into a known category.
 */
export function classifyApiError(error: unknown): ApiErrorKind {
  if (!(error instanceof Error)) return "unknown";
  const msg = error.message.toLowerCase();

  // Rate limits
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests")) {
    return "rate_limit";
  }
  // Context overflow
  if (
    msg.includes("prompt is too long") ||
    msg.includes("context length") ||
    msg.includes("maximum context") ||
    msg.includes("too long") ||
    msg.includes("token limit")
  ) {
    return "prompt_too_long";
  }
  // Auth
  if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("forbidden")) {
    return "auth";
  }
  // Server errors
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("internal server error")) {
    return "server";
  }
  // Network
  if (
    msg.includes("fetch") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("network") ||
    msg.includes("socket")
  ) {
    return "network";
  }
  return "unknown";
}

/**
 * Default retryable check: retry rate_limit, network, and server errors.
 * Do NOT retry auth or prompt_too_long (those need different handling).
 */
export function isDefaultRetryable(error: unknown): boolean {
  const kind = classifyApiError(error);
  return kind === "rate_limit" || kind === "network" || kind === "server";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    }, { once: true });
  });
}

/**
 * Execute `fn` with automatic retries on transient failures.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    jitter = 0.3,
    signal,
    onRetry,
    isRetryable = isDefaultRetryable,
  } = opts;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (signal?.aborted) throw error;
      if (attempt >= maxAttempts) throw error;
      if (!isRetryable(error)) throw error;

      // Exponential backoff: baseDelay * 2^(attempt-1) + jitter
      const exponential = baseDelayMs * Math.pow(2, attempt - 1);
      const jitterMs = exponential * jitter * Math.random();
      const delayMs = Math.min(exponential + jitterMs, maxDelayMs);

      onRetry?.(error, attempt, delayMs);
      await sleep(delayMs, signal);
    }
  }

  throw lastError;
}
