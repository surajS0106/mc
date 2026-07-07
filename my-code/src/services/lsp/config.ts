import type { ScopedLspServerConfig } from './types.js'
import { loadAllPluginsCacheOnly } from '../../utils/plugins/pluginLoader.js'
import { extractLspServersFromPlugins } from '../../utils/plugins/lspPluginIntegration.js'

export async function getAllLspServers(): Promise<{
  servers: Record<string, ScopedLspServerConfig>
}> {
  try {
    const { enabled: plugins } = await loadAllPluginsCacheOnly()
    const servers = await extractLspServersFromPlugins(plugins, [])
    return { servers }
  } catch (error) {
    // Fallback if plugin loading fails
    return { servers: {} }
  }
}
