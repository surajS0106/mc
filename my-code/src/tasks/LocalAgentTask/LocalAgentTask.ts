/**
 * LocalAgentTask — Background sub-agent task.
 *
 * Mirrors LocalShellTask in structure. SpawnAgentTask() returns immediately
 * with a taskId; the sub-agent runs concurrently. When it finishes, a
 * <task_notification> is injected into the message queue so the LLM is
 * informed on the next turn.
 */
import type { AppState } from '../../state/AppState.js'
import type { SetAppState, Task, TaskHandle, TaskStateBase } from '../Task.js'
import { createTaskStateBase, generateTaskId } from '../Task.js'
import { registerCleanup } from '../../utils/cleanup.js'
import { enqueuePendingNotification } from '../../utils/messageQueueManager.js'
import { getTaskOutputPath } from '../../utils/task/diskOutput.js'
import { registerTask, updateTaskState } from '../../utils/task/framework.js'
import { startAgentSummarization } from '../../services/agentSummary/agentSummary.js'

// ─── State shape ─────────────────────────────────────────────────────────────

export type LocalAgentTaskState = TaskStateBase & {
  type: 'local_agent'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed'
  /** The full prompt sent to the sub-agent. */
  prompt: string
  /** Result text captured from the last assistant message. */
  result?: string
  /** Error message if the agent failed. */
  error?: string
  /** Number of tool calls the sub-agent has made (progress indicator). */
  toolUseCount: number
  /** Short 3-5 word present-tense progress phrase from the Agent Summary Service. */
  summary?: string
  /** Abort controller — call .abort() to kill the running agent. */
  abortController: AbortController
  /** Un-register function from the global cleanup registry. */
  unregisterCleanup: () => void
  /** Always true — agent tasks are always backgrounded. */
  isBackgrounded: true
}

export function isLocalAgentTask(t: unknown): t is LocalAgentTaskState {
  return (
    typeof t === 'object' &&
    t !== null &&
    'type' in t &&
    (t as { type: string }).type === 'local_agent'
  )
}

// ─── Notification ─────────────────────────────────────────────────────────────

function enqueueAgentNotification(
  taskId: string,
  description: string,
  status: 'completed' | 'failed' | 'killed',
  result: string | undefined,
  error: string | undefined,
  toolUseId: string | undefined,
  setAppState: SetAppState,
): void {
  // Deduplicate — only send notification once per task
  let shouldEnqueue = false
  updateTaskState(taskId, setAppState, task => {
    if (task.notified) return task
    shouldEnqueue = true
    return { ...task, notified: true }
  })
  if (!shouldEnqueue) return

  const outputPath = getTaskOutputPath(taskId)
  const summary =
    status === 'completed'
      ? `Agent "${description}" completed`
      : status === 'failed'
        ? `Agent "${description}" failed: ${error ?? 'unknown error'}`
        : `Agent "${description}" was stopped`

  const toolUseIdLine = toolUseId
    ? `\n<tool_use_id>${toolUseId}</tool_use_id>`
    : ''
  const resultSection = result ? `\n<result>${result}</result>` : ''

  const message = [
    '<task_notification>',
    `<task_id>${taskId}</task_id>${toolUseIdLine}`,
    `<output_file>${outputPath}</output_file>`,
    `<status>${status}</status>`,
    `<summary>${summary}</summary>${resultSection}`,
    '</task_notification>',
  ].join('\n')

  enqueuePendingNotification({ value: message, mode: 'task-notification' })
}

// ─── Kill ─────────────────────────────────────────────────────────────────────

export function killAgentTask(taskId: string, setAppState: SetAppState): void {
  let killed = false
  let abortFn: (() => void) | undefined
  let cleanup: (() => void) | undefined

  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running') return task
    killed = true
    abortFn = () => task.abortController.abort()
    cleanup = task.unregisterCleanup
    return {
      ...task,
      status: 'killed',
      endTime: Date.now(),
    }
  })

  if (killed) {
    abortFn?.()
    cleanup?.()
  }
}

// ─── Task registration object (used by task registry in cli.ts) ──────────────

export const LocalAgentTask: Task = {
  name: 'LocalAgentTask',
  type: 'local_agent',
  async kill(taskId, setAppState) {
    killAgentTask(taskId, setAppState)
  },
}

// ─── Spawn ─────────────────────────────────────────────────────────────────────

export interface SpawnAgentTaskInput {
  /** The full prompt to send to the sub-agent. */
  prompt: string
  /** Human-readable label shown in /tasks and notifications. */
  description: string
  /** tool_use_id of the AgentTool call — correlates notification to the call. */
  toolUseId?: string
  /**
   * Factory function that creates the sub-engine.
   * Provided by AgentTool via ctx.createSubEngine().
   * Avoids importing QueryEngine here (circular dependency).
   */
  createSubEngine: (abortController: AbortController) => SubEngineHandle
}

export interface SubEngineHandle {
  /** Submit the prompt and iterate events. */
  run(prompt: string): AsyncIterable<SubEngineEvent>
  /** Retrieve all messages after the run. */
  getMessages(): Array<{ role: string; content: unknown }>
}

