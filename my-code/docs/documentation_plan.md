# 📖 my-code Codebase — Deep Documentation Plan

> **Scope:** Full architectural documentation of `C:\Users\RengarajKamatchinath\Downloads\my code beta\src`  
> **Total:** ~35 directories, ~550+ files, ~10MB+ of TypeScript/TSX  
> **Output:** A series of markdown documents covering every layer of the system

---

## Phase 1: Foundation & Architecture Overview

### Doc 1 — `00_architecture_overview.md`
High-level system map. What this codebase IS, what problem it solves, and how all the layers connect.

| Section | Covers |
|---|---|
| System Identity | What "my-code code" / "tengu" is — an agentic AI coding assistant CLI |
| Technology Stack | TypeScript, React (ink for terminal UI), Bun bundler, Commander.js CLI |
| Architectural Layers | Entry → Bootstrap → State → Query Loop → Tools → UI rendering |
| Data Flow Diagram | Mermaid diagram: User Input → REPL → QueryEngine → LLM API → Tool Execution → Response |
| Directory Map | Complete tree with 1-line purpose for every top-level directory |

**Files to analyze:**
- `src/main.tsx` (4685 lines — the CLI entry point)
- `src/setup.ts` (479 lines — environment bootstrap)
- `src/entrypoints/init.ts`, `cli.tsx`, `mcp.ts`

---

## Phase 2: Bootstrap & Lifecycle

### Doc 2 — `01_bootstrap_and_lifecycle.md`
How the application starts, initializes, and shuts down.

| Section | Covers |
|---|---|
| Entry Points | `main.tsx` → `cli.tsx` → `init.ts` — the 3-stage startup |
| Bootstrap State | `bootstrap/state.ts` (56KB!) — ALL global runtime state variables |
| Setup Flow | `setup.ts` — Node version check, worktree creation, plugin loading, permission validation |
| Migrations | `migrations/` — How model strings and settings evolve across versions |
| Shutdown | `utils/gracefulShutdown.ts` — cleanup registry, session persistence on exit |
| Environment | `utils/env.ts`, `envDynamic.ts`, `envUtils.ts` — environment detection |

**Files to analyze:**
- `src/bootstrap/state.ts`
- `src/entrypoints/init.ts`
- `src/entrypoints/cli.tsx`
- `src/setup.ts`
- `src/utils/gracefulShutdown.ts`

---

## Phase 3: The Query Engine (The Brain)

### Doc 3 — `02_query_engine.md`
The core agentic loop — how prompts are sent, streamed, and tool calls are orchestrated.

| Section | Covers |
|---|---|
| Query Loop | `query.ts` — the `async function* queryLoop()` generator |
| Query Config | `query/config.ts`, `query/deps.ts` — feature flags and dependency injection |
| Token Budget | `query/tokenBudget.ts`, `utils/tokens.ts` — how token limits are tracked |
| Context Compression | Autocompact, Microcompact, Snip, Context Collapse — 4 distinct compression strategies |
| Streaming | How the LLM API response is streamed and parsed block-by-block |
| Tool Orchestration | `services/tools/StreamingToolExecutor.ts`, `toolOrchestration.ts` |
| Stop Hooks | `query/stopHooks.ts` — how the loop decides to stop |
| Fallback & Recovery | Max output token recovery, reactive compact, prompt-too-long handling |
| Transitions | `query/transitions.ts` — Terminal vs Continue states |

**Files to analyze:**
- `src/query.ts` (1731 lines)
- `src/QueryEngine.ts` (46KB)
- `src/query/` directory (5 files)
- `src/services/compact/` directory
- `src/services/tools/`

---

## Phase 4: Tools (The AI's Hands)

### Doc 4 — `03_tools_reference.md`
Complete reference for every tool the LLM can invoke.

