/**
 * LSP service types — mirrors beta's services/lsp/types.ts exactly.
 */

/** Lifecycle state of a single LSP server instance. */
export type LspServerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

/**
 * Base LSP server configuration (as declared in plugin .lsp.json or manifest).
 * Mirrors beta's LspServerConfig exactly.
 */
export type LspServerConfig = {
  /** Command to execute the LSP server */
  command: string
  /** Command-line arguments */
  args?: string[]
  /** Maps file extensions → LSP language IDs. e.g. { ".ts": "typescript" } */
  extensionToLanguage: Record<string, string>
  /** Communication transport (default: stdio) */
  transport?: 'stdio' | 'socket'
  /** Environment variables to set when starting the server */
  env?: Record<string, string>
  /** Initialization options passed during initialize request */
  initializationOptions?: unknown
  /** Settings for workspace/didChangeConfiguration */
  settings?: unknown
  /** Override workspace folder path */
  workspaceFolder?: string
  /** Max ms to wait for server startup */
  startupTimeout?: number
  /** Max ms to wait for graceful shutdown (not yet implemented — throws if set) */
  shutdownTimeout?: number
  /** Whether to restart the server on crash (not yet implemented — throws if set) */
  restartOnCrash?: boolean
  /** Max crash recovery attempts before giving up */
  maxRestarts?: number
}

/**
 * Scoped LSP server config — includes plugin provenance metadata.
 * Mirrors beta's ScopedLspServerConfig exactly.
 */
export type ScopedLspServerConfig = LspServerConfig & {
  /** 'dynamic' for plugin-provided servers */
  scope?: 'dynamic'
  /** Name of the plugin that provided this server */
  source?: string
}
