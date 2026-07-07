/**
 * Unified command queue — 1:1 port from beta's messageQueueManager.ts.
 *
 * All commands — user input, task notifications, orphaned permissions — flow
 * through this single priority queue. Priority determines dequeue order:
 * 'now' > 'next' > 'later'. Within the same priority, commands are FIFO.
 */

export type QueuePriority = 'now' | 'next' | 'later'
export type PromptInputMode = 'default' | 'task-notification' | string
export type EditablePromptInputMode = Exclude<PromptInputMode, 'task-notification'>

export type QueuedCommand = {
  /** The message text or content to inject into the agent. */
  value: string
  /** Controls routing: 'task-notification' = system-generated XML; else editable. */
  mode?: PromptInputMode
  /** Processing priority. Defaults to 'next'. */
  priority?: QueuePriority
  /** True for meta/system-only commands that must not leak to the input buffer. */
  isMeta?: boolean
  /** When true, slash-command routing is skipped even if value starts with '/'. */
  skipSlashCommands?: boolean
}

// ─── Internal state ──────────────────────────────────────────────────────────

const commandQueue: QueuedCommand[] = []

/** Frozen snapshot — recreated on every mutation for external consumers. */
let snapshot: readonly QueuedCommand[] = Object.freeze([])

/** Subscriber set for change notifications (useSyncExternalStore compatible). */
const subscribers = new Set<() => void>()

function notifySubscribers(): void {
  snapshot = Object.freeze([...commandQueue])
  for (const cb of subscribers) cb()
}

// ─── Subscription (useSyncExternalStore compatible) ───────────────────────────

export function subscribeToCommandQueue(cb: () => void): () => void {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

export function getCommandQueueSnapshot(): readonly QueuedCommand[] {
  return snapshot
}

// ─── Read operations ──────────────────────────────────────────────────────────

/** Get a mutable copy of the current queue. */
export function getCommandQueue(): QueuedCommand[] {
  return [...commandQueue]
}

export function getCommandQueueLength(): number {
  return commandQueue.length
}

export function hasCommandsInQueue(): boolean {
  return commandQueue.length > 0
}

/**
 * Trigger a re-check by notifying subscribers.
 * Use after async processing completes to ensure remaining commands
 * are picked up by consumers.
 */
export function recheckCommandQueue(): void {
  if (commandQueue.length > 0) {
    notifySubscribers()
  }
}

// ─── Priority table ───────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<QueuePriority, number> = {
  now: 0,
  next: 1,
  later: 2,
}

// ─── Write operations ─────────────────────────────────────────────────────────

/**
 * Add a user-initiated command (prompt, bash, orphaned-permission).
 * Defaults priority to 'next'.
 */
export function enqueue(command: QueuedCommand): void {
  commandQueue.push({ ...command, priority: command.priority ?? 'next' })
  notifySubscribers()
}

/**
 * Add a task notification. Defaults priority to 'later' so user input
 * is never starved by system messages.
 */
export function enqueuePendingNotification(command: QueuedCommand): void {
  commandQueue.push({ ...command, priority: command.priority ?? 'later' })
  notifySubscribers()
}

/**
 * Remove and return the highest-priority command, or undefined if empty.
 * Within the same priority level, commands are dequeued FIFO.
 *
 * An optional `filter` narrows candidates: only commands for which the
 * predicate returns `true` are considered. Non-matching commands stay.
 */
export function dequeue(
  filter?: (cmd: QueuedCommand) => boolean,
): QueuedCommand | undefined {
  if (commandQueue.length === 0) return undefined

  let bestIdx = -1
  let bestPriority = Infinity
  for (let i = 0; i < commandQueue.length; i++) {
    const cmd = commandQueue[i]!
    if (filter && !filter(cmd)) continue
    const priority = PRIORITY_ORDER[cmd.priority ?? 'next']
    if (priority < bestPriority) {
      bestIdx = i
      bestPriority = priority
    }
  }

  if (bestIdx === -1) return undefined
  const [dequeued] = commandQueue.splice(bestIdx, 1)
  notifySubscribers()
  return dequeued
}

/**
 * Remove and return all commands from the queue.
 */
export function dequeueAll(): QueuedCommand[] {
  if (commandQueue.length === 0) return []
  const commands = [...commandQueue]
  commandQueue.length = 0
  notifySubscribers()
  return commands
}

/**
 * Return the highest-priority command without removing it, or undefined if empty.
 * Accepts an optional `filter`.
 */
export function peek(
  filter?: (cmd: QueuedCommand) => boolean,
): QueuedCommand | undefined {
  if (commandQueue.length === 0) return undefined
  let bestIdx = -1
  let bestPriority = Infinity
  for (let i = 0; i < commandQueue.length; i++) {
    const cmd = commandQueue[i]!
    if (filter && !filter(cmd)) continue
    const priority = PRIORITY_ORDER[cmd.priority ?? 'next']
    if (priority < bestPriority) {
      bestIdx = i
      bestPriority = priority
    }
  }
  if (bestIdx === -1) return undefined
  return commandQueue[bestIdx]
}

/**
 * Remove and return all commands matching a predicate, preserving priority order.
 * Non-matching commands stay in the queue.
 */
export function dequeueAllMatching(
  predicate: (cmd: QueuedCommand) => boolean,
): QueuedCommand[] {
  const matched: QueuedCommand[] = []
  const remaining: QueuedCommand[] = []
  for (const cmd of commandQueue) {
    if (predicate(cmd)) {
      matched.push(cmd)
    } else {
      remaining.push(cmd)
    }
  }
  if (matched.length === 0) return []
  commandQueue.length = 0
  commandQueue.push(...remaining)
  notifySubscribers()
  return matched
}