export type SubEngineEvent =
  | { type: 'tool_start'; name: string }
  | { type: 'turn_end' }
  | { type: string }

/**
 * Spawn a sub-agent as a background task.
 * Returns a TaskHandle immediately; agent runs concurrently.
 */
export async function spawnAgentTask(
  input: SpawnAgentTaskInput,
  context: { setAppState: SetAppState; getAppState: () => AppState },
): Promise<TaskHandle> {
  const { prompt, description, toolUseId, createSubEngine } = input
  const { setAppState } = context

  const taskId = generateTaskId('local_agent')
  const abortController = new AbortController()

  const unregisterCleanup = registerCleanup(async () => {
    killAgentTask(taskId, setAppState)
  })

  const base = createTaskStateBase(taskId, 'local_agent', description, toolUseId)
  const taskState: LocalAgentTaskState = {
    ...base,
    type: 'local_agent',
    status: 'running',
    prompt,
    toolUseCount: 0,
    isBackgrounded: true,
    abortController,
    unregisterCleanup,
  }

  registerTask(taskState, setAppState)

  // Fire-and-forget — run the agent in the background
  void runAgentInBackground(
    taskId,
    description,
    prompt,
    toolUseId,
    createSubEngine,
    abortController,
    setAppState,
  )

  return {
    taskId,
    cleanup: () => unregisterCleanup(),
  }
}

// ─── Internal runner ──────────────────────────────────────────────────────────

async function runAgentInBackground(
  taskId: string,
  description: string,
  prompt: string,
  toolUseId: string | undefined,
  createSubEngine: (abortController: AbortController) => SubEngineHandle,
  abortController: AbortController,
  setAppState: SetAppState,
): Promise<void> {
  const subEngine = createSubEngine(abortController)
  let toolUseCount = 0
  let resultSummary = ''

  // --- Phase 22: Agent Summary Service ---
  // Provide a createSubRun callback that asks the sub-engine for a progress
  // phrase using a fresh lightweight call (no tools, just text response).
  const summaryHandle = startAgentSummarization(
    taskId,
    async (summaryPrompt) => {
      if (abortController.signal.aborted) return null;
      try {
        // Use a fresh sub-engine just for the summary question
        const summaryAc = new AbortController();
        abortController.signal.addEventListener('abort', () => summaryAc.abort(), { once: true });
        const summaryEngine = createSubEngine(summaryAc);
        let lastText: string | null = null;
        for await (const ev of summaryEngine.run(summaryPrompt)) {
          // We only need the text response — just drain events
          if ((ev as { type: string; content?: string }).type === 'text') {
            lastText = (ev as { content?: string }).content ?? lastText;
          }
        }
        // Fallback: grab last assistant message text
        if (!lastText) {
          const msgs = summaryEngine.getMessages();
          for (let i = msgs.length - 1; i >= 0; i--) {
            const m = msgs[i]!;
            if (m.role === 'assistant' && typeof m.content === 'string' && m.content.trim()) {
              lastText = m.content.trim().split('\n')[0] ?? null;
              break;
            }
          }
        }
        return lastText;
      } catch {
        return null;
      }
    },
    setAppState,
  );

  try {
    const systemPrompt = [
      'You are a sub-agent spawned to complete a specific task.',
      'Complete the task fully and return a clear summary of what you did.',
      'Be thorough but concise in your final report.',
    ].join(' ')

    const fullPrompt = `${systemPrompt}\n\n# Task\n${prompt}`

    for await (const ev of subEngine.run(fullPrompt)) {
      if (abortController.signal.aborted) break
      if (ev.type === 'tool_start') {
        toolUseCount++
        updateTaskState<LocalAgentTaskState>(taskId, setAppState, t => ({
          ...t,
          toolUseCount,
        }))
        // Keep summarizer aware of message count growth
        summaryHandle.notifyMessageCount(toolUseCount * 2 + 1)
      }
    }

    summaryHandle.stop()

    if (abortController.signal.aborted) {
      // Kill notification is sent by killAgentTask()
      return
    }

    // Capture last assistant message as result
    const messages = subEngine.getMessages()
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!
      if (m.role === 'assistant' && typeof m.content === 'string' && m.content.trim()) {
        resultSummary = m.content.trim()
        break
      }
    }
    if (!resultSummary) {
      resultSummary = 'Sub-agent completed without producing output.'
    }

    updateTaskState<LocalAgentTaskState>(taskId, setAppState, t => ({
      ...t,
      status: 'completed',
      result: resultSummary,
      endTime: Date.now(),
    }))

    enqueueAgentNotification(taskId, description, 'completed', resultSummary, undefined, toolUseId, setAppState)
  } catch (e: unknown) {
    summaryHandle.stop()
    if (abortController.signal.aborted) return

    const errMsg = e instanceof Error ? e.message : String(e)
    updateTaskState<LocalAgentTaskState>(taskId, setAppState, t => ({
      ...t,
      status: 'failed',
      error: errMsg,
      endTime: Date.now(),
    }))
    enqueueAgentNotification(taskId, description, 'failed', undefined, errMsg, toolUseId, setAppState)
  }
}