| Tool | Directory | Purpose |
|---|---|---|
| `BashTool` | `tools/BashTool/` | Execute shell commands in a sandboxed environment |
| `PowerShellTool` | `tools/PowerShellTool/` | Windows-specific shell execution |
| `FileReadTool` | `tools/FileReadTool/` | Read file contents with line range support |
| `FileEditTool` | `tools/FileEditTool/` | Apply precise edits to files (search & replace) |
| `FileWriteTool` | `tools/FileWriteTool/` | Create new files |
| `GrepTool` | `tools/GrepTool/` | Regex search across the codebase (ripgrep wrapper) |
| `GlobTool` | `tools/GlobTool/` | Find files by pattern |
| `AgentTool` | `tools/AgentTool/` | Spawn parallel sub-agents for complex tasks |
| `WebSearchTool` | `tools/WebSearchTool/` | Search the internet |
| `WebFetchTool` | `tools/WebFetchTool/` | Fetch and parse web page content |
| `MCPTool` | `tools/MCPTool/` | Call external MCP server tools |
| `LSPTool` | `tools/LSPTool/` | Query Language Server Protocol for code intelligence |
| `NotebookEditTool` | `tools/NotebookEditTool/` | Edit Jupyter notebooks |
| `TaskCreateTool` | `tools/TaskCreateTool/` | Create background tasks |
| `TaskListTool` / `TaskGetTool` / `TaskStopTool` / `TaskUpdateTool` / `TaskOutputTool` | `tools/Task*Tool/` | Manage background task lifecycle |
| `TeamCreateTool` / `TeamDeleteTool` | `tools/Team*Tool/` | Manage agent swarm teams |
| `SendMessageTool` | `tools/SendMessageTool/` | Send messages between agents |
| `SleepTool` | `tools/SleepTool/` | Pause execution |
| `SkillTool` | `tools/SkillTool/` | Invoke a registered skill |
| `TodoWriteTool` | `tools/TodoWriteTool/` | Manage a to-do list |
| `ConfigTool` | `tools/ConfigTool/` | Read/write configuration |
| `EnterPlanModeTool` / `ExitPlanModeTool` | `tools/Enter/ExitPlanModeTool/` | Switch between plan and execution modes |
| `EnterWorktreeTool` / `ExitWorktreeTool` | `tools/Enter/ExitWorktreeTool/` | Manage git worktree context |
| `ScheduleCronTool` | `tools/ScheduleCronTool/` | Schedule recurring tasks |
| `SyntheticOutputTool` | `tools/SyntheticOutputTool/` | Structured output for SDK consumers |
| `ToolSearchTool` | `tools/ToolSearchTool/` | Search available tools |
| `BriefTool` | `tools/BriefTool/` | Control output verbosity |
| `REPLTool` | `tools/REPLTool/` | Run code in a REPL session |

**For each tool, document:**
- Input schema (parameters)
- Output format
- Permission requirements
- Sandbox behavior
- How the prompt describes it to the LLM

---

## Phase 5: Commands (User Slash Commands)

### Doc 5 — `04_commands_reference.md`
All `/slash` commands the user can type in the REPL.

| Category | Commands |
|---|---|
| **Session** | `/clear`, `/exit`, `/resume`, `/session`, `/rename`, `/export`, `/share` |
| **Model & Config** | `/model`, `/config`, `/theme`, `/effort`, `/fast`, `/output-style` |
| **Git & Code** | `/commit`, `/review`, `/diff`, `/branch`, `/rewind` |
| **Memory** | `/memory`, `/compact`, `/context` |
| **Tools & Plugins** | `/mcp`, `/plugin`, `/skills`, `/reload-plugins` |
| **Debugging** | `/doctor`, `/stats`, `/cost`, `/debug-tool-call`, `/heapdump` |
| **Advanced** | `/teleport`, `/plan`, `/ultraplan`, `/bridge`, `/remote-env`, `/vim` |
| **Permissions** | `/permissions`, `/sandbox-toggle` |
| **Agent Swarms** | `/agents`, `/tasks` |

