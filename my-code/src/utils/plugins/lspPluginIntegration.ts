/**
 * LSP plugin integration — 1:1 port of beta's utils/plugins/lspPluginIntegration.ts
 *
 * Loads LSP server configurations from plugins by checking:
 *   1. .lsp.json file in plugin directory
 *   2. manifest.lspServers field
 *
 * Then resolves environment variables (${IG_PLUGIN_ROOT}, ${VAR}) and
 * adds plugin scope prefix to server names.
 */

import { readFile } from 'fs/promises'
import { join, relative, resolve } from 'path'
import { z } from 'zod'
import type { LspServerConfig, ScopedLspServerConfig } from '../../services/lsp/types.js'
import type { LoadedPlugin, PluginError } from '../../types/plugin.js'
import { logForDebugging } from '../debug.js'
import { isENOENT, toError } from '../errors.js'
import { logError } from '../log.js'
import { jsonParse } from '../slowOperations.js'

// ─── Path security ───────────────────────────────────────────────────────────

/**
 * Validate that a resolved path stays within the plugin directory.
 * Prevents path traversal attacks via .. or absolute paths.
 * Mirrors beta's validatePathWithinPlugin exactly.
 */
function validatePathWithinPlugin(
  pluginPath: string,
  relativePath: string,
): string | null {
  const resolvedPluginPath = resolve(pluginPath)
  const resolvedFilePath = resolve(pluginPath, relativePath)
  const rel = relative(resolvedPluginPath, resolvedFilePath)

  if (rel.startsWith('..') || resolve(rel) === rel) {
    return null
  }

  return resolvedFilePath
}

// ─── LspServerConfig Zod schema (from beta's schemas.ts) ─────────────────────

const nonEmptyString = z.string().min(1)
const fileExtension = z.string().min(2).refine(
  ext => ext.startsWith('.'),
  { message: 'File extensions must start with dot (e.g., ".ts", not "ts")' },
)

export const LspServerConfigSchema = () =>
  z.object({
    command: z.string().min(1).refine(
      cmd => !(cmd.includes(' ') && !cmd.startsWith('/')),
      { message: 'Command should not contain spaces. Use args array for arguments.' },
    ),
    args: z.array(nonEmptyString).optional(),
    extensionToLanguage: z.record(fileExtension, nonEmptyString).refine(
      record => Object.keys(record).length > 0,
      { message: 'extensionToLanguage must have at least one mapping' },
    ),
    transport: z.enum(['stdio', 'socket']).default('stdio'),
    env: z.record(z.string(), z.string()).optional(),
    initializationOptions: z.unknown().optional(),
    settings: z.unknown().optional(),
    workspaceFolder: z.string().optional(),
    startupTimeout: z.number().int().positive().optional(),
    shutdownTimeout: z.number().int().positive().optional(),
    restartOnCrash: z.boolean().optional(),
    maxRestarts: z.number().int().nonnegative().optional(),
  })

// ─── Environment variable expansion ──────────────────────────────────────────

/**
 * Expand ${VAR} references in a string.
 * Returns expanded string and list of missing vars.
 */
function expandEnvVarsInString(value: string): {
  expanded: string
  missingVars: string[]
} {
  const missingVars: string[] = []
  const expanded = value.replace(/\$\{([^}]+)\}/g, (match, varName: string) => {
    const envValue = process.env[varName]
    if (envValue === undefined) {
      missingVars.push(varName)
      return match // Leave unexpanded
    }
    return envValue
  })
  return { expanded, missingVars }
}

// ─── Load LSP servers from plugin ────────────────────────────────────────────

/**
 * Load LSP server configurations from a plugin.
 * Checks for:
 *   1. .lsp.json file in plugin directory
 *   2. manifest.lspServers field
 *
 * Mirrors beta's loadPluginLspServers exactly.
 */
