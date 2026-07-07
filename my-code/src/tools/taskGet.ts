import { z } from "zod";
import { buildTool } from "./Tool.js";
import { getTask } from "../tasks/taskStore.js";

const inputSchema = z.object({
  taskId: z.string().describe("The ID of the task to retrieve"),
});

const DESCRIPTION = [
  "Get full details of a task by ID.",
  "",
  "Use before starting work on a task to read the full description and check",
  "dependencies. Always verify blockedBy is empty before marking in_progress.",
  "Use TaskList for a summary of all tasks.",
].join("\n");

export const taskGetTool = buildTool({
  name: "TaskGet",
  description: DESCRIPTION,
  inputSchema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Getting task ${input.taskId}`,
  renderToolUse: (input) => `TaskGet: ${input.taskId}`,
  async call(input) {
    const task = getTask(input.taskId);
    if (!task) {
      return `Task not found: ${input.taskId}`;
    }

    const lines: string[] = [
      `Task ID:     ${task.id}`,
      `Subject:     ${task.subject}`,
      `Status:      ${task.status}`,
      `Description: ${task.description}`,
    ];

    if (task.activeForm) {
      lines.push(`Active form: ${task.activeForm}`);
    }
    if (task.blockedBy.length > 0) {
      lines.push(`Blocked by:  ${task.blockedBy.join(", ")}`);
    }
    if (task.blocks.length > 0) {
      lines.push(`Blocks:      ${task.blocks.join(", ")}`);
    }
    if (task.metadata && Object.keys(task.metadata).length > 0) {
      lines.push(`Metadata:    ${JSON.stringify(task.metadata)}`);
    }
    lines.push(`Created:     ${task.createdAt}`);
    lines.push(`Updated:     ${task.updatedAt}`);

    return lines.join("\n");
  },
});
