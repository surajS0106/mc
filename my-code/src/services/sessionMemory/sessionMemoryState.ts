/**
 * Session Memory Utility State
 *
 * Pure state module — no imports that would create circular dependencies.
 * Tracks extraction state, thresholds, and the ID of the last summarized message.
 *
 * Ported from beta's services/SessionMemory/sessionMemoryUtils.ts
 */

export interface SessionMemoryConfig {
  /** Minimum estimated tokens in conversation before first extraction */
  minimumTokensToInit: number;
  /** Minimum token growth between extractions */
  minimumTokensBetweenUpdate: number;
  /** Minimum tool calls between extractions */
  toolCallsBetweenUpdates: number;
}

export const DEFAULT_SESSION_MEMORY_CONFIG: SessionMemoryConfig = {
  minimumTokensToInit: 10_000,
  minimumTokensBetweenUpdate: 5_000,
  toolCallsBetweenUpdates: 3,
};

// ─── Module-level state ───────────────────────────────────────────────────────

let config: SessionMemoryConfig = { ...DEFAULT_SESSION_MEMORY_CONFIG };

/** UUID of the last message that was included in a successful extraction. */
let lastSummarizedMessageId: string | undefined;

/** Timestamp set when extraction begins; cleared when done. */
let extractionStartedAt: number | undefined;

/** Estimated token count at the time of the last extraction. */
let tokensAtLastExtraction = 0;

/** True once the initialization threshold (minimumTokensToInit) has been met. */
let initialized = false;

// ─── Config ──────────────────────────────────────────────────────────────────

export function getSessionMemoryConfig(): SessionMemoryConfig {
  return { ...config };
}

export function setSessionMemoryConfig(
  partial: Partial<SessionMemoryConfig>
): void {
  config = { ...config, ...partial };
}

// ─── Threshold helpers ────────────────────────────────────────────────────────

export function hasMetInitThreshold(currentTokens: number): boolean {
  return currentTokens >= config.minimumTokensToInit;
}

export function hasMetUpdateThreshold(currentTokens: number): boolean {
  return currentTokens - tokensAtLastExtraction >= config.minimumTokensBetweenUpdate;
}

export function getToolCallsBetweenUpdates(): number {
  return config.toolCallsBetweenUpdates;
}

// ─── Initialization state ─────────────────────────────────────────────────────

export function isSessionMemoryInitialized(): boolean {
  return initialized;
}

export function markSessionMemoryInitialized(): void {
  initialized = true;
}

// ─── Extraction lifecycle ─────────────────────────────────────────────────────

export function markExtractionStarted(): void {
  extractionStartedAt = Date.now();
}

export function markExtractionCompleted(): void {
  extractionStartedAt = undefined;
}

/** True if an extraction is currently running. */
export function isExtractionInProgress(): boolean {
  if (!extractionStartedAt) return false;
  // Consider stale after 60 seconds
  return Date.now() - extractionStartedAt < 60_000;
}

/** Wait (poll) for any in-progress extraction to complete (max 15 s). */
export async function waitForExtractionDone(): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (isExtractionInProgress() && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 500));
  }
}

export function recordExtractionTokenCount(tokens: number): void {
  tokensAtLastExtraction = tokens;
}

// ─── Last summarized message ──────────────────────────────────────────────────

export function getLastSummarizedMessageId(): string | undefined {
  return lastSummarizedMessageId;
}

export function setLastSummarizedMessageId(id: string | undefined): void {
  lastSummarizedMessageId = id;
}

// ─── Reset (new session / testing) ───────────────────────────────────────────

export function resetSessionMemoryState(): void {
  config = { ...DEFAULT_SESSION_MEMORY_CONFIG };
  lastSummarizedMessageId = undefined;
  extractionStartedAt = undefined;
  tokensAtLastExtraction = 0;
  initialized = false;
}
