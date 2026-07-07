import { stat } from 'fs/promises'
import type { AppState } from '../../state/AppState.js'
import type { LocalShellSpawnInput, SetAppState, TaskHandle, Task } from '../Task.js'
import { createTaskStateBase } from '../Task.js'
import { registerCleanup } from '../../utils/cleanup.js'
import { tailFile } from '../../utils/fsOperations.js'
import { enqueuePendingNotification } from '../../utils/messageQueueManager.js'
import type { ShellCommand } from '../../utils/ShellCommand.js'
import { evictTaskOutput, getTaskOutputPath } from '../../utils/task/diskOutput.js'
import { registerTask, updateTaskState } from '../../utils/task/framework.js'
import { type BashTaskKind, type LocalShellTaskState } from './guards.js'
import { killTask } from './killShellTasks.js'

const BACKGROUND_BASH_SUMMARY_PREFIX = 'Background command '
const STALL_CHECK_INTERVAL_MS = 5_000
const STALL_THRESHOLD_MS = 45_000
const STALL_TAIL_BYTES = 1024

const PROMPT_PATTERNS = [
  /\(y\/n\)/i,
  /\[y\/n\]/i,
  /\(yes\/no\)/i, 
  /\b(?:Do you|Would you|Shall I|Are you sure|Ready to)\b.*\? *$/i,
  /Press (any key|Enter)/i, 
  /Continue\?/i, 
  /Overwrite\?/i
]

export function looksLikePrompt(tail: string): boolean {
  const lastLine = tail.trimEnd().split('\n').pop() ?? ''
  return PROMPT_PATTERNS.some(p => p.test(lastLine))
}

function startStallWatchdog(
  taskId: string, 
  description: string, 
  kind: BashTaskKind | undefined, 
  toolUseId?: string
): () => void {
  if (kind === 'monitor') return () => {}
  const outputPath = getTaskOutputPath(taskId)
  let lastSize = 0
  let lastGrowth = Date.now()
  let cancelled = false

  const timer = setInterval(() => {
    void stat(outputPath).then(
      s => {
        if (s.size > lastSize) {
          lastSize = s.size
          lastGrowth = Date.now()
          return
        }
        if (Date.now() - lastGrowth < STALL_THRESHOLD_MS) return
        void tailFile(outputPath, STALL_TAIL_BYTES).then(
          ({ content }) => {
            if (cancelled) return
            if (!looksLikePrompt(content)) {
              lastGrowth = Date.now()
              return
            }
            cancelled = true
            clearInterval(timer)
            const summary = `${BACKGROUND_BASH_SUMMARY_PREFIX}"${description}" appears to be waiting for interactive input`
            const message = `<task_notification>
<task_id>${taskId}</task_id>
<output_file>${outputPath}</output_file>
<summary>${summary}</summary>
</task_notification>
Last output:
${content.trimEnd()}

The command is likely blocked on an interactive prompt. Kill this task and re-run with piped input (e.g., \`echo y | command\`) or a non-interactive flag.`
            
            enqueuePendingNotification({ value: message, mode: 'task-notification', priority: 'next' })
          },
          () => {}
        )
      },
      () => {}
    )
  }, STALL_CHECK_INTERVAL_MS)
  
  timer.unref?.()
  return () => {
    cancelled = true
    clearInterval(timer)
  }
}

function enqueueShellNotification(
  taskId: string, 
  description: string, 
  status: 'completed' | 'failed' | 'killed', 
  exitCode: number | undefined, 
  setAppState: SetAppState, 
  toolUseId?: string, 
  kind: BashTaskKind = 'bash'
): void {
  let shouldEnqueue = false
  updateTaskState(taskId, setAppState, task => {
    if (task.notified) return task
    shouldEnqueue = true
    return { ...task, notified: true }
  })
  
  if (!shouldEnqueue) return

  let summary: string
  if (kind === 'monitor') {
    switch (status) {
      case 'completed': summary = `Monitor "${description}" stream ended`; break
      case 'failed': summary = `Monitor "${description}" script failed${exitCode !== undefined ? ` (exit ${exitCode})` : ''}`; break
      case 'killed': summary = `Monitor "${description}" stopped`; break
    }
  } else {
    switch (status) {
      case 'completed': summary = `${BACKGROUND_BASH_SUMMARY_PREFIX}"${description}" completed${exitCode !== undefined ? ` (exit code ${exitCode})` : ''}`; break
      case 'failed': summary = `${BACKGROUND_BASH_SUMMARY_PREFIX}"${description}" failed${exitCode !== undefined ? ` with exit code ${exitCode}` : ''}`; break
      case 'killed': summary = `${BACKGROUND_BASH_SUMMARY_PREFIX}"${description}" was stopped`; break
    }
  }

  const outputPath = getTaskOutputPath(taskId)
  const message = `<task_notification>
<task_id>${taskId}</task_id>
<output_file>${outputPath}</output_file>
<status>${status}</status>
<summary>${summary}</summary>
</task_notification>`

  enqueuePendingNotification({
    value: message,
    mode: 'task-notification',
    priority: 'later'
  })
}

