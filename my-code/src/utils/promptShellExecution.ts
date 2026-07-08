import { bashTool } from '../tools/bash.js';
import type { ToolUseContext } from '../tools/Tool.js';

const BLOCK_PATTERN = /```!\s*\n?([\s\S]*?)\n?```/g;
const INLINE_PATTERN = /(?<=^|\s)!`([^`]+)`/gm;

export async function executeShellCommandsInPrompt(
  text: string,
  context: ToolUseContext,
  slashCommandName: string,
  shell?: string,
): Promise<string> {
  let result = text;

  const blockMatches = text.matchAll(BLOCK_PATTERN);
  const inlineMatches = text.includes('!`') ? text.matchAll(INLINE_PATTERN) : [];

  for (const match of [...blockMatches, ...inlineMatches]) {
    const command = match[1]?.trim();
    if (command) {
      try {
        const output = await bashTool.call({ command, description: `Shell block in ${slashCommandName}` }, context);
        result = result.replace(match[0], () => (typeof output === 'string' ? output : JSON.stringify(output)));
      } catch (e) {
        result = result.replace(match[0], () => `[Error running shell command: ${e instanceof Error ? e.message : String(e)}]`);
      }
    }
  }

  return result;
}
