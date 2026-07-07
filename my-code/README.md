# ig

A terminal coding agent — like Claude Code, but powered by any local model via [Ollama](https://ollama.com).

## Features

- Streaming REPL with per-tool-call output
- **Multi-provider seam** — Ollama today; OpenAI / Gemini stubs ready (see `--provider`)
- Built-in tools: `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `TodoWrite`,
  `WebFetch`, `WebSearch`, `NotebookEdit`, `EnterPlanMode` / `ExitPlanMode`,
  `EnterWorktree` / `ExitWorktree`, `Sleep`
- **MCP support** — drop a `~/.reno/mcp.json` (or `<project>/.reno/mcp.json`) to plug in
  Model Context Protocol servers; their tools auto-register
- Permission prompts for destructive tools (`y`/`a`/`n`)
- Slash commands: `/help`, `/tools`, `/model`, `/models`, `/todos`, `/plan`, `/worktree`,
  `/mcp`, `/clear`, `/cost`, `/exit`
- Non-interactive mode (`ig -p "..."`) for scripting
- Project memory: loads `IG.md` from cwd / `.ig/IG.md` / `~/.ig/IG.md` into the system prompt

## MCP configuration

Example `~/.reno/mcp.json`:

```json
{
  "servers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    },
    "remote-example": {
      "type": "http",
      "url": "https://example.com/mcp",
      "token": "..."
    }
  }
}
```

Tools from connected servers appear as `mcp__<server>__<toolname>` in the registry.

## Requirements

- Node.js 18+
- [Ollama](https://ollama.com/download) running locally (`ollama serve`)
- A tool-capable model. Recommended:
  ```
  ollama pull qwen2.5-coder:7b      # best all-round
  ollama pull llama3.1:8b            # solid alternative
  ollama pull mistral-nemo           # strong tool use
  ```
- (optional) `ripgrep` for faster `Grep` — falls back to `grep` if missing

## Install

```bash
cd "/Users/admin/Desktop/Genie Team/ig cli"
npm install
npm run build
npm link          # makes `ig` available on your PATH
```

After `npm link`, just type `ig` anywhere.

## Usage

```bash
ig                                    # interactive REPL
ig -p "explain the code in src/"      # one-shot
ig --model llama3.1:8b                # pick a model
ig --yolo                             # skip permission prompts
```

Environment variables:
- `RENO_MODEL` — default model
- `OLLAMA_HOST` — default Ollama host (default `http://localhost:11434`)

## Project memory (IG.md)

Drop an `IG.md` in your project root with conventions, context, or anything else you want prepended to the system prompt. Mirrors how Claude Code uses `CLAUDE.md`.

## Architecture

```
src/
├── cli.ts                   # entry, REPL, slash commands
├── agent/
│   ├── ollama.ts            # /api/chat streaming client
│   ├── loop.ts              # agent loop: send → parse tool_calls → execute → repeat
│   └── systemPrompt.ts
├── tools/
│   ├── registry.ts          # Tool interface, JSON-Schema export for Ollama
│   ├── read.ts write.ts edit.ts
│   ├── bash.ts              # spawned shell, timeout, output cap
│   ├── glob.ts grep.ts      # ripgrep with grep fallback
│   └── todo.ts              # in-memory task list
└── ui/
    ├── render.ts            # colored tool-call / result formatting
    └── permissions.ts       # y/a/n prompts
```

The loop:
1. Append user message → send conversation + tool schemas to Ollama.
2. Stream assistant tokens; collect any `tool_calls`.
3. For each tool call: prompt for permission if needed, run, append result as `role: "tool"`.
4. Repeat until the model returns no tool calls (or hits `maxIterations`).

## Limitations (v0.1)

- No MCP, subagents, hooks, or IDE extension.
- No context compaction — long sessions will overflow the model's context.
- No session persistence (transcripts lost on exit).
- Open models are weaker at tool calling than Claude; expect occasional malformed args.

## Roadmap

- M5: settings file, allowlists, safety rules for destructive Bash
- M6: context compaction when approaching `num_ctx`
- M7: session save/resume (`ig resume`)
- M8: fancier UI (Ink + markdown rendering)
