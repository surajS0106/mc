# 📋 Commands, Services, State & UI

> Phases 5–8 of the documentation: slash commands, backend services, state management, and terminal UI.

---

# Phase 5: Commands Reference

**Registry:** `src/commands.ts` (759 lines)  
**Directory:** `src/commands/` (87 subdirectories + 15 root files)

## Command Types
```typescript
type Command = 
  | PromptCommand      // Expands to a prompt sent to LLM (skills)
  | LocalCommand       // Executes locally, returns text
  | LocalJSXCommand    // Renders React/Ink UI in terminal
```

## All Commands by Category

### Session Management
| Command | Type | Description |
|---|---|---|
| `/clear` | local | Clear conversation history |
| `/exit` | local | Exit the application |
| `/resume` | local-jsx | Resume a previous conversation |
| `/session` | local-jsx | Show session info / QR code |
| `/rename` | local | Rename current session |
| `/export` | local | Export conversation |
| `/share` | local | Upload transcript for sharing |
| `/compact` | local | Force context compaction |
| `/rewind` | local-jsx | Rewind to a previous state |

### Model & Configuration
| Command | Type | Description |
|---|---|---|
| `/model` | local-jsx | Change the active model |
| `/config` | local-jsx | Edit settings interactively |
| `/theme` | local-jsx | Change terminal theme |
| `/effort` | local | Set effort level (low/medium/high/max) |
| `/fast` | local | Toggle fast mode |
| `/output-style` | local-jsx | Change output formatting |
| `/vim` | local | Toggle vim mode |

### Git & Code
| Command | Type | Description |
|---|---|---|
| `/commit` | prompt | Generate commit message and commit |
| `/review` | prompt | Code review current changes |
| `/diff` | local-jsx | Show git diff |
| `/branch` | local-jsx | Branch management |
| `/pr_comments` | prompt | Review PR comments |

### Memory & Context
| Command | Type | Description |
|---|---|---|
| `/memory` | local-jsx | View/edit persistent memory |
| `/context` | local | Show current context usage |
| `/files` | local | List tracked files |

### Tools & Plugins
| Command | Type | Description |
|---|---|---|
| `/mcp` | local-jsx | Manage MCP servers |
| `/plugin` | local-jsx | Install/manage plugins |
| `/skills` | local-jsx | List available skills |
| `/reload-plugins` | local | Reload plugin state |

### Debugging
| Command | Type | Description |
|---|---|---|
| `/doctor` | local-jsx | Diagnostic health check |
| `/stats` | local | Show session statistics |
| `/cost` | local | Show API cost breakdown |
| `/status` | local | Show system status |
| `/heapdump` | local | Memory diagnostics |

### Advanced
| Command | Type | Description |
|---|---|---|
| `/teleport` | local-jsx | Move session to remote |
| `/plan` | local | Toggle plan mode |
| `/permissions` | local-jsx | Manage permission rules |
| `/sandbox-toggle` | local | Toggle sandbox mode |
| `/agents` | local-jsx | View/manage agents |
| `/tasks` | local-jsx | View background tasks |
| `/ide` | local | Connect to IDE |

### Skill Commands
Skills are prompt-type commands loaded from:
- `.claude/commands/` — Project-specific
- `~/.claude/commands/` — User-wide
- Bundled skills — Shipped with the application
- Plugin skills — From installed plugins

---

# Phase 6: Services Layer

**Directory:** `src/services/` (~40 files across multiple subdirectories)

| Service | Path | Purpose |
|---|---|---|
| **API Client** | `services/api/` | HTTP calls to Anthropic, retry logic, streaming, cache control |
| **Compact Engine** | `services/compact/` | Autocompact, reactive compact, cached microcompact |
| **MCP Client** | `services/mcp/` | Model Context Protocol connections, tool/resource discovery |
| **Analytics** | `services/analytics/` | GrowthBook feature flags, event logging, telemetry |
| **OAuth** | `services/oauth/` | Console authentication, token refresh |
| **Session Memory** | `services/SessionMemory/` | Cross-session persistent memory |
| **Team Memory Sync** | `services/teamMemorySync/` | Cross-agent memory sharing |
| **Agent Summary** | `services/AgentSummary/` | Summarize sub-agent execution results |
| **Prompt Suggestion** | `services/PromptSuggestion/` | Suggest next prompts to user |
| **Tool Use Summary** | `services/toolUseSummary/` | Summarize tool execution for compaction |
| **LSP** | `services/lsp/` | Language Server Protocol integration |
| **Plugins** | `services/plugins/` | Plugin installation, versioning, lifecycle |
| **Policy Limits** | `services/policyLimits/` | Enterprise policy enforcement |
| **Remote Settings** | `services/remoteManagedSettings/` | Server-side config overrides |
| **Rate Limiting** | `services/rateLimitMessages.ts` | Rate limit handling & user messaging |
| **Voice** | `services/voice.ts` | Speech-to-text voice input |
| **Tips** | `services/tips/` | Contextual tips for users |
| **VCR** | `services/vcr.ts` | Record and replay API interactions (testing) |

