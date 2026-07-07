import { randomUUID } from "node:crypto";

export type TaskStatus = "pending" | "in_progress" | "completed" | "deleted";

export interface Task {
  id: string;
  subject: string;               // Brief title (imperative form)
  description: string;           // What needs to be done
  activeForm?: string;           // Present-continuous for spinner ("Running tests")
  status: TaskStatus;
  blocks: string[];              // Task IDs that cannot start until this one completes
  blockedBy: string[];           // Task IDs that must complete before this one starts
  metadata?: Record<string, unknown>;
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

/** Module-level singleton — session-scoped, never persisted to disk. */
const store = new Map<string, Task>();

/**
 * Create a new task. Returns the generated short ID (8-char hex).
 */
export function createTask(
  fields: Omit<Task, "id" | "createdAt" | "updatedAt">
): string {
  const id = randomUUID().replace(/-/g, "").slice(0, 8);
  const now = new Date().toISOString();
  store.set(id, { ...fields, id, createdAt: now, updatedAt: now });
  return id;
}

/** Get a task by ID. Returns undefined if not found. */
export function getTask(id: string): Task | undefined {
  return store.get(id);
}

/** List all non-deleted tasks. */
export function listStructuredTasks(): Task[] {
  return [...store.values()].filter((t) => t.status !== "deleted");
}

/**
 * Update fields on an existing task.
 * Returns the updated task, or undefined if not found.
 */
export function updateTask(
  id: string,
  updates: Partial<Omit<Task, "id" | "createdAt">>
): Task | undefined {
  const task = store.get(id);
  if (!task) return undefined;
  const updated: Task = { ...task, ...updates, id, updatedAt: new Date().toISOString() };
  store.set(id, updated);
  return updated;
}

/** Permanently remove a task. Returns true if it existed. */
export function deleteTask(id: string): boolean {
  return store.delete(id);
}

/**
 * Add a blocks relationship:
 *   taskId blocks targetId (targetId cannot start until taskId completes).
 * Both sides of the relationship are updated.
 */
export function addBlocksRelation(taskId: string, targetId: string): void {
  const task = store.get(taskId);
  const target = store.get(targetId);
  if (!task || !target) return;
  if (!task.blocks.includes(targetId)) {
    task.blocks.push(targetId);
    task.updatedAt = new Date().toISOString();
  }
  if (!target.blockedBy.includes(taskId)) {
    target.blockedBy.push(taskId);
    target.updatedAt = new Date().toISOString();
  }
}

/** Clear the store (useful for testing or /clear command). */
export function clearTaskStore(): void {
  store.clear();
}