**Files to analyze:**
- `src/commands.ts` (25KB — command registry)
- `src/commands/` (87 subdirectories + 15 root files)

---

## Phase 6: Services Layer

### Doc 6 — `05_services_deep_dive.md`
Backend services that power the AI's intelligence beyond the query loop.

| Service | Path | Purpose |
|---|---|---|
| **API Client** | `services/api/` | HTTP calls to the LLM backend, retry logic, streaming |
| **Compact Engine** | `services/compact/` | Autocompact, reactive compact, snip compact |
| **MCP Client** | `services/mcp/` | Model Context Protocol — external tool server connections |
| **Analytics** | `services/analytics/` | GrowthBook feature flags, event tracking, telemetry sinks |
| **OAuth** | `services/oauth/` | Console authentication flow |
| **Session Memory** | `services/SessionMemory/` | Persistent memory across sessions |
| **Team Memory Sync** | `services/teamMemorySync/` | Cross-agent shared memory |
| **Agent Summary** | `services/AgentSummary/` | Summarize sub-agent results |
| **Prompt Suggestion** | `services/PromptSuggestion/` | Suggest next prompts to the user |
| **Tool Use Summary** | `services/toolUseSummary/` | Summarize tool execution history for compaction |
| **LSP** | `services/lsp/` | Language Server Protocol integration |
| **Plugins** | `services/plugins/` | Plugin installation, versioning, lifecycle |
| **Policy Limits** | `services/policyLimits/` | Enterprise policy enforcement |
| **Remote Managed Settings** | `services/remoteManagedSettings/` | Server-side configuration overrides |
| **Rate Limiting** | `services/rateLimitMessages.ts`, `mockRateLimits.ts` | Rate limit handling & messaging |
| **Voice** | `services/voice.ts`, `voiceStreamSTT.ts` | Voice input via speech-to-text |
| **Tips** | `services/tips/` | Contextual tips shown to users |
| **VCR** | `services/vcr.ts` | Record and replay API interactions for testing |

---

## Phase 7: State Management

### Doc 7 — `06_state_management.md`
How global state flows through the application.

| Module | Path | Purpose |
|---|---|---|
| Bootstrap State | `bootstrap/state.ts` | All global variables — session ID, CWD, model, permissions, flags |
| App State Store | `state/AppStateStore.ts` | The central `AppState` type — tools, MCP, permissions, model |
| State Reactions | `state/onChangeAppState.ts` | Side effects when state changes |
| React Contexts | `context/` | React context providers (modals, notifications, stats, voice, FPS) |
| Store | `state/store.ts` | Zustand-like store creation |

---

## Phase 8: UI Components (Terminal Ink)

### Doc 8 — `07_terminal_ui.md`
The full terminal UI component tree.

| Section | Covers |
|---|---|
| Ink Framework | `src/ink/` — Custom fork of Ink (React for terminals). Includes layout engine, ANSI rendering, virtual DOM reconciler |
| App Shell | `components/App.tsx` → `screens/REPL.tsx` (895KB! The main screen) |
| Message Rendering | `components/Messages.tsx` → `MessageRow.tsx` → `Message.tsx` → `Markdown.tsx` |
| Input System | `components/PromptInput/`, `TextInput.tsx`, `BaseTextInput.tsx`, `VimTextInput.tsx` |
| Dialogs | Trust, MCP approval, permissions, cost threshold, settings |
| Scrolling & Virtual List | `VirtualMessageList.tsx`, `ScrollKeybindingHandler.tsx` |
| Diff Views | `StructuredDiff/`, `FileEditToolDiff.tsx` |
| Status & Chrome | `StatusLine.tsx`, `Stats.tsx`, `LogoV2/` |

---

## Phase 9: Bridge & Remote

### Doc 9 — `08_bridge_and_remote.md`
How the CLI connects to external environments (IDE integration, remote sessions, SSH).

