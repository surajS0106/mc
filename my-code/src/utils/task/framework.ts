import type { AppState } from '../../state/AppState.js'
import { isTerminalTaskStatus, type TaskStatus, type TaskType } from '../../tasks/Task.js'
import type { TaskState } from '../../tasks/types.js'
import { getTaskOutputDelta, getTaskOutputPath } from './diskOutput.js'
// Note: messageQueueManager logic will be stubbed or added in Phase 5
import { enqueuePendingNotification } from '../messageQueueManager.js'

export const POLL_INTERVAL_MS = 1000
export const STOPPED_DISPLAY_MS = 3_000
export const PANEL_GRACE_MS = 30_000

export type TaskAttachment = {
  type: 'task_status'
  taskId: string
  toolUseId?: string
  taskType: TaskType
  status: TaskStatus
  description: string
  deltaSummary: string | null
}

type SetAppState = (updater: (prev: AppState) => AppState) => void

export function updateTaskState<T extends TaskState>(
  taskId: string,
  setAppState: SetAppState,
  updater: (task: T) => T,
): void {
  setAppState(prev => {
    const task = prev.tasks?.[taskId] as T | undefined
    if (!task) return prev
    const updated = updater(task)
    if (updated === task) return prev
    return {
      ...prev,
      tasks: {
        ...prev.tasks,
        [taskId]: updated,
      },
    }
  })
}

export function registerTask(task: TaskState, setAppState: SetAppState): void {
  setAppState(prev => {
    return { ...prev, tasks: { ...(prev.tasks ?? {}), [task.id]: task } }
  })
}

export function evictTerminalTask(
  taskId: string,
  setAppState: SetAppState,
): void {
  setAppState(prev => {
    const task = prev.tasks?.[taskId]
    if (!task) return prev
    if (!isTerminalTaskStatus(task.status)) return prev
    if (!task.notified) return prev
    const { [taskId]: _, ...remainingTasks } = prev.tasks ?? {}
    return { ...prev, tasks: remainingTasks }
  })
}

export function getRunningTasks(state: AppState): TaskState[] {
  const tasks = state.tasks ?? {}
  return Object.values(tasks).filter(task => task.status === 'running') as TaskState[]
}

export async function generateTaskAttachments(state: AppState): Promise<{
  attachments: TaskAttachment[]
  updatedTaskOffsets: Record<string, number>
  evictedTaskIds: string[]
}> {
  const attachments: TaskAttachment[] = []
  const updatedTaskOffsets: Record<string, number> = {}
  const evictedTaskIds: string[] = []
  const tasks = state.tasks ?? {}

  for (const taskState of Object.values(tasks)) {
    if (taskState.notified) {
      switch (taskState.status) {
        case 'completed':
        case 'failed':
        case 'killed':
          evictedTaskIds.push(taskState.id)
          continue
        case 'pending':
          continue
        case 'running':
          break
      }
    }

    if (taskState.status === 'running') {
      const delta = await getTaskOutputDelta(
        taskState.id,
        taskState.outputOffset,
      )
      if (delta.content) {
        updatedTaskOffsets[taskState.id] = delta.newOffset
      }
    }
  }

  return { attachments, updatedTaskOffsets, evictedTaskIds }
}

export function applyTaskOffsetsAndEvictions(
  setAppState: SetAppState,
  updatedTaskOffsets: Record<string, number>,
  evictedTaskIds: string[],
): void {
  const offsetIds = Object.keys(updatedTaskOffsets)
  if (offsetIds.length === 0 && evictedTaskIds.length === 0) return

  setAppState(prev => {
    let changed = false
    const newTasks = { ...(prev.tasks ?? {}) }
    for (const id of offsetIds) {
      const fresh = newTasks[id]
      if (fresh?.status === 'running') {
        newTasks[id] = { ...fresh, outputOffset: updatedTaskOffsets[id]! }
        changed = true
      }
    }
    for (const id of evictedTaskIds) {
      const fresh = newTasks[id]
      if (!fresh || !isTerminalTaskStatus(fresh.status) || !fresh.notified) {
        continue
      }
      delete newTasks[id]
      changed = true
    }
    return changed ? { ...prev, tasks: newTasks } : prev
  })
}

export async function pollTasks(
  getAppState: () => AppState,
  setAppState: SetAppState,
): Promise<void> {
  const state = getAppState()
  const { attachments, updatedTaskOffsets, evictedTaskIds } =
    await generateTaskAttachments(state)

  applyTaskOffsetsAndEvictions(setAppState, updatedTaskOffsets, evictedTaskIds)

  for (const attachment of attachments) {
    enqueueTaskNotification(attachment)
  }
}

function enqueueTaskNotification(attachment: TaskAttachment): void {
  const statusText = getStatusText(attachment.status)
  const outputPath = getTaskOutputPath(attachment.taskId)
  const message = `<task_notification>
<task_id>${attachment.taskId}</task_id>
<task_type>${attachment.taskType}</task_type>
<output_file>${outputPath}</output_file>
<status>${attachment.status}</status>
<summary>Task "${attachment.description}" ${statusText}</summary>
</task_notification>`

  enqueuePendingNotification({ value: message, mode: 'task-notification' })
}

function getStatusText(status: TaskStatus): string {
  switch (status) {
    case 'completed': return 'completed successfully'
    case 'failed': return 'failed'
    case 'killed': return 'was stopped'
    case 'running': return 'is running'
    case 'pending': return 'is pending'
  }
}
