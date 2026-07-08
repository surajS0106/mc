import { z } from "zod";
import { buildTool } from "./Tool.js";
import {
  getTask,
  updateTask,
  deleteTask,
  addBlocksRelation,
  listStructuredTasks,
} from "../tasks/taskStore.js";

const inputSchema = z.object({
  taskId: z
    .string()
    .describe("ID of the task to update"),
  subject: z
    .string()
    .optional()
    .describe("New title for the task (imperative form)"),
  description: z
    .string()
    .optional()
    .describe("New description"),
  activeForm: z
    .string()
    .optional()
    .describe(
      'Present continuous form shown in spinner when in_progress, e.g. "Running tests"'
    ),
  status: z
    .enum(["pending", "in_progress", "completed", "deleted"])
    .optional()
    .describe(
      "New status. Use 'deleted' to permanently remove the task. Status flow: pending → in_progress → completed."
    ),
  addBlocks: z
    .array(z.string())
    .optional()
    .describe("Task IDs that this task blocks — they cannot start until this one completes"),
  addBlockedBy: z
    .array(z.string())
    .optional()
    .describe("Task IDs that must complete before this one can start"),
  metadata: z
    // NOTE: `z.unknown()` (not `.nullable()`) — `unknown` already accepts null at
    // runtime, and `.nullable()` here serialized to `"type": [null, "null"]`, which
    // Azure OpenAI rejects with HTTP 400 ("[None, 'null'] is not valid…"). The
    // delete-by-null behaviour below is unchanged.
    .record(z.string(), z.unknown())
    .optional()
    .describe("Metadata keys to merge into the task. Set a key to null to delete it."),
});

const DESCRIPTION = [
  "Update a task's status, details, or dependencies.",
  "",
  "IMPORTANT RULES:",
  "- Mark as in_progress BEFORE starting work",
  "- Mark as completed only when work is FULLY done (no partial completions)",
  "- If tests fail or work is incomplete, keep as in_progress",
  "- After completing, call TaskList to find the next available task",
  "- Use 'deleted' status to permanently remove a task",
  "",
  "Status flow: pending → in_progress → completed",
  "",
  "Examples:",
  '  Start task:     {"taskId": "abc123", "status": "in_progress"}',
  '  Complete task:  {"taskId": "abc123", "status": "completed"}',
  '  Delete task:    {"taskId": "abc123", "status": "deleted"}',
  '  Add dependency: {"taskId": "abc123", "addBlockedBy": ["def456"]}',
].join("\n");

export const taskUpdateTool = buildTool({
  name: "TaskUpdate",
  description: DESCRIPTION,
  inputSchema,
  isReadOnly: () => false,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) =>
    `Updating task ${input.taskId}${input.status ? ` → ${input.status}` : ""}`,
  renderToolUse: (input) =>
    `TaskUpdate: ${input.taskId}${input.status ? ` → ${input.status}` : ""}`,
  async call(input) {
    const { taskId, status, addBlocks, addBlockedBy, metadata, ...rest } = input;

    const existing = getTask(taskId);
    if (!existing) {
      return `Task not found: ${taskId}`;
    }

    // Permanent deletion
    if (status === "deleted") {
      deleteTask(taskId);
      return `Task ${taskId} ("${existing.subject}") deleted.`;
    }

    const updatedFields: string[] = [];

    // Build scalar update payload — only changed values
    const updates: Parameters<typeof updateTask>[1] = {};

    if (rest.subject !== undefined && rest.subject !== existing.subject) {
      updates.subject = rest.subject;
      updatedFields.push("subject");
    }
    if (rest.description !== undefined && rest.description !== existing.description) {
      updates.description = rest.description;
      updatedFields.push("description");
    }
    if (rest.activeForm !== undefined && rest.activeForm !== existing.activeForm) {
      updates.activeForm = rest.activeForm;
      updatedFields.push("activeForm");
    }
    if (status !== undefined && status !== existing.status) {
      updates.status = status;
      updatedFields.push("status");
    }

    // Merge metadata (null value = delete the key)
    if (metadata !== undefined) {
      const merged: Record<string, unknown> = { ...(existing.metadata ?? {}) };
      for (const [key, value] of Object.entries(metadata)) {
        if (value === null) {
          delete merged[key];
        } else {
          merged[key] = value;
        }
      }
      updates.metadata = merged;
      updatedFields.push("metadata");
    }

    if (Object.keys(updates).length > 0) {
      updateTask(taskId, updates);
    }

    // Wire up blocks relationships
    if (addBlocks && addBlocks.length > 0) {
      for (const targetId of addBlocks) {
        addBlocksRelation(taskId, targetId);
      }
      updatedFields.push("blocks");
    }
    if (addBlockedBy && addBlockedBy.length > 0) {
      for (const blockerId of addBlockedBy) {
        addBlocksRelation(blockerId, taskId);
      }
      updatedFields.push("blockedBy");
    }

    const lines: string[] = [
      updatedFields.length > 0
        ? `Task ${taskId} updated: ${updatedFields.join(", ")}`
        : `Task ${taskId}: no changes made`,
    ];

    // After completing, surface next available tasks
    if (status === "completed") {
      const allTasks = listStructuredTasks();
      const allDone = allTasks.every((t) => t.status === "completed");

      if (allDone && allTasks.length > 0) {
        lines.push("\nAll tasks are complete.");
      } else {
        const available = allTasks.filter(
          (t) =>
            t.status === "pending" &&
            t.blockedBy.every((bid) => {
              const blocker = getTask(bid);
              return !blocker || blocker.status === "completed";
            })
        );
        if (available.length > 0) {
          lines.push(
            "\nNext available tasks:",
            ...available.map((t) => `  [${t.id}] ${t.subject}`)
          );
          lines.push("Use TaskUpdate to mark the next task in_progress.");
        }
      }
    }

    return lines.join("\n");
  },
});
