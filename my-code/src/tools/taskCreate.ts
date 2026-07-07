import { z } from "zod";
import { buildTool } from "./Tool.js";
import { createTask } from "../tasks/taskStore.js";

const inputSchema = z.object({
  subject: z
    .string()
    .describe(
      'Brief title in imperative form, e.g. "Fix authentication bug in login flow"'
    ),
  description: z
    .string()
    .describe("What needs to be done — enough context to execute independently"),
  activeForm: z
    .string()
    .optional()
    .describe(
      'Present continuous form shown in spinner when in_progress, e.g. "Fixing authentication bug". If omitted, subject is shown.'
    ),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Optional arbitrary metadata to attach to the task"),
});

const DESCRIPTION = [
  "Create a new task in the task list.",
  "",
  "Use proactively for complex multi-step work (3+ steps), multiple user requests,",
  "or plan mode. Skip for single trivial tasks — just do them directly.",
  "Tasks are created as pending. Use TaskUpdate to change status.",
  "Create ALL tasks upfront before starting work, then use TaskUpdate to track progress.",
  "Check TaskList first to avoid creating duplicates.",
].join("\n");

export const taskCreateTool = buildTool({
  name: "TaskCreate",
  description: DESCRIPTION,
  inputSchema,
  isReadOnly: () => false,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Creating task: ${input.subject}`,
  renderToolUse: (input) => `TaskCreate: ${input.subject}`,
  async call(input) {
    const id = createTask({
      subject: input.subject,
      description: input.description,
      activeForm: input.activeForm,
      status: "pending",
      blocks: [],
      blockedBy: [],
      metadata: input.metadata,
    });
    return [
      `Task created successfully.`,
      `ID: ${id}`,
      `Subject: ${input.subject}`,
      `Status: pending`,
      ``,
      `Use TaskUpdate to mark it in_progress before starting work.`,
    ].join("\n");
  },
});
