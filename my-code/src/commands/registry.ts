/**
 * Modular slash-command system.
 *
 * Each command is a self-contained object with its own execute() function.
 * Commands are registered in the registry and dispatched from App.tsx by name.
 * This replaces the 350-line switch/case that lived in App.tsx.
 */

import type { QueryEngine } from "../agent/QueryEngine.js";
import type { ChatProvider } from "../agent/provider.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { PermissionEngine } from "../config/permissions.js";
import type { SessionStats } from "../session/stats.js";
import type { PricingTable } from "../session/pricing.js";
import type { AppState } from "../state/AppState.js";
import type { ProviderAccount } from "../config/accounts.js";

export type CommandTone = "info" | "warn" | "error";

/** The context every command receives when executed. */
export interface CommandContext {
  engine: QueryEngine;
  registry: ToolRegistry;
  permissions: PermissionEngine;
  provider: ChatProvider;
  stats: SessionStats;
  pricing: PricingTable;
  cwd: string;
  getAppState: () => AppState;
  setAppState: (updater: (s: AppState) => AppState) => void;
  /** Push a system message to the transcript. */
  push: (content: string, tone?: CommandTone) => void;
  /** Submit a prompt to the engine (re-enters handleSubmit). */
  submitPrompt: (prompt: string) => Promise<void>;
  /** Switch the active provider account at runtime (swaps the engine's provider). */
  switchAccount: (acc: ProviderAccount) => Promise<void>;
  /** Close the app. */
  exit: () => void;
}

/** A slash command definition. */
export interface SlashCommandDef {
  /** Command name without the leading `/`. */
  name: string;
  /** Short description for /help. */
  description: string;
  /** Optional args hint for /help display. */
  argsHint?: string;
  /** Aliases (alternative names). */
  aliases?: string[];
  /**
   * Mode this command belongs to. Undefined = default mode (only available
   * when activeMode is null). Reserved for future sub-mode support;
   * currently unused — all commands are default-mode.
   */
  mode?: string;
  /**
   * Available in every mode (e.g. /quit, /help, /clear). Passthrough
   * commands lose to mode-specific commands of the same name.
   */
  passthrough?: boolean;
  /** Execute the command. `args` is the rest of the line after the command name. */
  execute: (args: string[], ctx: CommandContext) => Promise<void> | void;
}

/**
 * Registry: stores commands by name + aliases, dispatches by name.
 *
 * Multiple commands may share a name as long as they live in different modes.
 * Lookup precedence: mode-specific > passthrough > default.
 */
export class CommandRegistry {
  private byName = new Map<string, SlashCommandDef[]>();
  private allDefs: SlashCommandDef[] = [];

  register(def: SlashCommandDef): void {
    this.allDefs.push(def);
    this.indexByName(def.name, def);
    for (const alias of def.aliases ?? []) {
      this.indexByName(alias, def);
    }
  }

  private indexByName(key: string, def: SlashCommandDef): void {
    const list = this.byName.get(key);
    if (list) list.push(def);
    else this.byName.set(key, [def]);
  }

  /**
   * Look up a command by name, respecting the active mode.
   * Precedence: mode-specific > passthrough > default-mode.
   */
  get(name: string, activeMode: string | null = null): SlashCommandDef | undefined {
    const candidates = this.byName.get(name);
    if (!candidates || candidates.length === 0) return undefined;
    if (activeMode) {
      const m = candidates.find((c) => c.mode === activeMode);
      if (m) return m;
    }
    const p = candidates.find((c) => c.passthrough);
    if (p) return p;
    if (!activeMode) {
      const d = candidates.find((c) => !c.mode && !c.passthrough);
      if (d) return d;
    }
    return undefined;
  }

  /** All commands that are visible in the given mode. */
  list(activeMode: string | null = null): SlashCommandDef[] {
    return this.allDefs.filter((def) => {
      if (def.passthrough) return true;
      if (activeMode) return def.mode === activeMode;
      return !def.mode;
    });
  }

  /** Filter commands for autocomplete, scoped to the active mode. */
  filter(query: string, activeMode: string | null = null): SlashCommandDef[] {
    const visible = this.list(activeMode);
    const q = query.toLowerCase().trim();
    if (!q) return visible;
    const starts = visible.filter((c) => c.name.startsWith(q));
    if (starts.length) return starts;
    return visible.filter(
      (c) => c.name.includes(q) || c.description.toLowerCase().includes(q)
    );
  }
}
