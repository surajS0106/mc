/**
 * Foreground task helpers — ported from beta's LocalShellTask.tsx.
 * These support the progress loop in bash.ts: registering running commands
 * as "foreground tasks" so they can be backgrounded via Ctrl+B.
 */

import type { AppState } from '../../state/AppState.js'
import type { SetAppState } from '../Task.js'
import { createTaskStateBase, generateTaskId } from '../Task.js'
import { registerTask, updateTaskState } from '../../utils/task/framework.js'
import type { ShellCommand } from '../../utils/ShellCommand.js'
import type { LocalShellTaskState, BashTaskKind } from './guards.js'
import { killTask } from './killShellTasks.js'
import { registerCleanup } from '../../utils/cleanup.js'

export type ForegroundTaskInput = {
  command: string
  description: string
  shellCommand: ShellCommand
  kind?: BashTaskKind
}

/**
 * Register a still-running command as a foreground task.
 * Called ~2s after command start so we can show the "Press Ctrl+B" hint.
 * Returns the new taskId.
 */
export function registerForeground(
  input: ForegroundTaskInput,
  setAppState: SetAppState,
  toolUseId?: string,
): string {
  const { command, description, shellCommand, kind } = input
  const taskId = generateTaskId('local_bash')

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
    isBackgrounded: false,
    kind,
  }

  registerTask(taskState, setAppState)
  return taskId
}

/**
 * Convert an existing foreground task into a background task in-place.
 * This avoids re-spawning (which would emit a duplicate task_started event
 * and leak the first cleanup callback).
 * Returns true on success, false if the task was already backgrounded.
 */
export function backgroundExistingForegroundTask(
  taskId: string,
  shellCommand: ShellCommand,
  description: string,
  setAppState: SetAppState,
  toolUseId?: string,
): boolean {
  let didBackground = false
  updateTaskState<LocalShellTaskState>(taskId, setAppState, task => {
    if (task.isBackgrounded || task.status !== 'running') return task
    didBackground = shellCommand.background(taskId)
    if (!didBackground) return task
    return { ...task, isBackgrounded: true }
  })
  return didBackground
}

/**
 * Remove a foreground task from state when the command completes normally
 * (without being backgrounded).
 */
export function unregisterForeground(taskId: string, setAppState: SetAppState): void {
  setAppState(prev => {
    const task = prev.tasks?.[taskId]
    if (!task) return prev
    // Only remove if still running and not backgrounded
    const t = task as LocalShellTaskState
    if (t.isBackgrounded || task.status !== 'running') return prev
    const { [taskId]: _, ...rest } = prev.tasks ?? {}
    return { ...prev, tasks: rest }
  })
}

/**
 * Mark a task as notified so the completion handler doesn't send a duplicate
 * notification. Used when a background-then-complete race is detected.
 */
export function markTaskNotified(taskId: string, setAppState: SetAppState): void {
  updateTaskState<LocalShellTaskState>(taskId, setAppState, task => {
    if (task.notified) return task
    return { ...task, notified: true }
  })
}
