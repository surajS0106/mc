/**
 * Commands barrel — builds a ready-to-use CommandRegistry with all built-ins.
 */

export { CommandRegistry, type SlashCommandDef, type CommandContext, type CommandTone } from "./registry.js";
export { builtinCommands } from "./builtins.js";

import { CommandRegistry } from "./registry.js";
import { builtinCommands } from "./builtins.js";

/** Create a CommandRegistry pre-loaded with all built-in commands. */
export function createCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  for (const cmd of builtinCommands) {
    registry.register(cmd);
  }
  return registry;
}
