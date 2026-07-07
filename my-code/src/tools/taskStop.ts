import { z } from "zod";
import { buildTool } from "./Tool.js";
import { killTask } from "../tasks/LocalShellTask/killShellTasks.js";
import type { LocalShellTaskState } from "../tasks/LocalShellTask/guards.js";

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  task_id: z
    .string()
    .describe("The ID of the background task to stop"),
  // Backward compat alias (mirrors beta's KillShell alias)
  shell_id: z
    .string()
    .optional()
    .describe("Deprecated: use task_id instead"),
});

type TaskStopInput = z.infer<typeof schema>;

// ─── Tool ─────────────────────────────────────────────────────────────────────

export const taskStopTool = buildTool({
  name: "TaskStop",
  description:
    "Stop a running background task by its task ID. " +
    "The task's process is killed and its status is set to 'killed'. " +
    "Use TaskList to find task IDs.",
  inputSchema: schema,
  isConcurrencySafe: () => true,
  getActivityDescription: (input: TaskStopInput) =>
    `Stopping task (${input.task_id ?? input.shell_id})`,

  async validateInput(input: TaskStopInput, ctx) {
    const id = input.task_id ?? input.shell_id;
    if (!id) {
      return { ok: false, message: "task_id is required" };
    }
    const task = ctx.getAppState().tasks?.[id] as LocalShellTaskState | undefined;
    if (!task) {
      return { ok: false, message: `No task found with ID: ${id}` };
    }
    if (task.status !== "running") {
      return {
        ok: false,
        message: `Task ${id} is not running (status: ${task.status})`,
      };
    }
    return { ok: true };
  },

  async call(input: TaskStopInput, ctx) {
    const id = input.task_id ?? input.shell_id;
    if (!id) throw new Error("task_id is required");

    const { setAppState, getAppState } = ctx;
    const task = getAppState().tasks?.[id] as LocalShellTaskState | undefined;
    if (!task) throw new Error(`No task found with ID: ${id}`);

    const command = task.type === "local_bash"
      ? (task as LocalShellTaskState).command ?? task.description
      : task.description;

    killTask(id, setAppState);

    return [
      `Successfully stopped task: ${id}`,
      `Type: ${task.type}`,
      `Command: ${command}`,
    ].join("\n");
  },
});
