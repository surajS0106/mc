import { z } from "zod";
import { buildTool } from "./Tool.js";
import { getTaskOutput } from "../utils/task/diskOutput.js";
import { updateTaskState } from "../utils/task/framework.js";
import { formatTaskOutput, getMaxTaskOutputLength } from "../utils/task/outputFormatting.js";
import type { LocalShellTaskState } from "../tasks/LocalShellTask/guards.js";
import type { AppState } from "../state/AppState.js";

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  task_id: z.string().describe("The task ID to get output from"),
  block: z
    .boolean()
    .default(true)
    .describe("Whether to wait for the task to complete (default: true)"),
  timeout: z
    .number()
    .min(0)
    .max(600_000)
    .default(30_000)
    .describe("Max time to wait in milliseconds (default: 30000)"),
});

type TaskOutputInput = z.infer<typeof schema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TaskRecord = { type: string; status: string; description: string; id: string; shellCommand?: { taskOutput?: { getStdout(): Promise<string>; getStderr(): string } } | null; result?: { code: number } | null };

async function getOutputForTask(task: TaskRecord): Promise<string> {
  if (task.type === "local_bash") {
    const t = task as LocalShellTaskState;
    const taskOutput = t.shellCommand?.taskOutput;
    if (taskOutput) {
      const stdout = await taskOutput.getStdout();
      const stderr = taskOutput.getStderr();
      return [stdout, stderr].filter(Boolean).join("\n");
    }
  }
  return getTaskOutput(task.id);
}

async function waitForTask(
  taskId: string,
  getAppState: () => AppState,
  timeoutMs: number,
  signal: AbortSignal
): Promise<TaskRecord | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal.aborted) throw new Error("Aborted");
    const task = getAppState().tasks?.[taskId] as TaskRecord | undefined;
    if (!task) return null;
    if (task.status !== "running" && task.status !== "pending") return task;
    await new Promise(r => setTimeout(r, 100));
  }
  return (getAppState().tasks?.[taskId] as TaskRecord) ?? null;
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

export const taskOutputTool = buildTool({
  name: "TaskOutput",
  description:
    "Read the output of a background task by its task ID. " +
    "Use block=true (default) to wait for completion. " +
    "Use block=false for a non-blocking snapshot of current output. " +
    "Task IDs are returned when a command runs in the background.",
  inputSchema: schema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input: TaskOutputInput) =>
    `Reading task output (${input.task_id})`,

  async validateInput(input: TaskOutputInput, ctx) {
    if (!input.task_id) {
      return { ok: false, message: "task_id is required" };
    }
    const task = ctx.getAppState().tasks?.[input.task_id];
    if (!task) {
      return { ok: false, message: `No task found with ID: ${input.task_id}` };
    }
    return { ok: true };
  },

  async call(input: TaskOutputInput, ctx) {
    const { task_id, block, timeout } = input;
    const { getAppState, setAppState, abortController } = ctx;

    const task = getAppState().tasks?.[task_id] as TaskRecord | undefined;
    if (!task) throw new Error(`No task found with ID: ${task_id}`);

    if (!block) {
      // Non-blocking: return current snapshot
      const isDone = task.status !== "running" && task.status !== "pending";
      if (isDone) {
        updateTaskState(task_id, setAppState, t => ({ ...t, notified: true }));
      }
    const output = await getOutputForTask(task);
    const formatted = formatTaskOutput(output, "", getMaxTaskOutputLength());
    const status = isDone ? "success" : "not_ready";
    return buildResult(status, task, formatted);
    }

    // Blocking: wait for completion
    const completed = await waitForTask(task_id, getAppState, timeout, abortController.signal);

    if (!completed) {
      return buildResult("timeout", null, "");
    }

    if (completed.status === "running" || completed.status === "pending") {
      const output = await getOutputForTask(completed);
      const formatted = formatTaskOutput(output, "", getMaxTaskOutputLength());
      return buildResult("timeout", completed, formatted);
    }

    // Mark notified so the UI doesn't send a duplicate notification
    updateTaskState(task_id, setAppState, t => ({ ...t, notified: true }));

    const output = await getOutputForTask(completed);
    const formatted = formatTaskOutput(output, "", getMaxTaskOutputLength());
    return buildResult("success", completed, formatted);
  },
});

function buildResult(
  status: "success" | "timeout" | "not_ready",
  task: TaskRecord | null,
  outputContent: string
): string {
  const parts: string[] = [];
  parts.push(`<retrieval_status>${status}</retrieval_status>`);
  if (task) {
    parts.push(`<task_id>${task.id}</task_id>`);
    parts.push(`<task_type>${task.type}</task_type>`);
    parts.push(`<status>${task.status}</status>`);
    const t = task as LocalShellTaskState;
    if (t.result?.code !== undefined && t.result.code !== null) {
      parts.push(`<exit_code>${t.result.code}</exit_code>`);
    }
    if (outputContent.trim()) {
      parts.push(`<output>\n${outputContent.trimEnd()}\n</output>`);
    }
  }
  return parts.join("\n\n");
}
