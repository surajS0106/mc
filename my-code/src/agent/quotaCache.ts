/**
 * In-memory quota notes keyed by (host + key suffix).
 *
 * Some providers — notably Ollama cloud — don't expose remaining quota via
 * headers or a probe endpoint; they only signal the limit in the 429 body of a
 * chat call. We capture that here so the accounts overlay can show a real status
 * ("session limit reached") instead of "no quota info". The key is host+key
 * suffix so a throwaway provider built per-account in the overlay sees the same
 * note the live chat provider recorded.
 */
import type { QuotaStatus } from "./quota.js";

const cache = new Map<string, QuotaStatus>();

export function quotaKey(host: string | undefined, apiKey: string | undefined): string {
  return `${host ?? ""}::${apiKey ? apiKey.slice(-6) : ""}`;
}

export function recordQuota(key: string, status: QuotaStatus): void {
  cache.set(key, status);
}

export function clearQuota(key: string): void {
  cache.delete(key);
}

export function getRecordedQuota(key: string): QuotaStatus | undefined {
  return cache.get(key);
}
