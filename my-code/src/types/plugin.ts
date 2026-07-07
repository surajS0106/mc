/**
 * Plugin types — mirrors beta's types/plugin.ts.
 * LoadedPlugin and PluginError are the key types consumed by LSP infrastructure.
 */

import type { LspServerConfig } from '../services/lsp/types.js'

// ─── Plugin manifest ─────────────────────────────────────────────────────────

export type PluginAuthor = {
  name: string
  email?: string
  url?: string
}

/**
 * Subset of beta's PluginManifest — only fields used by our LSP integration.
 */
export type PluginManifest = {
  name?: string
  version?: string
  description?: string
  author?: PluginAuthor
  /** LSP server declarations: path to .lsp.json, inline config, or array */
  lspServers?: string | Record<string, LspServerConfig> | Array<string | Record<string, LspServerConfig>>
  /** Whether this plugin declares user-configurable options */
  userConfig?: Record<string, unknown>
}

// ─── Loaded plugin ────────────────────────────────────────────────────────────

/**
 * A fully loaded plugin — mirrors beta's LoadedPlugin.
 * Fields used by lspPluginIntegration are preserved exactly.
 */
export type LoadedPlugin = {
  name: string
  manifest: PluginManifest
  /** Absolute path to plugin directory */
  path: string
  /** Source identifier — 'user', 'project', or marketplace name */
  source: string
  repository: string
  enabled?: boolean
  isBuiltin?: boolean
  sha?: string
  commandsPath?: string
  commandsPaths?: string[]
  agentsPath?: string
  agentsPaths?: string[]
  skillsPath?: string
  skillsPaths?: string[]
  /** Cached LSP servers from this plugin's .lsp.json */
  lspServers?: Record<string, LspServerConfig>
  settings?: Record<string, unknown>
}

// ─── Plugin errors ────────────────────────────────────────────────────────────

export type PluginComponent = 'commands' | 'agents' | 'skills' | 'hooks' | 'output-styles'

/**
 * Discriminated union of plugin errors — mirrors beta's PluginError exactly.
 */
export type PluginError =
  | { type: 'path-not-found'; source: string; plugin?: string; path: string; component: PluginComponent }
  | { type: 'git-auth-failed'; source: string; plugin?: string; gitUrl: string; authType: 'ssh' | 'https' }
  | { type: 'git-timeout'; source: string; plugin?: string; gitUrl: string; operation: 'clone' | 'pull' }
  | { type: 'network-error'; source: string; plugin?: string; url: string; details?: string }
  | { type: 'manifest-parse-error'; source: string; plugin?: string; manifestPath: string; parseError: string }
  | { type: 'manifest-validation-error'; source: string; plugin?: string; manifestPath: string; validationErrors: string[] }
  | { type: 'plugin-not-found'; source: string; pluginId: string; marketplace: string }
  | { type: 'marketplace-not-found'; source: string; marketplace: string; availableMarketplaces: string[] }
  | { type: 'marketplace-load-failed'; source: string; marketplace: string; reason: string }
  | { type: 'mcp-config-invalid'; source: string; plugin: string; serverName: string; validationError: string }
  | { type: 'mcp-server-suppressed-duplicate'; source: string; plugin: string; serverName: string; duplicateOf: string }
  | { type: 'lsp-config-invalid'; source: string; plugin: string; serverName: string; validationError: string }
  | { type: 'lsp-server-start-failed'; source: string; plugin: string; serverName: string; reason: string }
  | { type: 'lsp-server-crashed'; source: string; plugin: string; serverName: string; exitCode: number | null; signal?: string }
  | { type: 'lsp-request-timeout'; source: string; plugin: string; serverName: string; method: string; timeoutMs: number }
  | { type: 'lsp-request-failed'; source: string; plugin: string; serverName: string; method: string; error: string }
  | { type: 'hook-load-failed'; source: string; plugin: string; hookPath: string; reason: string }
  | { type: 'component-load-failed'; source: string; plugin: string; component: PluginComponent; path: string; reason: string }
  | { type: 'dependency-unsatisfied'; source: string; plugin: string; dependency: string; reason: 'not-enabled' | 'not-found' }
  | { type: 'plugin-cache-miss'; source: string; plugin: string; installPath: string }
  | { type: 'generic-error'; source: string; plugin?: string; error: string }

export type PluginLoadResult = {
  enabled: LoadedPlugin[]
  disabled: LoadedPlugin[]
  errors: PluginError[]
}

/** Get a human-readable message from any PluginError */
export function getPluginErrorMessage(error: PluginError): string {
  switch (error.type) {
    case 'generic-error': return error.error
    case 'path-not-found': return `Path not found: ${error.path} (${error.component})`
    case 'lsp-config-invalid': return `Plugin "${error.plugin}" has invalid LSP config for "${error.serverName}": ${error.validationError}`
    case 'lsp-server-start-failed': return `Plugin "${error.plugin}" failed to start LSP server "${error.serverName}": ${error.reason}`
    case 'lsp-server-crashed': return `Plugin "${error.plugin}" LSP server "${error.serverName}" crashed (exit code ${error.exitCode ?? 'unknown'})`
    case 'manifest-parse-error': return `Manifest parse error: ${error.parseError}`
    case 'manifest-validation-error': return `Manifest validation failed: ${error.validationErrors.join(', ')}`
    default: return `Plugin error: ${error.type}`
  }
}
