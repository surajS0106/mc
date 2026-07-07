import type { LocalShellTaskState } from './LocalShellTask/guards.js'
import type { LocalAgentTaskState } from './LocalAgentTask/LocalAgentTask.js'

export type TaskState = LocalShellTaskState | LocalAgentTaskState

export type BackgroundTaskState = LocalShellTaskState | LocalAgentTaskState

export function isBackgroundTask(task: TaskState): task is BackgroundTaskState {
  if (task.status !== 'running' && task.status !== 'pending') {
    return false
  }
  if ('isBackgrounded' in task && task.isBackgrounded === false) {
    return false
  }
  return true
}
