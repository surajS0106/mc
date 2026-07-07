import { open, stat } from 'node:fs/promises'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  CallHierarchyIncomingCall,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  DocumentSymbol,
  Hover,
  Location,
  LocationLink,
  SymbolInformation,
} from 'vscode-languageserver-types'
import { z } from 'zod'
import {
  getInitializationStatus,
  getLspServerManager,
  isLspConnected,
  waitForInitialization,
} from '../services/lsp/manager.js'
import { buildTool } from './Tool.js'
import { logForDebugging } from '../utils/debug.js'
import { isENOENT, toError } from '../utils/errors.js'
import { logError } from '../utils/log.js'
import {
  formatDocumentSymbolResult,
  formatFindReferencesResult,
  formatGoToDefinitionResult,
  formatHoverResult,
  formatIncomingCallsResult,
  formatOutgoingCallsResult,
  formatPrepareCallHierarchyResult,
  formatWorkspaceSymbolResult,
} from './lsp/formatters.js'

const execFileAsync = promisify(execFile)
const MAX_LSP_FILE_SIZE_BYTES = 10_000_000

const inputSchema = z.strictObject({
  operation: z
    .enum([
      'goToDefinition',
      'findReferences',
      'hover',
      'documentSymbol',
      'workspaceSymbol',
      'goToImplementation',
      'prepareCallHierarchy',
      'incomingCalls',
      'outgoingCalls',
    ])
    .describe('The LSP operation to perform'),
  filePath: z.string().describe('The absolute or relative path to the file'),
  line: z
    .number()
    .int()
    .positive()
    .describe('The line number (1-based, as shown in editors)'),
  character: z
    .number()
    .int()
    .positive()
    .describe('The character offset (1-based, as shown in editors)'),
})

type Input = z.infer<typeof inputSchema>

export const lspTool = buildTool({
  name: "LSP",
  description: "Code intelligence tool that connects to language servers (LSP) to provide semantic understanding of code. Supports goToDefinition, findReferences, hover, documentSymbol, workspaceSymbol, goToImplementation, and call hierarchies.",
  inputSchema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  isEnabled: () => isLspConnected(),
  getPath: (input) => input.filePath,
  getActivityDescription: (input) => `LSP ${input.operation} on ${input.filePath}`,
  renderToolUse: (input) => `LSP ${input.operation} on ${input.filePath}:${input.line}:${input.character}`,
  async validateInput(input, ctx) {
    const absolutePath = path.resolve(ctx.cwd, input.filePath)
    if (absolutePath.startsWith('\\\\') || absolutePath.startsWith('//')) {
      return { ok: true }
    }
    try {
      const s = await stat(absolutePath)
      if (!s.isFile()) {
        return { ok: false, message: `Path is not a file: ${input.filePath}` }
      }
    } catch (error) {
      if (isENOENT(error)) {
        return { ok: false, message: `File does not exist: ${input.filePath}` }
      }
      return { ok: false, message: `Cannot access file: ${input.filePath}. ${toError(error).message}` }
    }
    return { ok: true }
  },
  async call(input, ctx) {
    const absolutePath = path.resolve(ctx.cwd, input.filePath)
    const cwd = ctx.cwd

    const status = getInitializationStatus()
    if (status.status === 'pending') {
      await waitForInitialization()
    }

    const manager = getLspServerManager()
    if (!manager) {
      logError(new Error('LSP server manager not initialized when tool was called'))
      return 'LSP server manager not initialized. This may indicate a startup issue.'
    }

    const { method, params } = getMethodAndParams(input, absolutePath)

    try {
      if (!manager.isFileOpen(absolutePath)) {
        const handle = await open(absolutePath, 'r')
        try {
          const stats = await handle.stat()
          if (stats.size > MAX_LSP_FILE_SIZE_BYTES) {
            return `File too large for LSP analysis (${Math.ceil(stats.size / 1_000_000)}MB exceeds 10MB limit)`
          }
          const fileContent = await handle.readFile({ encoding: 'utf-8' })
          await manager.openFile(absolutePath, fileContent)
        } finally {
          await handle.close()
        }
      }

      let result = await manager.sendRequest(absolutePath, method, params)

      if (result === undefined) {
        logForDebugging(`No LSP server available for file type ${path.extname(absolutePath)} for operation ${input.operation} on file ${input.filePath}`)
        return `No LSP server available for file type: ${path.extname(absolutePath)}`
      }

      if (input.operation === 'incomingCalls' || input.operation === 'outgoingCalls') {
        const callItems = result as CallHierarchyItem[]
        if (!callItems || callItems.length === 0) {
          return 'No call hierarchy item found at this position'
        }

        const callMethod = input.operation === 'incomingCalls' ? 'callHierarchy/incomingCalls' : 'callHierarchy/outgoingCalls'
        result = await manager.sendRequest(absolutePath, callMethod, { item: callItems[0] })

        if (result === undefined) {
          logForDebugging(`LSP server returned undefined for ${callMethod} on ${input.filePath}`)
        }
      }

      if (result && Array.isArray(result) && (
        input.operation === 'findReferences' ||
        input.operation === 'goToDefinition' ||
        input.operation === 'goToImplementation' ||
        input.operation === 'workspaceSymbol'
      )) {
        if (input.operation === 'workspaceSymbol') {
          const symbols = result as SymbolInformation[]
          const locations = symbols.filter(s => s?.location?.uri).map(s => s.location)
          const filteredLocations = await filterGitIgnoredLocations(locations, cwd)
          const filteredUris = new Set(filteredLocations.map(l => l.uri))
          result = symbols.filter(s => !s?.location?.uri || filteredUris.has(s.location.uri))
        } else {
          const locations = (result as (Location | LocationLink)[]).map(toLocation)
          const filteredLocations = await filterGitIgnoredLocations(locations, cwd)
          const filteredUris = new Set(filteredLocations.map(l => l.uri))
          result = (result as (Location | LocationLink)[]).filter(item => {
            const loc = toLocation(item)
            return !loc.uri || filteredUris.has(loc.uri)
          })
        }
      }

      const { formatted } = formatResult(input.operation, result, cwd)
      return formatted
    } catch (error) {
      const err = toError(error)
      logError(new Error(`LSP tool request failed for ${input.operation} on ${input.filePath}: ${err.message}`))
      return `Error performing ${input.operation}: ${err.message}`
    }
  }
})

