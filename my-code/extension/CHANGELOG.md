# Changelog

## 0.1.0 — initial

- Chat panel in the activity bar with streaming markdown + syntax highlighting.
- All 15 built-in tools registered: Read, Grep, Glob, WebFetch, WebSearch, Edit, Write, Bash, TodoWrite, NotebookEdit, EnterPlanMode, ExitPlanMode, EnterWorktree, ExitWorktree, Sleep.
- Inline diff preview for Edit/Write with Apply / Reject / View Diff (opens VS Code's native diff editor).
- Integrated terminal for Bash commands — output streams to chat AND a dedicated my-code terminal.
- Permission UI with session / project / global rule suggestions; hardcoded denies for genuinely dangerous shell.
- Plan mode toggle that blocks all mutating tools.
- Slash commands: `/clear`, `/compact`, `/cost`, `/sessions`, `/resume`, `/model`, `/models`, `/tools`, `/todos`, `/plan`, `/bypass`, `/permissions`, `/allow`, `/deny`, `/mcp`, `/init`, `/help`, `/config`, `/worktree`.
- @-file mentions in the composer (workspace file picker).
- MCP server loader (stdio + http transports).
- Session transcripts persisted under `~/.ig/projects/<hash>/sessions/`.
- Status bar item showing model, tokens, plan/bypass state.
- Code actions: "Explain this" on selection, "Fix this" on diagnostics.
- Cmd/Ctrl+L sends current selection as context.
- VS Code SecretStorage for Ollama Cloud API key.
- Cycling thinking-verb spinner during streams.
- Welcome card with rotating tip-of-the-day.
- Auto-compact when context is near full.
