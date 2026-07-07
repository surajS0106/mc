/**
 * Plugin loader — mirrors beta's utils/plugins/pluginLoader.ts interface.
 *
 * The beta loads plugins from a marketplace system (Git repos, NPM, etc).
 * We load plugins from two directories:
 *   - ~/.my-code/plugins/*.js       (user-wide)
 *   - <cwd>/.my-code/plugins/*.js   (project-specific)
 *
 * Each plugin directory may also contain a plugin.json manifest and a
 * .lsp.json file declaring LSP servers — exactly as the beta expects.
 *
 * The public API is identical to the beta:
 *   - loadAllPluginsCacheOnly() → PluginLoadResult
 *   - clearPluginCache()
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { logForDebugging } from '../debug.js'
import { toError, isENOENT } from '../errors.js'
import { logError } from '../log.js'
import { jsonParse } from '../slowOperations.js'
import type { LoadedPlugin, PluginError, PluginLoadResult, PluginManifest } from '../../types/plugin.js'
import type { LspServerConfig } from '../../services/lsp/types.js'

// ─── Plugin directories (same paths as our plugins/index.ts) ─────────────────

function userPluginDir(): string {
  return path.join(os.homedir(), '.my-code', 'plugins')
}

function projectPluginDir(cwd: string): string {
  return path.join(cwd, '.my-code', 'plugins')
}

// ─── Discover plugin directories ─────────────────────────────────────────────

/**
 * Each plugin lives in its own subdirectory under the plugins dir.
 * We also support bare .js files (our legacy format) as single-file plugins
 * without a manifest or .lsp.json.
 */
async function listPluginDirs(dir: string): Promise<Array<{ pluginPath: string; source: string }>> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const results: Array<{ pluginPath: string; source: string }> = []

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // Plugin as a directory (has manifest + .lsp.json support)
        results.push({ pluginPath: fullPath, source: dir })
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
        // Legacy single-file plugin — treat parent dir as its "plugin dir"
        // These don't support .lsp.json (no directory to put it in)
        results.push({ pluginPath: fullPath, source: dir })
      }
    }

    return results
  } catch {
    return []
  }
}

// ─── Load plugin manifest ─────────────────────────────────────────────────────

async function loadPluginManifest(pluginPath: string): Promise<PluginManifest> {
  // If pluginPath is a file, no manifest
  try {
    const stat = await fs.stat(pluginPath)
    if (!stat.isDirectory()) return {}
  } catch {
    return {}
  }

  const manifestPath = path.join(pluginPath, 'plugin.json')
  try {
    const content = await fs.readFile(manifestPath, 'utf-8')
    return jsonParse(content) as PluginManifest
  } catch (error) {
    if (!isENOENT(error)) {
      logError(toError(error))
    }
    return {}
  }
}

// ─── Load .lsp.json from plugin directory ────────────────────────────────────

async function loadPluginLspJson(pluginPath: string): Promise<Record<string, LspServerConfig> | undefined> {
  // Only directories can have .lsp.json
  try {
    const stat = await fs.stat(pluginPath)
    if (!stat.isDirectory()) return undefined
  } catch {
    return undefined
  }

  const lspJsonPath = path.join(pluginPath, '.lsp.json')
  try {
    const content = await fs.readFile(lspJsonPath, 'utf-8')
    const parsed = jsonParse(content) as Record<string, LspServerConfig>
    logForDebugging(`Loaded .lsp.json from ${pluginPath}: ${Object.keys(parsed).length} server(s)`)
    return parsed
  } catch (error) {
    if (!isENOENT(error)) {
      logError(toError(error))
    }
    return undefined
  }
}

// ─── Load a single plugin ─────────────────────────────────────────────────────

async function loadPlugin(
  pluginPath: string,
  source: 'user' | 'project',
  errors: PluginError[],
): Promise<LoadedPlugin | undefined> {
  try {
    const stat = await fs.stat(pluginPath)
    const isDir = stat.isDirectory()
    const name = path.basename(pluginPath, path.extname(pluginPath))

    const [manifest, lspServers] = await Promise.all([
      loadPluginManifest(pluginPath),
      isDir ? loadPluginLspJson(pluginPath) : Promise.resolve(undefined),
    ])

    // Check if there is a manifest.lspServers field (inline config)
    let inlineLspServers: Record<string, LspServerConfig> | undefined
    if (manifest.lspServers && typeof manifest.lspServers === 'object' && !Array.isArray(manifest.lspServers)) {
      inlineLspServers = manifest.lspServers as Record<string, LspServerConfig>
    }

    const mergedLspServers = lspServers ?? inlineLspServers

    const plugin: LoadedPlugin = {
      name,
      manifest,
      path: isDir ? pluginPath : path.dirname(pluginPath),
      source,
      repository: source,
      enabled: true,
      lspServers: mergedLspServers,
    }

    return plugin
  } catch (error) {
    errors.push({
      type: 'generic-error',
      source,
      plugin: path.basename(pluginPath),
      error: toError(error).message,
    })
    return undefined
  }
}

// ─── Memoized cache (mirrors beta's memoize pattern) ─────────────────────────

let _cache: Promise<PluginLoadResult> | undefined

/**
 * Load all plugins from user and project directories.
 *
 * Returns the same { enabled, disabled, errors } shape as beta's loadAllPluginsCacheOnly.
 * Memoized — subsequent calls return the same promise (same session).
 */
export function loadAllPluginsCacheOnly(): Promise<PluginLoadResult> {
  if (_cache) return _cache
  _cache = _loadAllPlugins()
  return _cache
}

async function _loadAllPlugins(): Promise<PluginLoadResult> {
  const errors: PluginError[] = []
  const cwd = process.cwd()

  // Discover plugin entries from both dirs
  const [userEntries, projectEntries] = await Promise.all([
    listPluginDirs(userPluginDir()),
    listPluginDirs(projectPluginDir(cwd)),
  ])

  // Load all plugins in parallel
  const allEntries = [
    ...userEntries.map(e => ({ ...e, source: 'user' as const })),
    ...projectEntries.map(e => ({ ...e, source: 'project' as const })),
  ]

  const pluginResults = await Promise.all(
    allEntries.map(({ pluginPath, source }) => loadPlugin(pluginPath, source, errors))
  )

  const allPlugins = pluginResults.filter((p): p is LoadedPlugin => p !== undefined)
  const enabledPlugins = allPlugins.filter(p => p.enabled !== false)
  const disabledPlugins = allPlugins.filter(p => p.enabled === false)

  logForDebugging(
    `[Plugin Loader] Found ${allPlugins.length} plugins (${enabledPlugins.length} enabled)`,
  )

  return {
    enabled: enabledPlugins,
    disabled: disabledPlugins,
    errors,
  }
}

/**
 * Clear the memoized plugin cache — mirrors beta's clearPluginCache().
 * Call after installing/uninstalling plugins or when plugin dirs change.
 */
export function clearPluginCache(reason?: string): void {
  if (reason) {
    logForDebugging(`clearPluginCache: ${reason}`)
  }
  _cache = undefined
}