export async function loadPluginLspServers(
  plugin: LoadedPlugin,
  errors: PluginError[] = [],
): Promise<Record<string, LspServerConfig> | undefined> {
  const servers: Record<string, LspServerConfig> = {}

  // 1. Check for .lsp.json file in plugin directory
  const lspJsonPath = join(plugin.path, '.lsp.json')
  try {
    const content = await readFile(lspJsonPath, 'utf-8')
    const parsed = jsonParse(content)
    const result = z.record(z.string(), LspServerConfigSchema()).safeParse(parsed)

    if (result.success) {
      Object.assign(servers, result.data)
    } else {
      const errorMsg = `LSP config validation failed for .lsp.json in plugin ${plugin.name}: ${result.error.message}`
      logError(new Error(errorMsg))
      errors.push({
        type: 'lsp-config-invalid',
        plugin: plugin.name,
        serverName: '.lsp.json',
        validationError: result.error.message,
        source: 'plugin',
      })
    }
  } catch (error) {
    // .lsp.json is optional, ignore if it doesn't exist
    if (!isENOENT(error)) {
      logError(toError(error))
      errors.push({
        type: 'lsp-config-invalid',
        plugin: plugin.name,
        serverName: '.lsp.json',
        validationError: error instanceof Error
          ? `Failed to parse JSON: ${error.message}`
          : 'Failed to parse JSON file',
        source: 'plugin',
      })
    }
  }

  // 2. Check manifest.lspServers field
  if (plugin.manifest.lspServers) {
    const manifestServers = await loadLspServersFromManifest(
      plugin.manifest.lspServers,
      plugin.path,
      plugin.name,
      errors,
    )
    if (manifestServers) {
      Object.assign(servers, manifestServers)
    }
  }

  return Object.keys(servers).length > 0 ? servers : undefined
}

/**
 * Load LSP servers from manifest declaration (handles multiple formats).
 * Mirrors beta's loadLspServersFromManifest exactly.
 */
async function loadLspServersFromManifest(
  declaration:
    | string
    | Record<string, LspServerConfig>
    | Array<string | Record<string, LspServerConfig>>,
  pluginPath: string,
  pluginName: string,
  errors: PluginError[],
): Promise<Record<string, LspServerConfig> | undefined> {
  const servers: Record<string, LspServerConfig> = {}
  const declarations = Array.isArray(declaration) ? declaration : [declaration]

  for (const decl of declarations) {
    if (typeof decl === 'string') {
      // Validate path to prevent directory traversal
      const validatedPath = validatePathWithinPlugin(pluginPath, decl)
      if (!validatedPath) {
        const securityMsg = `Security: Path traversal attempt blocked in plugin ${pluginName}: ${decl}`
        logError(new Error(securityMsg))
        logForDebugging(securityMsg, { level: 'warn' })
        errors.push({
          type: 'lsp-config-invalid',
          plugin: pluginName,
          serverName: decl,
          validationError: 'Invalid path: must be relative and within plugin directory',
          source: 'plugin',
        })
        continue
      }

      try {
        const content = await readFile(validatedPath, 'utf-8')
        const parsed = jsonParse(content)
        const result = z.record(z.string(), LspServerConfigSchema()).safeParse(parsed)

        if (result.success) {
          Object.assign(servers, result.data)
        } else {
          const errorMsg = `LSP config validation failed for ${decl} in plugin ${pluginName}: ${result.error.message}`
          logError(new Error(errorMsg))
          errors.push({
            type: 'lsp-config-invalid',
            plugin: pluginName,
            serverName: decl,
            validationError: result.error.message,
            source: 'plugin',
          })
        }
      } catch (error) {
        logError(toError(error))
        errors.push({
          type: 'lsp-config-invalid',
          plugin: pluginName,
          serverName: decl,
          validationError: error instanceof Error
            ? `Failed to parse JSON: ${error.message}`
            : 'Failed to parse JSON file',
          source: 'plugin',
        })
      }
    } else {
      // Inline configs
      for (const [serverName, config] of Object.entries(decl)) {
        const result = LspServerConfigSchema().safeParse(config)
        if (result.success) {
          servers[serverName] = result.data as LspServerConfig
        } else {
          const errorMsg = `LSP config validation failed for inline server "${serverName}" in plugin ${pluginName}: ${result.error.message}`
          logError(new Error(errorMsg))
          errors.push({
            type: 'lsp-config-invalid',
            plugin: pluginName,
            serverName,
            validationError: result.error.message,
            source: 'plugin',
          })
        }
      }
    }
  }

  return Object.keys(servers).length > 0 ? servers : undefined
}

// ─── Environment variable resolution ─────────────────────────────────────────

/**
 * Resolve environment variables for plugin LSP servers.
 * Handles ${IG_PLUGIN_ROOT} and general ${VAR} substitution.
 * Mirrors beta's resolvePluginLspEnvironment exactly.
 */
