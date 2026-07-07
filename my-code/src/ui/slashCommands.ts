import { createCommandRegistry } from "../commands/index.js";

export interface SlashCommand {
  name: string;
  desc: string;
  args?: string;
}

// Derive the autocomplete list from the command registry.
// This ensures /help, autocomplete, and actual dispatch stay in sync.
const registry = createCommandRegistry();

export function listCommands(): SlashCommand[] {
  return registry.list().map((def) => ({
    name: def.name,
    desc: def.description,
    args: def.argsHint,
  }));
}

export function filterCommands(query: string): SlashCommand[] {
  const visible = listCommands();
  const q = query.toLowerCase().trim();
  if (!q) return visible;
  const starts = visible.filter((c) => c.name.toLowerCase().startsWith(q));
  if (starts.length) return starts;
  return visible.filter(
    (c) => c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
  );
}
