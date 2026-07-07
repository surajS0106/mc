/**
 * Agent Summary Service — Phase 22
 *
 * Periodically generates a short (3-5 word) progress summary for a running
 * background sub-agent. The summary is stored on the task state for display
 * in /tasks and the UI sidebar.
 *
 * Fires every 30 seconds after the first tick. If the previous summary run
 * is still in progress, the next tick is skipped (no overlapping runs).
 *
 * Ported from beta's services/AgentSummary/agentSummary.ts.
 * Adapted for our architecture: no forkedAgent / GrowthBook dependencies.
 */

import type { SetAppState } from '../../tasks/Task.js';
import { updateTaskState } from '../../utils/task/framework.js';
import type { LocalAgentTaskState } from '../../tasks/LocalAgentTask/LocalAgentTask.js';

/** How often (ms) to re-run the progress summarizer. */
const SUMMARY_INTERVAL_MS = 30_000;

/** Minimum messages required before summarizing. */
const MIN_MESSAGES = 3;

/**
 * Prompt that asks the sub-engine to describe its most recent action in 3-5
 * words using present tense. Mirrors beta's buildSummaryPrompt() exactly.
 */
function buildSummaryPrompt(previousSummary: string | null): string {
  const prevLine = previousSummary
    ? `\nPrevious: "${previousSummary}" — say something NEW.\n`
    : '';

  return `Describe your most recent action in 3-5 words using present tense (-ing). Name the file or function, not the branch. Do not use tools.
${prevLine}
Good: "Reading runAgent.ts"
Good: "Fixing null check in validate.ts"
Good: "Running auth module tests"
Good: "Adding retry logic to fetchUser"

Bad (past tense): "Analyzed the branch diff"
Bad (too vague): "Investigating the issue"
Bad (too long): "Reviewing full branch diff and AgentTool integration"`.trim();
}

/**
 * Update the agent summary text on the task state.
 * Called when the periodic summarizer produces a new phrase.
 */
export function updateAgentSummary(
  taskId: string,
  summary: string,
  setAppState: SetAppState,
): void {
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => ({
    ...task,
    summary,
  }));
}

export interface AgentSummarizationHandle {
  /** Stop the periodic summarizer. Cancels any in-flight run. */
  stop(): void;
  /** Inform the summarizer how many messages the sub-agent has processed so far. */
  notifyMessageCount(count: number): void;
}

/**
 * Start periodic background summarization for a running sub-agent.
 *
 * @param taskId         Task ID (for state updates)
 * @param createSubRun   Factory that creates a one-shot run of the sub-engine
 *                       with the current message history. Returns the first
 *                       assistant text produced (or null on error/abort).
 * @param setAppState    State updater
 * @returns              Handle with a stop() method
 */
export function startAgentSummarization(
  taskId: string,
  createSubRun: (prompt: string) => Promise<string | null>,
  setAppState: SetAppState,
): AgentSummarizationHandle {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let previousSummary: string | null = null;
  let messageCount = 0;

  async function runSummary(): Promise<void> {
    if (stopped || inFlight) return;

    // Need at least MIN_MESSAGES of context
    if (messageCount < MIN_MESSAGES) return;

    inFlight = true;
    try {
      const prompt = buildSummaryPrompt(previousSummary);
      const text = await createSubRun(prompt);
      if (stopped) return;

      if (text && text.trim()) {
        previousSummary = text.trim();
        updateAgentSummary(taskId, previousSummary, setAppState);
      }
    } catch {
      // Errors are non-fatal — next tick will retry
    } finally {
      inFlight = false;
      if (!stopped) scheduleNext();
    }
  }

  function scheduleNext(): void {
    if (stopped) return;
    timeoutId = setTimeout(runSummary, SUMMARY_INTERVAL_MS);
  }

  function stop(): void {
    stopped = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  /** Called by the consumer to update the known message count. */
  function notifyMessageCount(count: number): void {
    messageCount = count;
  }

  // Kick off
  scheduleNext();

  // Expose notifyMessageCount via the handle for the caller to update it
  const handle = { stop, notifyMessageCount };
  return handle;
}