### Key Service: Compact Engine
```
services/compact/
├── autocompact.ts          # Full summarization when context is full
├── cachedMCConfig.ts       # Cached microcompact configuration  
├── compactService.ts       # Core compaction logic
├── contextCollapse.ts      # Collapse tool groups
├── microcompact.ts         # In-place tool output compression
├── reactiveCompact.ts      # Triggered by prompt-too-long errors
└── snipCompact.ts          # Remove irrelevant history entries
```

### Key Service: MCP Client
```
services/mcp/
├── connection.ts           # Server connection lifecycle
├── discovery.ts            # Tool and resource discovery
├── elicitationHandler.ts   # Handle MCP elicitation requests
├── types.ts                # MCPServerConnection types
├── channelPermissions.ts   # Permission prompt over channels
└── toolExecution.ts        # Execute MCP tool calls
```

---

# Phase 7: State Management

**Directory:** `src/state/` (6 files)

## The Two State Systems

### 1. Bootstrap State (`bootstrap/state.ts`)
- **Module-level singleton** — not React
- Low-level runtime state (session ID, CWD, costs, tokens)
- Accessed via getter/setter functions
- Must be at the bottom of the import DAG (no circular deps)

### 2. App State (`state/AppStateStore.ts`)
- **React-compatible store** — drives UI re-renders
- High-level application state (tools, MCP, permissions, model)
- Accessed via `getAppState()` / `setAppState()`

## AppState Shape (key fields)

```typescript
type AppState = {
  // Configuration
  settings: SettingsJson
  verbose: boolean
  mainLoopModel: ModelSetting
  
  // Permissions
  toolPermissionContext: ToolPermissionContext  // mode, rules, dirs
  
  // MCP Integration  
  mcp: {
    clients: MCPServerConnection[]
    tools: Tool[]
    commands: Command[]
    resources: Record<string, ServerResource[]>
  }
  
  // Plugins
  plugins: {
    enabled: LoadedPlugin[]
    disabled: LoadedPlugin[]
    commands: Command[]
    errors: PluginError[]
  }
  
  // Tasks & Agents
  tasks: { [taskId: string]: TaskState }
  agentNameRegistry: Map<string, AgentId>
  agentDefinitions: AgentDefinitionsResult
  
  // Bridge (IDE connection)
  replBridgeEnabled: boolean
  replBridgeConnected: boolean
  replBridgeSessionActive: boolean
  
  // Session
  fileHistory: FileHistoryState
  attribution: AttributionState
  thinkingEnabled: boolean
  speculation: SpeculationState
  initialMessage: { message, clearContext?, mode? } | null
}
```

## React Contexts (`src/context/`)

| Context | File | Purpose |
|---|---|---|
| **Notifications** | `notifications.tsx` | Toast notifications queue |
| **Modals** | `modalContext.tsx` | Dialog management |
| **Overlays** | `overlayContext.tsx` | Overlay stack (Select, etc.) |
| **Prompt Overlay** | `promptOverlayContext.tsx` | Prompt input overlays |
| **Stats** | `stats.tsx` | Performance statistics |
| **Voice** | `voice.tsx` | Voice input state |
| **FPS Metrics** | `fpsMetrics.tsx` | Frame rate monitoring |
| **Mailbox** | `mailbox.tsx` | Inter-agent messaging |
| **Queued Messages** | `QueuedMessageContext.tsx` | Message queue management |

---

# Phase 8: Terminal UI Architecture

## Custom Ink Fork — `src/ink/` (48 files)

The system uses a **heavily customized fork of Ink** (React for terminals):

| Module | Purpose |
|---|---|
| `ink.tsx` (251KB!) | Core Ink runtime with custom extensions |
| `reconciler.ts` | React reconciler for terminal DOM |
| `render-node-to-output.ts` (63KB) | Convert React tree to ANSI output |
| `screen.ts` (49KB) | Terminal screen management |
| `selection.ts` (34KB) | Text selection support |
| `parse-keypress.ts` (23KB) | Keyboard input parsing |
| `output.ts` (26KB) | ANSI output buffering |
| `log-update.ts` (27KB) | Efficient terminal updates |

## Main Screen — `screens/REPL.tsx` (895KB!)

This is the **largest file** in the codebase. It:
- Renders the full chat interface
- Manages message state
- Handles keyboard input
- Orchestrates the query engine
- Manages tool JSX overlays
- Coordinates bridge connections
- Handles session resume/restore

## Component Tree

```
REPL.tsx
├── Messages.tsx / VirtualMessageList.tsx
│   ├── MessageRow.tsx
│   │   ├── Message.tsx
│   │   │   ├── Markdown.tsx
│   │   │   └── ToolUse blocks (per tool)
│   │   └── AgentProgressLine.tsx
│   └── ScrollKeybindingHandler.tsx
├── PromptInput/
│   ├── TextInput.tsx / VimTextInput.tsx
│   ├── PromptInputFooter.tsx
│   └── TypeaheadOverlay.tsx
├── StatusLine.tsx
├── Stats.tsx
├── LogoV2/
├── Dialogs (Trust, MCP, Permissions, Cost)
└── DevBar.tsx
```
