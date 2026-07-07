import { z } from "zod";
import { buildTool } from "./Tool.js";
import type { LocalShellTaskState } from "../tasks/LocalShellTask/guards.js";
import type { AppState } from "../state/AppState.js";

// ─── Tool ─────────────────────────────────────────────────────────────────────

export const taskListTool = buildTool({
  name: "TaskList",
  description:
    "List all currently running background tasks. " +
    "Returns task ID, type, status, and description for each task. " +
    "Use TaskOutput to read a task's output, and TaskStop to stop a task.",
  inputSchema: z.object({}),
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: () => "Listing background tasks",

  async call(_input, ctx) {
    const tasks = ctx.getAppState().tasks ?? {};
    const entries = Object.values(tasks) as LocalShellTaskState[];

    if (entries.length === 0) {
      return "No background tasks found.";
    }

    const lines = entries.map(task => {
      const age = task.startTime
        ? `${Math.floor((Date.now() - task.startTime) / 1000)}s`
        : "?s";
      const cmd =
        task.type === "local_bash"
          ? (task as LocalShellTaskState).command?.split("\n")[0]?.slice(0, 60) ?? task.description
          : task.description;
      return `[${task.status}] ${task.id}  ${cmd}  (${age} ago)`;
    });

    return lines.join("\n");
  },
});
