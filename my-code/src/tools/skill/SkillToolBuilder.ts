import { z } from 'zod';
import { buildTool, type Tool, type ToolUseContext } from '../Tool.js';
import type { PromptCommand } from '../../types/command.js';
import { executeShellCommandsInPrompt } from '../../utils/promptShellExecution.js';
import { substituteArguments } from '../../utils/argumentSubstitution.js';

/**
 * Converts a PromptCommand skill into an AI-callable tool.
 */
export function buildSkillTool(skill: PromptCommand): Tool<z.ZodObject<any>> {
  // Build Zod schema for the arguments
  const shape: Record<string, z.ZodTypeAny> = {};
  if (skill.argumentNames) {
    for (const arg of skill.argumentNames) {
      shape[arg] = z.string().describe(`The value for ${arg}`);
    }
  }

  // If there are no arguments, we still need a schema (z.object({}))
  const inputSchema = z.object(shape).describe(skill.description);

  return buildTool({
    name: `skill__${skill.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    description: `[SKILL] ${skill.description}. ${skill.whenToUse ?? ''}`,
    inputSchema,
    isReadOnly: () => false, // Skills can run bash commands, so we assume they mutate
    isDestructive: () => false,
    getActivityDescription: () => `Executing skill: ${skill.name}`,
    renderToolUse: (input) => {
      const argsStr = Object.entries(input)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      return `Skill: ${skill.name}${argsStr ? ` (${argsStr})` : ''}`;
    },
    async call(input, ctx: ToolUseContext) {
      // 1. Reconstruct args string for substituteArguments if needed,
      // or we can pass a map to substituteArguments.
      // Wait, substituteArguments takes `argsString` and `argumentNames`.
      // Let's just create a raw argument string for now (simple approximation).
      const rawArgs = skill.argumentNames?.map(name => input[name] ?? '').join(' ') ?? '';

      // 2. Substitute arguments in the prompt
      const prompt = substituteArguments(skill.prompt, rawArgs, true, skill.argumentNames || []);

      // 3. Execute embedded shell commands
      const processedPrompt = await executeShellCommandsInPrompt(
        prompt,
        ctx,
        skill.name,
        skill.shell
      );

      // 4. Return the processed prompt so the AI can read it as the tool output
      // If the context is 'fork', we would run a subagent here.
      if (skill.executionContext === 'fork' && ctx.spawnSubAgent) {
         const taskId = await ctx.spawnSubAgent(
           processedPrompt,
           skill.allowedTools || [],
           `Running skill ${skill.name}`,
         );
         return `Spawned background agent to execute skill (Task ID: ${taskId}). You can monitor it using the tasks command or manage_task tool.`;
      }

      return processedPrompt;
    }
  });
}