function getMethodAndParams(input: Input, absolutePath: string): { method: string; params: unknown } {
  const uri = pathToFileURL(absolutePath).href
  const position = {
    line: input.line - 1,
    character: input.character - 1,
  }

  switch (input.operation) {
    case 'goToDefinition':
      return { method: 'textDocument/definition', params: { textDocument: { uri }, position } }
    case 'findReferences':
      return { method: 'textDocument/references', params: { textDocument: { uri }, position, context: { includeDeclaration: true } } }
    case 'hover':
      return { method: 'textDocument/hover', params: { textDocument: { uri }, position } }
    case 'documentSymbol':
      return { method: 'textDocument/documentSymbol', params: { textDocument: { uri } } }
    case 'workspaceSymbol':
      return { method: 'workspace/symbol', params: { query: '' } }
    case 'goToImplementation':
      return { method: 'textDocument/implementation', params: { textDocument: { uri }, position } }
    case 'prepareCallHierarchy':
      return { method: 'textDocument/prepareCallHierarchy', params: { textDocument: { uri }, position } }
    case 'incomingCalls':
    case 'outgoingCalls':
      return { method: 'textDocument/prepareCallHierarchy', params: { textDocument: { uri }, position } }
  }
}

function uriToFilePath(uri: string): string {
  let filePath = uri.replace(/^file:\/\//, '')
  if (/^\/[A-Za-z]:/.test(filePath)) {
    filePath = filePath.slice(1)
  }
  try {
    filePath = decodeURIComponent(filePath)
  } catch { }
  return filePath
}

async function filterGitIgnoredLocations<T extends Location>(locations: T[], cwd: string): Promise<T[]> {
  if (locations.length === 0) return locations

  const uriToPath = new Map<string, string>()
  for (const loc of locations) {
    if (loc.uri && !uriToPath.has(loc.uri)) {
      uriToPath.set(loc.uri, uriToFilePath(loc.uri))
    }
  }

  const uniquePaths = Array.from(new Set(uriToPath.values()))
  if (uniquePaths.length === 0) return locations

  const ignoredPaths = new Set<string>()
  const BATCH_SIZE = 50
  for (let i = 0; i < uniquePaths.length; i += BATCH_SIZE) {
    const batch = uniquePaths.slice(i, i + BATCH_SIZE)
    try {
      const { stdout } = await execFileAsync('git', ['check-ignore', ...batch], { cwd, timeout: 5_000 })
      if (stdout) {
        for (const line of stdout.split('\n')) {
          const trimmed = line.trim()
          if (trimmed) ignoredPaths.add(trimmed)
        }
      }
    } catch (e: any) {
      if (e.code === 0 && e.stdout) {
        for (const line of e.stdout.split('\n')) {
          const trimmed = line.trim()
          if (trimmed) ignoredPaths.add(trimmed)
        }
      }
    }
  }

  if (ignoredPaths.size === 0) return locations

  return locations.filter(loc => {
    const filePath = uriToPath.get(loc.uri)
    return !filePath || !ignoredPaths.has(filePath)
  })
}

function isLocationLink(item: Location | LocationLink): item is LocationLink {
  return 'targetUri' in item
}

function toLocation(item: Location | LocationLink): Location {
  if (isLocationLink(item)) {
    return { uri: item.targetUri, range: item.targetSelectionRange || item.targetRange }
  }
  return item
}

function formatResult(operation: Input['operation'], result: unknown, cwd: string): { formatted: string } {
  switch (operation) {
    case 'goToDefinition':
    case 'goToImplementation':
      return { formatted: formatGoToDefinitionResult(result as any, cwd) }
    case 'findReferences':
      return { formatted: formatFindReferencesResult(result as any, cwd) }
    case 'hover':
      return { formatted: formatHoverResult(result as any, cwd) }
    case 'documentSymbol':
      return { formatted: formatDocumentSymbolResult(result as any, cwd) }
    case 'workspaceSymbol':
      return { formatted: formatWorkspaceSymbolResult(result as any, cwd) }
    case 'prepareCallHierarchy':
      return { formatted: formatPrepareCallHierarchyResult(result as any, cwd) }
    case 'incomingCalls':
      return { formatted: formatIncomingCallsResult(result as any, cwd) }
    case 'outgoingCalls':
      return { formatted: formatOutgoingCallsResult(result as any, cwd) }
  }
}
