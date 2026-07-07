import { z } from "zod";
import { buildTool } from "./Tool.js";

const enterSchema = z.object({
  reason: z
    .string()
    .optional()
    .describe("Optional one-line explanation of why plan mode is being entered"),
});

const exitSchema = z.object({});

export const enterPlanModeTool = buildTool({
  name: "EnterPlanMode",
  description:
    "Enter plan mode. While active, Write/Edit/Bash tools will be blocked — only read-only exploration tools may run. Use this when you want to research and propose a plan before any mutations.",
  inputSchema: enterSchema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,
  getActivityDescription: () => "Entering plan mode",
  renderToolUse: () => "EnterPlanMode",
  async call(input, ctx) {
    ctx.setAppState((s) => ({ ...s, planMode: true }));
    return `Plan mode ON.${input.reason ? ` Reason: ${input.reason}` : ""} Mutating tools (Write/Edit/Bash) are blocked until ExitPlanMode.`;
  },
});

export const exitPlanModeTool = buildTool({
  name: "ExitPlanMode",
  description:
    "Exit plan mode. Mutating tools become available again. Call this only after the user has approved the plan.",
  inputSchema: exitSchema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,
  getActivityDescription: () => "Exiting plan mode",
  renderToolUse: () => "ExitPlanMode",
  async call(_input, ctx) {
    ctx.setAppState((s) => ({ ...s, planMode: false }));
    return "Plan mode OFF. Mutating tools are available.";
  },
});
