/**
 * Emit a `task_progress` SDK event.
 * Shared by background tasks and workflows.
 *
 * In the beta this emits to a proprietary SDK event bus. In our CLI we have
 * no such bus, so we stub it as a no-op. The function signature is preserved
 * 1:1 so any future SDK integration only needs to swap the implementation.
 */
export function emitTaskProgress(_params: {
  taskId: string
  toolUseId: string | undefined
  description: string
  startTime: number
  totalTokens: number
  toolUses: number
  lastToolName?: string
  summary?: string
}): void {
  // No-op: our CLI doesn't have an external SDK event bus.
  // When wiring to a real SDK, call the event emitter here.
}
