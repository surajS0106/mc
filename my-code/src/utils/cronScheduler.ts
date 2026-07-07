/**
 * cronScheduler.ts — In-memory cron job store with a setInterval tick loop.
 *
 * When a job fires, its prompt is injected into enqueuePendingNotification
 * so the LLM picks it up between turns as a <task_notification>.
 *
 * Design notes:
 * - Session-only: no disk persistence (durable mode intentionally omitted)
 * - timer.unref() so crons don't keep the process alive after the user exits
 * - Tick every 10 seconds: jobs fire within 10s of their scheduled time
 * - Rescheduling uses nextRunAt (not Date.now()) to avoid drift
 */

import { randomBytes } from 'node:crypto';
import { enqueuePendingNotification } from './messageQueueManager.js';
import { cronToHuman, nextCronDate } from './cronParser.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CronJob {
  id: string;
  cron: string;
  humanSchedule: string;
  prompt: string;
  recurring: boolean;
  createdAt: number;
  /** Unix ms timestamp of next scheduled fire. */
  nextRunAt: number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const jobs = new Map<string, CronJob>();
let tickTimer: ReturnType<typeof setInterval> | null = null;

export const MAX_JOBS = 50;
const TICK_INTERVAL_MS = 10_000;
const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function generateJobId(): string {
  const bytes = randomBytes(6);
  let id = 'c';
  for (let i = 0; i < 6; i++) {
    id += ID_ALPHABET[bytes[i]! % ID_ALPHABET.length];
  }
  return id;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** List all active cron jobs, sorted by next run time (soonest first). */
export function listCronJobs(): CronJob[] {
  return [...jobs.values()].sort((a, b) => a.nextRunAt - b.nextRunAt);
}

/** Get a single cron job by ID. */
export function getCronJob(id: string): CronJob | undefined {
  return jobs.get(id);
}

/** Number of currently registered jobs. */
export function getCronJobCount(): number {
  return jobs.size;
}

/**
 * Register a new cron job.
 * Throws if the expression is invalid or has no match within one year.
 */
export function addCronJob(
  cron: string,
  prompt: string,
  recurring = true,
): CronJob {
  const nextRun = nextCronDate(cron, Date.now());
  if (!nextRun) {
    throw new Error(
      `Cron expression '${cron}' does not match any date in the next year.`,
    );
  }

  const job: CronJob = {
    id: generateJobId(),
    cron,
    humanSchedule: cronToHuman(cron),
    prompt,
    recurring,
    createdAt: Date.now(),
    nextRunAt: nextRun.getTime(),
  };

  jobs.set(job.id, job);
  startTick();
  return job;
}

/**
 * Cancel and remove a cron job by ID.
 * Returns true if the job existed and was removed.
 */
export function removeCronJob(id: string): boolean {
  const existed = jobs.delete(id);
  if (jobs.size === 0) stopTick();
  return existed;
}

// ─── Tick loop ────────────────────────────────────────────────────────────────

function startTick(): void {
  if (tickTimer !== null) return; // already running
  tickTimer = setInterval(tick, TICK_INTERVAL_MS);
  // Don't hold the event loop open just for crons
  tickTimer.unref?.();
}

function stopTick(): void {
  if (tickTimer !== null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function tick(): void {
  const now = Date.now();

  for (const [id, job] of jobs) {
    if (job.nextRunAt > now) continue;

    // Fire — inject as a task notification so the LLM picks it up between turns
    enqueuePendingNotification({
      value: [
        '<task_notification>',
        `<task_id>${id}</task_id>`,
        `<summary>Scheduled cron "${job.humanSchedule}" fired. Please act on the following prompt.</summary>`,
        `<prompt>${job.prompt}</prompt>`,
        '</task_notification>',
      ].join('\n'),
      mode: 'task-notification',
    });

    if (job.recurring) {
      // Advance from nextRunAt (not now) to prevent drift
      const next = nextCronDate(job.cron, job.nextRunAt);
      if (next) {
        jobs.set(id, { ...job, nextRunAt: next.getTime() });
      } else {
        // Expression no longer valid for the future — remove
        jobs.delete(id);
      }
    } else {
      // One-shot: self-destruct after firing
      jobs.delete(id);
    }
  }

  // Stop the timer if nothing left to watch
  if (jobs.size === 0) stopTick();
}