| Module | Path | Purpose |
|---|---|---|
| Bridge Core | `bridge/replBridge.ts` (100KB!) | WebSocket bridge connecting CLI ↔ IDE (VSCode, JetBrains) |
| Bridge API | `bridge/bridgeApi.ts` | The API surface exposed to the IDE |
| Bridge Messaging | `bridge/bridgeMessaging.ts` | Message serialization between CLI and IDE |
| Remote Session | `remote/RemoteSessionManager.ts` | Manage remote coding sessions |
| SSH | Handled in `main.tsx` `_pendingSSH` | SSH into remote machines and run the agent there |
| Direct Connect | `server/createDirectConnectSession.ts` | `cc://` protocol handler for direct connections |
| Teleport | `utils/teleport.tsx` (175KB!) | Move sessions between local and remote environments |

---

## Phase 10: Permissions & Security

### Doc 10 — `09_permissions_and_security.md`
The multi-layered permission and sandboxing system.

| Module | Path | Purpose |
|---|---|---|
| Permission Modes | `utils/permissions/PermissionMode.ts` | `ask`, `auto`, `bypassPermissions`, `plan` modes |
| Permission Setup | `utils/permissions/permissionSetup.ts` | Initial permission configuration |
| Tool Permission Hook | `hooks/useCanUseTool.tsx` (40KB) | Runtime tool permission checks |
| Sandbox | `utils/sandbox/` | Process-level sandboxing for Bash execution |
| Trust Dialog | `components/TrustDialog/` | First-run trust prompt for new projects |
| Auth | `utils/auth.ts` (65KB) | OAuth, API keys, subscription validation |

---

## Phase 11: Memory, Skills & Plugins

### Doc 11 — `10_memory_skills_plugins.md`
The extensibility and knowledge layers.

| Module | Path | Purpose |
|---|---|---|
| CLAUDE.md | `utils/claudemd.ts` (46KB) | Project-specific instructions loaded from `.my-code/` |
| Memory Dir | `memdir/` | Structured memory storage and retrieval |
| Attachments | `utils/attachments.ts` (127KB!) | Context injection — memory, files, docs attached to queries |
| Skills | `skills/bundled/`, `skills/loadSkillsDir.ts` | Domain-specific knowledge packages |
| Plugins | `plugins/`, `services/plugins/`, `utils/plugins/` | Third-party extension system |
| Output Styles | `outputStyles/loadOutputStylesDir.ts` | Custom output formatting styles |

---

## Phase 12: Hooks, Utilities & Infrastructure

### Doc 12 — `11_hooks_and_utilities.md`
React hooks, lifecycle hooks, and utility infrastructure.

| Section | Covers |
|---|---|
| React Hooks | `hooks/` — 83 custom hooks covering input, voice, typing, permissions, diffs, IDE, tasks |
| System Hooks | `utils/hooks.ts` (159KB!) — SessionStart, PreToolUse, PostToolUse, FileChanged hooks |
| Keybindings | `keybindings/` — Customizable keyboard shortcut system |
| Vim Mode | `vim/` — Full Vim emulation for the input box |
| Git Utils | `utils/git.ts`, `utils/gitDiff.ts`, `utils/worktree.ts` |
| Session Storage | `utils/sessionStorage.ts` (180KB!) — Persist and resume conversations |
| Config | `utils/config.ts` (63KB) — Global and project-level configuration |

---

## Phase 13: Agent Swarms & Coordination

### Doc 13 — `12_agent_swarms.md`
Multi-agent orchestration — how the system spawns and coordinates parallel sub-agents.

| Module | Path | Purpose |
|---|---|---|
| Agent Tool | `tools/AgentTool/` | Spawn sub-agents with isolated contexts |
| Coordinator | `coordinator/coordinatorMode.ts` | Orchestrate multiple agents |
| Teammate | `utils/teammate.ts`, `utils/teammateMailbox.ts` | Inter-agent messaging |
| Swarm Utils | `utils/swarm/` | Reconnection, prompt addendum, snapshot |
| Tasks | `tasks/` | DreamTask, InProcessTeammateTask, LocalShellTask, RemoteAgentTask |
| Buddy | `buddy/` | Companion sprite/notification system |

