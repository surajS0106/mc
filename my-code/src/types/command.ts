import type { FrontmatterShell } from '../utils/frontmatterParser.js';
import type { HooksSettings } from '../hooks/types.js';
import type { SlashCommandDef, CommandContext } from '../commands/registry.js';

export type LoadedFrom = 'skills' | 'plugin' | 'managed' | 'bundled' | 'mcp';

export interface CommandBase {
  name: string;
  description: string;
  argumentHint?: string;
  whenToUse?: string;
  allowedTools: string[];
  version?: string;
  model?: string;
  disableModelInvocation: boolean;
  userInvocable: boolean;
  source: string;
  loadedFrom?: LoadedFrom;
  pluginInfo?: any;
}

export interface PromptCommand extends CommandBase {
  type: 'prompt';
  prompt: string;
  argumentNames: string[];
  hooks?: HooksSettings;
  executionContext?: 'fork';
  agent?: string;
  effort?: string | number;
  shell?: FrontmatterShell;
}

export interface LocalCommand extends CommandBase {
  type: 'local';
  execute(args: string, context: CommandContext): Promise<void> | void;
}

export type Command = PromptCommand | LocalCommand;
