# my-code

A coding agent that runs on your machine, in your editor.

Powered by [Ollama](https://ollama.com) — bring any local model, or use Ollama Cloud for the big ones.

## Features

- **Chat panel** in the activity bar with streaming markdown + syntax highlighting.
- **Selection context** — `Cmd/Ctrl+L` sends the highlighted code to chat.
- **Tools the agent can use**: Read, Grep, Glob, WebFetch, WebSearch, Edit, Write, Bash, TodoWrite, NotebookEdit, plus plan/worktree mode toggles.
- **Diff preview** — every Edit/Write shows a side-by-side diff before anything hits disk. Apply or reject from the chat.
- **Integrated terminal** — Bash commands run in a dedicated my-code terminal so you watch them live.
- **Permissions** — session/project/global rules with hardcoded denies for genuinely dangerous shell.
- **Slash commands** — `/clear`, `/compact`, `/cost`, `/sessions`, `/resume`, `/model`, `/plan`, `/permissions`, and more.
- **MCP servers** — drop a `~/.my-code/mcp.json` or workspace `.my-code/mcp.json` and your servers' tools become callable.
- **@-file mentions** — type `@` in the input to reference workspace files by name.
- **Status bar** — current model, token count, plan/bypass tags, click to switch.
- **Code actions** — "Explain this" and "Fix this error" lightbulbs on selections and diagnostics.
- **Sessions on disk** — every conversation is appended to `~/.ig/projects/<hash>/sessions/`. Resume any past session.

## Setup

1. Install [Ollama](https://ollama.com) and pull a coding-capable model:
   ```bash
   ollama pull qwen2.5-coder
   ```
2. Open the my-code panel from the activity bar (left edge).
3. The first installed model is used by default; switch via the status bar or `/model`.

For Ollama Cloud, run **my-code: Set Ollama Cloud API Key** from the command palette — the key is stored in VS Code's encrypted SecretStorage.

## Settings

| Setting | Default | Notes |
|---|---|---|
| `myCode.model` | (auto) | Empty = auto-pick the first installed model. |
| `myCode.ollama.host` | `http://localhost:11434` | Set to `https://ollama.com` for Cloud. |
| `myCode.ollama.apiKey` | (empty) | Plain-text fallback for the Cloud key. Prefer SecretStorage. |
| `myCode.permissionMode` | `normal` | `normal` / `accept-edits` / `bypass`. |
| `myCode.autoCompact` | `true` | Auto-compact when context is near full. |

## Permission modes

- **normal** — every Edit/Write/Bash prompts you (with session/project rule suggestions).
- **accept-edits** — Edit/Write apply automatically; Bash still prompts.
- **bypass** — everything auto-allowed (still subject to hardcoded denies for `rm -rf /`, fork bombs, etc.). Dangerous; use with care.

## Plan mode

Toggle from the chat panel toolbar or via `/plan on`. Blocks any tool that mutates state — useful for letting the agent explore a codebase without risk.

## Sharing config with the CLI

The companion CLI uses the same `~/.ig/` directory:

- `~/.ig/projects/<hash>/sessions/` — transcripts (resumable from either)
- `~/.ig/settings.json` — global permission rules
- `<workspace>/.ig/settings.json` — project permission rules
- `~/.my-code/mcp.json` and `<workspace>/.my-code/mcp.json` — MCP servers

## Build from source

```bash
cd extension
npm install
node esbuild.mjs
```

Open this folder in VS Code and press F5 to launch the Extension Development Host.

## Package for distribution

```bash
npx vsce package
```