---

## Phase 14: CLI Output & Non-Interactive Mode

### Doc 14 — `13_cli_and_headless.md`
The headless/print mode and structured output paths.

| Module | Path | Purpose |
|---|---|---|
| Print Mode | `cli/print.ts` (212KB!) | The `-p`/`--print` headless execution path |
| Structured IO | `cli/structuredIO.ts` | JSON/NDJSON output for SDK consumers |
| Remote IO | `cli/remoteIO.ts` | I/O for remote-controlled sessions |
| Exit Handling | `cli/exit.ts` | Clean exit codes and reporting |
| Update | `cli/update.ts` | Auto-update from CLI |

---

## Phase 15: Types, Constants & Schemas

### Doc 15 — `14_types_and_constants.md`
The type system and constant definitions.

| Module | Path | Purpose |
|---|---|---|
| Message Types | `types/message.ts` | `UserMessage`, `AssistantMessage`, `ToolUseBlock`, `StreamEvent` |
| Command Types | `types/command.ts` | Slash command type definitions |
| Hook Types | `types/hooks.ts` | Hook event types |
| Permission Types | `types/permissions.ts` | Permission schemas |
| Plugin Types | `types/plugin.ts` | Plugin interface contracts |
| Constants | `constants/prompts.ts` (54KB!) | The LLM system prompt |
| Tool Limits | `constants/toolLimits.ts` | Max file sizes, output limits |
| OAuth Config | `constants/oauth.ts` | OAuth provider configuration |

---

## Execution Order

| Phase | Doc | Effort | Priority |
|---|---|---|---|
| 1 | Architecture Overview | ⭐ Medium | 🔴 Critical |
| 2 | Bootstrap & Lifecycle | ⭐ Medium | 🔴 Critical |
| 3 | Query Engine | ⭐⭐ Heavy | 🔴 Critical |
| 4 | Tools Reference | ⭐⭐ Heavy | 🔴 Critical |
| 5 | Commands Reference | ⭐ Medium | 🟡 High |
| 6 | Services Deep Dive | ⭐⭐ Heavy | 🟡 High |
| 7 | State Management | ⭐ Medium | 🟡 High |
| 8 | Terminal UI | ⭐⭐ Heavy | 🟡 High |
| 9 | Bridge & Remote | ⭐⭐ Heavy | 🟢 Medium |
| 10 | Permissions & Security | ⭐ Medium | 🟢 Medium |
| 11 | Memory, Skills & Plugins | ⭐ Medium | 🟢 Medium |
| 12 | Hooks & Utilities | ⭐⭐ Heavy | 🟢 Medium |
| 13 | Agent Swarms | ⭐ Medium | 🔵 Lower |
| 14 | CLI & Headless | ⭐ Medium | 🔵 Lower |
| 15 | Types & Constants | ⭐ Light | 🔵 Lower |

---

## Deliverables

Each document will include:
1. **Purpose** — What this layer does and why it exists
2. **File inventory** — Every file with a 1-2 line description
3. **Data flow diagrams** — Mermaid diagrams showing how data moves through the layer
4. **Key interfaces** — Important TypeScript types and function signatures
5. **Integration points** — How this layer connects to other layers
6. **Sequence diagrams** — Step-by-step flows for critical operations
7. **Gotchas & design decisions** — Non-obvious architectural choices explained

---

> [!IMPORTANT]
> This plan covers **15 documents** across **550+ source files**. Each document requires reading and analyzing multiple large files (some over 100KB). I recommend starting with **Phases 1-4** (Architecture, Bootstrap, Query Engine, Tools) as they form the foundation needed to understand everything else.

**Ready to begin? Tell me which phase to start with, or say "go" and I'll begin from Phase 1.**
