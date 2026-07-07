/**
 * Session Activity Tracker — Phase 28c
 *
 * Tracks active vs idle time per session.
 * Used by /status and session listings to show "active for X minutes".
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityRecord {
  /** Session start time (ms) */
  startedAt: number;
  /** Total milliseconds the user was actively sending messages */
  activeMs: number;
  /** Total milliseconds the session was idle (between turns) */
  idleMs: number;
  /** Number of turns (user messages) */
  turnCount: number;
  /** Timestamp of the last user message */
  lastActivityAt: number;
}

// ─── Idle threshold ───────────────────────────────────────────────────────────

/** Gaps > 5 minutes between turns are considered idle time. */
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

// ─── Tracker class ────────────────────────────────────────────────────────────

export class SessionActivityTracker {
  private record: ActivityRecord;
  private lastTurnAt: number;

  constructor() {
    const now = Date.now();
    this.record = {
      startedAt: now,
      activeMs: 0,
      idleMs: 0,
      turnCount: 0,
      lastActivityAt: now,
    };
    this.lastTurnAt = now;
  }

  /** Called when the user submits a message. */
  recordTurn(): void {
    const now = Date.now();
    const gap = now - this.lastTurnAt;

    if (gap > IDLE_THRESHOLD_MS) {
      this.record.idleMs += gap;
    } else {
      this.record.activeMs += gap;
    }

    this.record.turnCount++;
    this.record.lastActivityAt = now;
    this.lastTurnAt = now;
  }

  /** Get the current activity record (snapshot). */
  getRecord(): ActivityRecord {
    return { ...this.record };
  }

  /** Total elapsed session time in ms. */
  elapsedMs(): number {
    return Date.now() - this.record.startedAt;
  }

  /** Format a compact summary for display. */
  summary(): string {
    const elapsed = this.elapsedMs();
    const active = this.record.activeMs;
    const turns = this.record.turnCount;
    return `${formatDuration(elapsed)} elapsed · ${turns} turn${turns !== 1 ? "s" : ""} · ${formatDuration(active)} active`;
  }
}

// ─── Module-level singleton (one tracker per process) ─────────────────────────

let _tracker: SessionActivityTracker | undefined;

export function getSessionTracker(): SessionActivityTracker {
  return (_tracker ??= new SessionActivityTracker());
}

export function recordTurn(): void {
  getSessionTracker().recordTurn();
}

export function getActivitySummary(): string {
  return getSessionTracker().summary();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}
