/**
 * Plugin system — load and manage plugins from the project and user config.
 *
 * Plugins can:
 *   - Register new tools
 *   - Register hooks (PreToolUse, PostToolUse, SessionStart, SessionEnd)
 *   - Register custom slash commands
 *   - Provide additional system prompt sections
 *
 * Plugin locations:
 *   - ~/.my-code/plugins/*.js          — user-wide plugins
 *   - <cwd>/.my-code/plugins/*.js      — project-specific plugins
 *   - npm packages (future)       — via `ig plugin install <name>`
 *
 * A plugin is a JS/TS module that exports a `register` function:
 *
 *   export function register(api: PluginAPI): void { ... }
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Tool } from "../tools/Tool.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { SlashCommandDef } from "../commands/registry.js";
import type { CommandRegistry } from "../commands/registry.js";
import { registerHook, type HookPhase, type PreToolUseHook, type PostToolUseHook, type SessionHook } from "../hooks/index.js";

// ─── Plugin API (what plugins receive) ──────────────────────────────────────

export interface PluginAPI {
  /** Register a tool that will be available to the AI agent. */
  registerTool(tool: Tool): void;

  /** Register a slash command. */
  registerCommand(def: SlashCommandDef): void;

  /** Register a lifecycle hook. */
  registerHook(phase: "PreToolUse", fn: PreToolUseHook): void;
  registerHook(phase: "PostToolUse", fn: PostToolUseHook): void;
  registerHook(phase: "SessionStart" | "SessionEnd", fn: SessionHook): void;

  /** Add a section to the system prompt. */
  addPromptSection(section: { title: string; content: string }): void;

  /** Get the current working directory. */
  readonly cwd: string;

  /** Log a message (visible in debug mode). */
  log(message: string): void;
}

// ─── Plugin metadata ────────────────────────────────────────────────────────

export interface PluginMeta {
  /** Plugin file path. */
  path: string;
  /** Plugin name (derived from filename). */
  name: string;
  /** Source: user or project. */
  source: "user" | "project";
  /** Whether it loaded successfully. */
  loaded: boolean;
  /** Error message if loading failed. */
  error?: string;
}

// ─── Prompt sections from plugins ───────────────────────────────────────────

export interface PromptSection {
  title: string;
  content: string;
  plugin: string;
}

const promptSections: PromptSection[] = [];

export function getPluginPromptSections(): PromptSection[] {
  return [...promptSections];
}

// ─── Plugin loading ─────────────────────────────────────────────────────────

function userPluginDir(): string {
  return path.join(os.homedir(), ".my-code", "plugins");
}

function projectPluginDir(cwd: string): string {
  return path.join(cwd, ".my-code", "plugins");
}

async function listPluginFiles(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files
      .filter((f) => f.endsWith(".js") || f.endsWith(".mjs"))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Discover and load all plugins from user and project directories.
 */
export async function loadPlugins(
  cwd: string,
  toolRegistry: ToolRegistry,
  commandRegistry: CommandRegistry
): Promise<PluginMeta[]> {
  const results: PluginMeta[] = [];

  // Discover plugins
  const userPlugins = (await listPluginFiles(userPluginDir())).map((p) => ({
    path: p,
    source: "user" as const,
  }));
  const projectPlugins = (await listPluginFiles(projectPluginDir(cwd))).map((p) => ({
    path: p,
    source: "project" as const,
  }));

  const allPlugins = [...userPlugins, ...projectPlugins];

  for (const plugin of allPlugins) {
    const name = path.basename(plugin.path, path.extname(plugin.path));
    const meta: PluginMeta = {
      path: plugin.path,
      name,
      source: plugin.source,
      loaded: false,
    };

    try {
      // Build the API for this plugin
      const api: PluginAPI = {
        registerTool(tool: Tool) {
          toolRegistry.register(tool);
        },
        registerCommand(def: SlashCommandDef) {
          commandRegistry.register(def);
        },
        registerHook(phase: HookPhase, fn: unknown) {
          registerHook(phase as any, fn as any);
        },
        addPromptSection(section: { title: string; content: string }) {
          promptSections.push({ ...section, plugin: name });
        },
        cwd,
        log(message: string) {
          process.stderr.write(`  [plugin:${name}] ${message}\n`);
        },
      };

      // Dynamic import the plugin
      const mod = await import(`file://${plugin.path}`);
      if (typeof mod.register === "function") {
        await mod.register(api);
        meta.loaded = true;
      } else if (typeof mod.default?.register === "function") {
        await mod.default.register(api);
        meta.loaded = true;
      } else {
        meta.error = "no register() function exported";
      }
    } catch (e) {
      meta.error = e instanceof Error ? e.message : String(e);
    }

    results.push(meta);
  }

  return results;
}

/**
 * Format plugin list for display.
 */
export function formatPluginList(plugins: PluginMeta[]): string {
  if (plugins.length === 0) return "(no plugins loaded)";
  return plugins
    .map((p) => {
      const status = p.loaded ? "✔" : "✗";
      const err = p.error ? ` — ${p.error}` : "";
      return `  ${status} ${p.name} (${p.source})${err}`;
    })
    .join("\n");
}
