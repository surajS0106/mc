/**
 * Background task manager — run tasks concurrently without blocking the REPL.
 *
 * Modeled after beta's tasks/ directory. Tasks are async functions that run
 * independently and report progress/completion via callbacks.
 *
 * Examples:
 *   - Long-running builds
 *   - File watching
 *   - Test suite execution
 *   - Code analysis / linting
 */

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TaskProgress {
  message: string;
  percent?: number;
}

export interface TaskDef {
  /** Unique task ID. */
  id: string;
  /** Human-readable description. */
  description: string;
  /** The async function to run. */
  run: (
    onProgress: (progress: TaskProgress) => void,
    signal: AbortSignal
  ) => Promise<string>;
}

export interface TaskState {
  id: string;
  description: string;
  status: TaskStatus;
  startedAt?: number;
  completedAt?: number;
  result?: string;
  error?: string;
  progress?: TaskProgress;
}

type TaskListener = (task: TaskState) => void;

/**
 * Manages background tasks with progress tracking and cancellation.
 */
export class TaskManager {
  private tasks = new Map<string, TaskState>();
  private controllers = new Map<string, AbortController>();
  private listeners: TaskListener[] = [];
  private idCounter = 0;

  /** Generate a unique task ID. */
  nextId(prefix = "task"): string {
    return `${prefix}-${++this.idCounter}`;
  }

  /** Register a listener for task state changes. */
  onUpdate(fn: TaskListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify(task: TaskState): void {
    for (const fn of this.listeners) {
      try { fn(task); } catch {}
    }
  }

  /** Submit a background task. Returns the task ID. */
  submit(def: TaskDef): string {
    const controller = new AbortController();
    const state: TaskState = {
      id: def.id,
      description: def.description,
      status: "pending",
    };

    this.tasks.set(def.id, state);
    this.controllers.set(def.id, controller);
    this.notify(state);

    // Run asynchronously
    (async () => {
      state.status = "running";
      state.startedAt = Date.now();
      this.notify(state);

      try {
        const result = await def.run(
          (progress) => {
            state.progress = progress;
            this.notify(state);
          },
          controller.signal
        );
        state.status = "completed";
        state.result = result;
        state.completedAt = Date.now();
      } catch (e) {
        if (controller.signal.aborted) {
          state.status = "cancelled";
        } else {
          state.status = "failed";
          state.error = e instanceof Error ? e.message : String(e);
        }
        state.completedAt = Date.now();
      }

      this.notify(state);
    })();

    return def.id;
  }

  /** Cancel a running task. */
  cancel(id: string): boolean {
    const controller = this.controllers.get(id);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  /** Get the state of a specific task. */
  get(id: string): TaskState | undefined {
    return this.tasks.get(id);
  }

  /** List all tasks. */
  list(filter?: TaskStatus): TaskState[] {
    const all = [...this.tasks.values()];
    return filter ? all.filter((t) => t.status === filter) : all;
  }

  /** Get active (pending or running) tasks. */
  active(): TaskState[] {
    return this.list().filter((t) => t.status === "pending" || t.status === "running");
  }

  /** Clean up completed/failed/cancelled tasks. */
  prune(): number {
    const done = this.list().filter(
      (t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled"
    );
    for (const t of done) {
      this.tasks.delete(t.id);
      this.controllers.delete(t.id);
    }
    return done.length;
  }

  /** Format task list for display. */
  format(): string {
    const tasks = this.list();
    if (tasks.length === 0) return "(no background tasks)";

    return tasks
      .map((t) => {
        const status = {
          pending: "⏳",
          running: "⚙️",
          completed: "✔",
          failed: "✗",
          cancelled: "⊘",
        }[t.status];
        const dur = t.startedAt
          ? `${((t.completedAt ?? Date.now()) - t.startedAt) / 1000}s`
          : "";
        const progress = t.progress
          ? ` [${t.progress.percent ? `${t.progress.percent}%` : t.progress.message}]`
          : "";
        const err = t.error ? ` — ${t.error.slice(0, 60)}` : "";
        return `  ${status} ${t.id}: ${t.description}${progress} ${dur}${err}`;
      })
      .join("\n");
  }
}

/** Singleton task manager instance. */
export const taskManager = new TaskManager();