/**
 * Remove specific commands from the queue by reference identity.
 */
export function remove(commandsToRemove: QueuedCommand[]): void {
  if (commandsToRemove.length === 0) return
  const before = commandQueue.length
  for (let i = commandQueue.length - 1; i >= 0; i--) {
    if (commandsToRemove.includes(commandQueue[i]!)) {
      commandQueue.splice(i, 1)
    }
  }
  if (commandQueue.length !== before) {
    notifySubscribers()
  }
}

/**
 * Remove commands matching a predicate. Returns the removed commands.
 */
export function removeByFilter(
  predicate: (cmd: QueuedCommand) => boolean,
): QueuedCommand[] {
  const removed: QueuedCommand[] = []
  for (let i = commandQueue.length - 1; i >= 0; i--) {
    if (predicate(commandQueue[i]!)) {
      removed.unshift(commandQueue.splice(i, 1)[0]!)
    }
  }
  if (removed.length > 0) notifySubscribers()
  return removed
}

/**
 * Clear all commands from the queue.
 * Used by ESC cancellation to discard queued notifications.
 */
export function clearCommandQueue(): void {
  if (commandQueue.length === 0) return
  commandQueue.length = 0
  notifySubscribers()
}

/**
 * Clear all commands and reset the snapshot.
 * Used for test cleanup.
 */
export function resetCommandQueue(): void {
  commandQueue.length = 0
  snapshot = Object.freeze([])
}

// ─── Editable mode helpers ────────────────────────────────────────────────────

const NON_EDITABLE_MODES = new Set<PromptInputMode>(['task-notification'])

export function isPromptInputModeEditable(
  mode: PromptInputMode,
): mode is EditablePromptInputMode {
  return !NON_EDITABLE_MODES.has(mode)
}

/**
 * Whether this queued command can be pulled into the input buffer via UP/ESC.
 * System-generated task-notification commands contain raw XML and must not
 * leak into the user's input buffer.
 */
export function isQueuedCommandEditable(cmd: QueuedCommand): boolean {
  return isPromptInputModeEditable(cmd.mode ?? 'default') && !cmd.isMeta
}

/**
 * Whether this command should render in the queue preview under the prompt.
 */
export function isQueuedCommandVisible(cmd: QueuedCommand): boolean {
  return isQueuedCommandEditable(cmd)
}

export type PopAllEditableResult = {
  text: string
  cursorOffset: number
}

/**
 * Pop all editable commands and combine them with current input for editing.
 * Notification modes (task-notification) are left in the queue.
 * Returns undefined if no editable commands in queue.
 */
export function popAllEditable(
  currentInput: string,
  currentCursorOffset: number,
): PopAllEditableResult | undefined {
  if (commandQueue.length === 0) return undefined

  const editable: QueuedCommand[] = []
  const nonEditable: QueuedCommand[] = []
  for (const cmd of commandQueue) {
    if (isQueuedCommandEditable(cmd)) {
      editable.push(cmd)
    } else {
      nonEditable.push(cmd)
    }
  }

  if (editable.length === 0) return undefined

  const queuedTexts = editable.map(cmd => cmd.value)
  const newInput = [...queuedTexts, currentInput].filter(Boolean).join('\n')
  const cursorOffset = queuedTexts.join('\n').length + 1 + currentCursorOffset

  commandQueue.length = 0
  commandQueue.push(...nonEditable)
  notifySubscribers()

  return { text: newInput, cursorOffset }
}

// ─── Priority filter helper ───────────────────────────────────────────────────

/**
 * Get commands at or above a given priority level without removing them.
 * Priority order: 'now' (0) > 'next' (1) > 'later' (2).
 * Passing 'now' returns only now-priority commands; 'later' returns everything.
 */
export function getCommandsByMaxPriority(
  maxPriority: QueuePriority,
): QueuedCommand[] {
  const threshold = PRIORITY_ORDER[maxPriority]
  return commandQueue.filter(
    cmd => PRIORITY_ORDER[cmd.priority ?? 'next'] <= threshold,
  )
}

/**
 * Returns true if the command is a slash command that should be routed through
 * processSlashCommand rather than sent to the model as text.
 */
export function isSlashCommand(cmd: QueuedCommand): boolean {
  return (
    typeof cmd.value === 'string' &&
    cmd.value.trim().startsWith('/') &&
    !cmd.skipSlashCommands
  )
}

// ─── Backward-compatible aliases ──────────────────────────────────────────────

/** @deprecated Use subscribeToCommandQueue */
export const subscribeToPendingNotifications = subscribeToCommandQueue

/** @deprecated Use getCommandQueueSnapshot */
export function getPendingNotificationsSnapshot(): readonly QueuedCommand[] {
  return snapshot
}

/** @deprecated Use hasCommandsInQueue */
export const hasPendingNotifications = hasCommandsInQueue

/** @deprecated Use getCommandQueueLength */
export const getPendingNotificationsCount = getCommandQueueLength

/** @deprecated Use recheckCommandQueue */
export const recheckPendingNotifications = recheckCommandQueue

/** @deprecated Use dequeue */
export function dequeuePendingNotification(): QueuedCommand | undefined {
  return dequeue()
}

/** @deprecated Use resetCommandQueue */
export const resetPendingNotifications = resetCommandQueue

/** @deprecated Use clearCommandQueue */
export const clearPendingNotifications = clearCommandQueue
