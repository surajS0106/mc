/**
 * AgentTool — spawn a sub-agent to handle a scoped task.
 *
 * Two modes:
 *   background=false (default): synchronous — blocks current turn, returns result.
 *   background=true:            async — returns taskId immediately; result arrives
 *                               as a <task_notification> between turns.
 */

import { z } from "zod";
import { buildTool } from "../Tool.js";

const inputSchema = z.object({
  task: z.string().describe(
    "A self-contained task description for the sub-agent. Be specific — the sub-agent cannot see the parent conversation."
  ),
  allowed_tools: z.array(z.string()).optional().describe(
    "Optional list of tool names the sub-agent may use. Defaults to all tools."
  ),
  context: z.string().optional().describe(
    "Optional additional context from the parent conversation to provide to the sub-agent."
  ),
  background: z.boolean().optional().default(false).describe(
    "If true, run as a background task and return immediately with a taskId. " +
    "The result arrives as a <task_notification> injected between turns. " +
    "Use for long-running work (>30s) that should not block the current turn."
  ),
});

export const AgentTool = buildTool({
  name: "Agent",
  description:
    "Spawn a sub-agent to handle a scoped task. The sub-agent has its own context and runs independently. " +
    "Use for complex sub-tasks that would clutter the main conversation, like 'refactor all tests', " +
    "'implement the API layer for X', or 'research Y and summarize findings'. " +
    "The sub-agent inherits your tools and working directory but has a fresh context window. " +
    "Set background=true to run without blocking; you'll be notified when done.",

  inputSchema,

  isReadOnly: () => false,
  isDestructive: () => false,

  async call(input, ctx, onProgress) {
    const { task, allowed_tools, context, background } = input;

    // ─── Background path ─────────────────────────────────────────────────────
    if (background) {
      if (!ctx.createSubEngine) {
        return "Error: Background sub-agent spawning is not supported by the current environment.";
      }
      try {
        const { spawnAgentTask } = await import("../../tasks/LocalAgentTask/LocalAgentTask.js");
        const description = task.slice(0, 80).replace(/\n/g, " ");
        const handle = await spawnAgentTask(
          {
            prompt: context ? `${task}\n\n# Additional Context\n${context}` : task,
            description,
            toolUseId: ctx.toolUseId,
            createSubEngine: ctx.createSubEngine,
          },
          {
            setAppState: ctx.setAppState,
            getAppState: ctx.getAppState,
          },
        );
        return [
          "Sub-agent launched as background task.",
          `Task ID: ${handle.taskId}`,
          "Use TaskOutput to read its output, TaskStop to cancel it.",
          "You will be notified automatically when it completes.",
        ].join("\n");
      } catch (e) {
        return `Failed to spawn background agent: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    // ─── Foreground path (synchronous, existing behaviour) ───────────────────
    if (!ctx.spawnSubAgent) {
      return "Error: Sub-agent spawning is not supported by the current environment.";
    }

    onProgress?.({ type: "status", message: "spawning sub-agent..." });

    try {
      const result = await ctx.spawnSubAgent(task, allowed_tools, context, onProgress);
      return result;
    } catch (e) {
      return `Failed to spawn sub-agent: ${e instanceof Error ? e.message : String(e)}`;
    }
  },

  getActivityDescription(input) {
    const mode = input.background ? "[bg] " : "";
    return `${mode}spawning agent: ${input.task.slice(0, 50)}…`;
  },
});