export function resolvePluginLspEnvironment(
  config: LspServerConfig,
  plugin: { path: string; source: string },
  _errors?: PluginError[],
): LspServerConfig {
  const allMissingVars: string[] = []

  const resolveValue = (value: string): string => {
    // First substitute plugin-specific variables
    let resolved = value
      .replace(/\$\{IG_PLUGIN_ROOT\}/g, plugin.path)

    // Expand general environment variables
    const { expanded, missingVars } = expandEnvVarsInString(resolved)
    allMissingVars.push(...missingVars)
    return expanded
  }

  const resolved = { ...config }

  // Resolve command path
  if (resolved.command) {
    resolved.command = resolveValue(resolved.command)
  }

  // Resolve args
  if (resolved.args) {
    resolved.args = resolved.args.map(arg => resolveValue(arg))
  }

  // Resolve environment variables and add IG_PLUGIN_ROOT
  const resolvedEnv: Record<string, string> = {
    IG_PLUGIN_ROOT: plugin.path,
    ...(resolved.env ?? {}),
  }
  for (const [key, value] of Object.entries(resolvedEnv)) {
    if (key !== 'IG_PLUGIN_ROOT') {
      resolvedEnv[key] = resolveValue(value)
    }
  }
  resolved.env = resolvedEnv

  // Resolve workspaceFolder if present
  if (resolved.workspaceFolder) {
    resolved.workspaceFolder = resolveValue(resolved.workspaceFolder)
  }

  // Log missing variables if any were found
  if (allMissingVars.length > 0) {
    const uniqueMissingVars = [...new Set(allMissingVars)]
    const warnMsg = `Missing environment variables in plugin LSP config: ${uniqueMissingVars.join(', ')}`
    logError(new Error(warnMsg))
    logForDebugging(warnMsg, { level: 'warn' })
  }

  return resolved
}

/**
 * Add plugin scope to LSP server configs.
 * Adds a prefix to server names to avoid conflicts between plugins.
 * Mirrors beta's addPluginScopeToLspServers exactly.
 */
export function addPluginScopeToLspServers(
  servers: Record<string, LspServerConfig>,
  pluginName: string,
): Record<string, ScopedLspServerConfig> {
  const scopedServers: Record<string, ScopedLspServerConfig> = {}

  for (const [name, config] of Object.entries(servers)) {
    const scopedName = `plugin:${pluginName}:${name}`
    scopedServers[scopedName] = {
      ...config,
      scope: 'dynamic',
      source: pluginName,
    }
  }

  return scopedServers
}

/**
 * Get LSP servers from a specific plugin with environment variable resolution and scoping.
 * Mirrors beta's getPluginLspServers exactly.
 */
export async function getPluginLspServers(
  plugin: LoadedPlugin,
  errors: PluginError[] = [],
): Promise<Record<string, ScopedLspServerConfig> | undefined> {
  if (!plugin.enabled) {
    return undefined
  }

  // Use cached servers if available
  const servers =
    plugin.lspServers ?? (await loadPluginLspServers(plugin, errors))
  if (!servers) {
    return undefined
  }

  // Resolve environment variables
  const resolvedServers: Record<string, LspServerConfig> = {}
  for (const [name, config] of Object.entries(servers)) {
    resolvedServers[name] = resolvePluginLspEnvironment(config, plugin, errors)
  }

  // Add plugin scope
  return addPluginScopeToLspServers(resolvedServers, plugin.name)
}

/**
 * Extract all LSP servers from loaded plugins.
 * Mirrors beta's extractLspServersFromPlugins exactly.
 */
export async function extractLspServersFromPlugins(
  plugins: LoadedPlugin[],
  errors: PluginError[] = [],
): Promise<Record<string, ScopedLspServerConfig>> {
  const allServers: Record<string, ScopedLspServerConfig> = {}

  for (const plugin of plugins) {
    if (!plugin.enabled) continue

    const servers = await loadPluginLspServers(plugin, errors)
    if (servers) {
      const scopedServers = addPluginScopeToLspServers(servers, plugin.name)
      Object.assign(allServers, scopedServers)
      plugin.lspServers = servers

      logForDebugging(
        `Loaded ${Object.keys(servers).length} LSP servers from plugin ${plugin.name}`,
      )
    }
  }

  return allServers
}