export const LocalShellTask: Task = {
  name: 'LocalShellTask',
  type: 'local_bash',
  async kill(taskId: string, setAppState: SetAppState) {
    killTask(taskId, setAppState)
  }
}

export async function spawnShellTask(
  input: LocalShellSpawnInput & { shellCommand: ShellCommand },
  context: { setAppState: SetAppState }
): Promise<TaskHandle> {
  const { command, description, shellCommand, toolUseId, kind } = input
  const { setAppState } = context

  const { taskOutput } = shellCommand
  const taskId = taskOutput.taskId
  
  const unregisterCleanup = registerCleanup(async () => {
    killTask(taskId, setAppState)
  })

  const taskState: LocalShellTaskState = {
    ...createTaskStateBase(taskId, 'local_bash', description, toolUseId),
    type: 'local_bash',
    status: 'running',
    command,
    completionStatusSentInAttachment: false,
    shellCommand,
    unregisterCleanup,
    lastReportedTotalLines: 0,
    isBackgrounded: true,
    kind
  }
  
  registerTask(taskState, setAppState)
  shellCommand.background(taskId)
  
  const cancelStallWatchdog = startStallWatchdog(taskId, description, kind, toolUseId)
  
  void shellCommand.result.then(async result => {
    cancelStallWatchdog()
    await shellCommand.taskOutput.flush()
    
    let wasKilled = false
    updateTaskState<LocalShellTaskState>(taskId, setAppState, task => {
      if (task.status === 'killed') {
        wasKilled = true
        return task
      }
      return {
        ...task,
        status: result.code === 0 ? 'completed' : 'failed',
        result: {
          code: result.code,
          interrupted: result.interrupted
        },
        shellCommand: null,
        unregisterCleanup: undefined,
        endTime: Date.now()
      }
    })
    
    enqueueShellNotification(
      taskId, 
      description, 
      wasKilled ? 'killed' : result.code === 0 ? 'completed' : 'failed', 
      result.code, 
      setAppState, 
      toolUseId, 
      kind
    )
    
    void evictTaskOutput(taskId)
  })

  return {
    taskId,
    cleanup: () => {
      unregisterCleanup()
    }
  }
}

/**
 * Background ALL currently running foreground shell tasks.
 * Called when the user presses Ctrl+B while a command is running.
 * Mirrors the beta's backgroundAll() in LocalShellTask.tsx.
 */
export function backgroundAll(
  getAppState: () => AppState,
  setAppState: SetAppState,
): void {
  const tasks = getAppState().tasks ?? {}
  for (const [taskId, task] of Object.entries(tasks)) {
    const t = task as LocalShellTaskState
    if (
      t.type !== 'local_bash' ||
      t.status !== 'running' ||
      t.isBackgrounded ||
      !t.shellCommand
    ) {
      continue
    }
    const didBackground = t.shellCommand.background(taskId)
    if (didBackground) {
      updateTaskState<LocalShellTaskState>(taskId, setAppState, s => ({
        ...s,
        isBackgrounded: true,
      }))
    }
  }
}

/**
 * Returns true if there are any running foreground (non-backgrounded) shell tasks.
 * Used to decide whether to show the BackgroundHint.
 */
export function hasForegroundTasks(getAppState: () => AppState): boolean {
  const tasks = getAppState().tasks ?? {}
  return Object.values(tasks).some(task => {
    const t = task as LocalShellTaskState
    return t.type === 'local_bash' && t.status === 'running' && !t.isBackgrounded
  })
}
