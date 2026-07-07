# my-code-desktop

A desktop GUI for the [`my-code`](../my-code) agent — a Claude-Desktop-style
Electron shell with two modes:

- **Chat** — conversational, read-only tool set (no file mutation).
- **Code** — the full coding agent, bound to a project folder (edit / bash /
  plan / worktree / subagents).

There is **no in-process engine**. The agent is the external `my-code` CLI run
in headless `serve` mode; the app spawns it as a child process and drives it
over its JSON-RPC bridge (a Windows named pipe / Unix socket).

```
┌─ Electron (my-code-desktop) ────────────┐
│ renderer (React UI)  ⇄ IPC ⇄  main       │
│                                spawns +  │
│                                pipe RPC  │
└───────────────────────────────┬─────────┘
                                 │ agent/submit · agent/event
                                 │ agent/permission-response
                        ┌────────▼─────────┐
                        │ my-code serve    │
                        │ QueryEngine +    │
                        │ tools + bridge   │
                        └──────────────────┘
```

## Run

```bash
npm install
npm run dev          # electron-vite dev (hot reload)
npm run build        # bundle main + preload + renderer into out/
npm start            # preview the built app
```

The app needs the `my-code` CLI built next to it:

```bash
cd ../my-code && bun run build      # produces dist/cli.js
```

By default the app looks for `../my-code/dist/cli.js`. Override with the
`MY_CODE_CLI` env var (absolute path to the CLI entry). Set `MC_DESKTOP_DEBUG=1`
to see backend stderr.

## Layout

```
electron/
├── main.ts       BrowserWindow, backend lifecycle, IPC relay, folder picker
├── backend.ts    spawns `my-code serve`, JSON-RPC over the named pipe
├── ipc.ts        typed IPC contract + mirrored SessionEvent shapes
└── preload.ts    window.mycode bridge (contextIsolation)
renderer/src/
├── App.tsx           shell + event→transcript reducer
├── transcript.ts     transcript item model
├── Markdown.tsx       lightweight markdown renderer
└── components/
    ├── TitleBar.tsx      frameless bar + Chat/Code tabs + window controls
    ├── Sidebar.tsx       new chat, recents (real my-code sessions), account
    ├── Composer.tsx      input + model pill + context meter
    ├── Transcript.tsx    messages, thinking blocks, tool rows
    ├── ToolCard.tsx      tool card + inline diff + subagent children
    └── PermissionModal.tsx  allow-once / session / always / deny
```

## Backend contract (`my-code serve`)

Added to `my-code` additively (see `my-code/src/cli.ts`):

- `my-code serve --profile <chat|code> [--session <id>]` — boots the engine +
  bridge with no TUI, pre-trusts the cwd, prints a one-line JSON handshake
  (`{ready, socketPath, sessionId, model, cwd, profile}`), then stays alive.
- Bridge methods: `agent/submit`, `agent/cancel`, `agent/compact`,
  `agent/permission-response` (the GUI's allow/deny answer), plus the
  `agent/event` notification stream.

## Per-user data

Sessions live in `my-code`'s own store: `~/.my-code/projects/<hash>/sessions/*.jsonl`.
The Recents list reads that directory directly.
```
