import * as vscode from "vscode";
import { spawn, type ChildProcess } from "node:child_process";
import { z } from "zod";
import { buildTool, type Tool } from "../../../src/tools/Tool.js";
import { backgroundShells } from "./BackgroundShellRegistry.js";

const MAX_OUTPUT_BYTES = 30_000;
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60_000; // kill if silent for 5 min
const MAX_IDLE_TIMEOUT_MS = 30 * 60_000; // 30 min absolute cap on idle window
const ABSOLUTE_MAX_MS = 60 * 60_000; // 1 hour wall-clock kill switch
const BG_FIRST_OUTPUT_WAIT_MS = 2_000;
const BG_FIRST_OUTPUT_LINES = 8;
const IS_WINDOWS = process.platform === "win32";

const schema = z.object({
  command: z.string(),
  timeout: z
    .number()
    .optional()
    .describe(
      "Optional absolute wall-clock cap in ms. Most commands should NOT set this — the tool kills only on prolonged silence. Use only when you need a hard upper bound (e.g. ping, polling).",
    ),
  cwd: z.string().optional(),
  run_in_background: z
    .boolean()
    .optional()
    .describe(
      "Set true ONLY for processes whose intent is to keep running (dev servers, watchers, daemons). Returns immediately with a bash_id; the process keeps running. Use BashOutput(bash_id) to read new output, KillBash(bash_id) to stop. For installs/builds/tests use foreground — the tool tolerates long durations as long as output keeps flowing.",
    ),
});

function truncate(s: string): string {
  if (s.length <= MAX_OUTPUT_BYTES) return s;
  const head = s.slice(0, 5_000);
  const tail = s.slice(-MAX_OUTPUT_BYTES + 5_000);
  return `${head}\n...[truncated ${s.length - MAX_OUTPUT_BYTES} bytes]...\n${tail}`;
}

interface BashHostState {
  terminal: vscode.Terminal | undefined;
  pty: BashPty | undefined;
}
const hostState: BashHostState = { terminal: undefined, pty: undefined };

class BashPty implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  private closeEmitter = new vscode.EventEmitter<number>();
  readonly onDidWrite = this.writeEmitter.event;
  readonly onDidClose = this.closeEmitter.event;
  open(): void {
    this.writeEmitter.fire(
      "\x1b[2m[reno terminal — agent commands stream here]\x1b[0m\r\n",
    );
  }
  close(): void {
    hostState.terminal = undefined;
    hostState.pty = undefined;
  }
  write(s: string): void {
    this.writeEmitter.fire(s.replace(/\n/g, "\r\n"));
  }
}

function getOrCreateTerminal(): { pty: BashPty; terminal: vscode.Terminal } {
  if (hostState.pty && hostState.terminal) {
    return { pty: hostState.pty, terminal: hostState.terminal };
  }
  const pty = new BashPty();
  const terminal = vscode.window.createTerminal({
    name: "reno",
    pty,
    iconPath: new vscode.ThemeIcon("comment-discussion"),
  });
  hostState.pty = pty;
  hostState.terminal = terminal;
  return { pty, terminal };
}

function shellArgsFor(command: string): [string, string[]] {
  return IS_WINDOWS
    ? ["cmd.exe", ["/c", command]]
    : [process.env.SHELL ?? "/bin/sh", ["-c", command]];
}

/**
 * Bash tool with two execution modes:
 *
 *   • Foreground (default): blocks until exit or idle timeout. Uses an
 *     idle-based timeout — kills only if no output for `timeout` ms (default 5m).
 *     A long-running but actively-printing command (npm install, cargo build)
 *     is fine; a silently-stuck one is killed cleanly.
 *
 *   • Background (run_in_background=true): spawns and returns within ~2s with a
 *     bash_id. Output continues streaming into the reno terminal and a ring
 *     buffer in BackgroundShellRegistry. Use BashOutput / KillBash to interact.
 */
export function buildTerminalBashTool(): Tool {
  return buildTool({
    name: "Bash",
    description:
      "Execute a shell command. By default runs in the foreground and tolerates long durations as long as output keeps flowing (idle timeout: 5 minutes of silence). Set run_in_background=true for dev servers, watchers, or daemons that should keep running after the call returns. Avoid for file read/edit — use Read/Edit/Write instead.",
    inputSchema: schema,
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => false,
    getActivityDescription: (input) => {
      const first = input.command.trim().split(/\s+/)[0] ?? "shell";
      const tag = input.run_in_background ? " (bg)" : "";
      return `Running ${first}${tag}`;
    },
    async call(input, ctx, onProgress) {
      const workdir = input.cwd ?? ctx.cwd;
      const { pty, terminal } = getOrCreateTerminal();
      terminal.show(true);

      const [shell, args] = shellArgsFor(input.command);
      pty.write(`\x1b[36m$ ${input.command}\x1b[0m\n`);

      const child = spawn(shell, args, {
        cwd: workdir,
        env: { ...process.env, CI: "1", DEBIAN_FRONTEND: "noninteractive" },
        stdio: ["ignore", "pipe", "pipe"],
        // detached: false on purpose — we still want the parent's job control,
        // but the registry holds the reference so it survives the tool turn.
      });

      if (input.run_in_background) {
        return await runBackground({
          input,
          child,
          pty,
          ctx,
        });
      }

      return await runForeground({
        input,
        child,
        pty,
        onProgress,
        ctx,
      });
    },
  });
}

type ProgressFn = (p: { type: "status" | "output"; message: string }) => void;

async function runForeground(args: {
  input: z.infer<typeof schema>;
  child: ChildProcess;
  pty: BashPty;
  onProgress: ProgressFn | undefined;
  ctx: { abortController: AbortController };
}): Promise<string> {
  const { input, child, pty, onProgress, ctx } = args;
  const idleTimeoutMs = clampIdle(input.timeout ?? DEFAULT_IDLE_TIMEOUT_MS);

  return await new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let killed = false;
    let killReason: "idle" | "abort" | "absolute" | undefined;
    let lastFlush = 0;

    const absoluteTimer = setTimeout(() => {
      killed = true;
      killReason = "absolute";
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      if (!IS_WINDOWS) setTimeout(() => safeKill(child, "SIGKILL"), 2_000);
    }, ABSOLUTE_MAX_MS);

    let idleTimer: NodeJS.Timeout | undefined;
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        killed = true;
        killReason = "idle";
        try {
          child.kill();
        } catch {
          /* ignore */
        }
        if (!IS_WINDOWS) setTimeout(() => safeKill(child, "SIGKILL"), 2_000);
      }, idleTimeoutMs);
    };
    resetIdleTimer();

    const onAbort = () => {
      killed = true;
      killReason = "abort";
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      if (!IS_WINDOWS) {
        setTimeout(() => safeKill(child, "SIGKILL"), 1_000);
      }
    };
    ctx.abortController.signal.addEventListener("abort", onAbort, { once: true });

    const flushProgress = (force = false) => {
      if (!onProgress) return;
      const now = Date.now();
      if (!force && now - lastFlush < 200) return;
      lastFlush = now;
      const tail = (stdout + (stderr ? `\n${stderr}` : ""))
        .split("\n")
        .slice(-5)
        .join("\n");
      onProgress({ type: "output", message: tail });
    };

    child.stdout?.on("data", (d) => {
      const text = d.toString();
      stdout += text;
      pty.write(text);
      resetIdleTimer();
      flushProgress();
    });
    child.stderr?.on("data", (d) => {
      const text = d.toString();
      stderr += text;
      pty.write(text);
      resetIdleTimer();
      flushProgress();
    });
    child.on("close", (code) => {
      clearTimeout(absoluteTimer);
      if (idleTimer) clearTimeout(idleTimer);
      ctx.abortController.signal.removeEventListener("abort", onAbort);
      const combined = stdout + (stderr ? `\n[stderr]\n${stderr}` : "");
      const body = truncate(combined);
      pty.write(`\n\x1b[2m[exit ${code}]\x1b[0m\n`);
      if (killed) {
        if (killReason === "abort") return reject(new Error("Command aborted"));
        if (killReason === "idle") {
          return reject(
            new Error(
              `Command killed — no output for ${Math.round(idleTimeoutMs / 1000)}s (assumed stuck).\n${body}`,
            ),
          );
        }
        if (killReason === "absolute") {
          return reject(
            new Error(
              `Command killed — exceeded absolute ${Math.round(ABSOLUTE_MAX_MS / 60_000)}min wall-clock limit.\n${body}`,
            ),
          );
        }
      }
      resolve(`exit_code=${code}\n${body}`);
    });
    child.on("error", (e) => {
      clearTimeout(absoluteTimer);
      if (idleTimer) clearTimeout(idleTimer);
      ctx.abortController.signal.removeEventListener("abort", onAbort);
      reject(e);
    });
  });
}

async function runBackground(args: {
  input: z.infer<typeof schema>;
  child: ChildProcess;
  pty: BashPty;
  ctx: { abortController: AbortController };
}): Promise<string> {
  const { input, child, pty } = args;

  // Capture early output before registering, so we can include it in the return.
  const earlyLines: string[] = [];
  let earlyDone = false;
  const earlyHandler = (d: Buffer) => {
    if (earlyDone) return;
    const text = d.toString();
    pty.write(text);
    for (const ln of text.replace(/\r/g, "").split("\n")) {
      earlyLines.push(ln);
      if (earlyLines.length >= BG_FIRST_OUTPUT_LINES) earlyDone = true;
    }
  };
  child.stdout?.on("data", earlyHandler);
  child.stderr?.on("data", earlyHandler);

  // Wait until either: enough output captured OR the wait window elapsed.
  await new Promise<void>((resolve) => {
    const t = setTimeout(() => resolve(), BG_FIRST_OUTPUT_WAIT_MS);
    const check = () => {
      if (earlyDone) {
        clearTimeout(t);
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });

  // Detach the early handler; the registry will install its own listeners.
  child.stdout?.off("data", earlyHandler);
  child.stderr?.off("data", earlyHandler);

  const snap = backgroundShells.register(child, input.command);
  // Re-pipe captured early output into the buffer so BashOutput sees it.
  backgroundShells.seedBuffer(snap.id, earlyLines.filter((l) => l.length > 0));
  // And keep mirroring future output to the reno terminal.
  child.stdout?.on("data", (d) => pty.write(d.toString()));
  child.stderr?.on("data", (d) => pty.write(d.toString()));
  child.on("close", (code) => {
    pty.write(`\n\x1b[2m[${snap.id} exited with code ${code}]\x1b[0m\n`);
  });

  const preview = earlyLines
    .filter((l) => l.length > 0)
    .slice(0, BG_FIRST_OUTPUT_LINES)
    .join("\n");
  return [
    `Started in background: bash_id=${snap.id} pid=${snap.pid ?? "?"}`,
    preview ? "First output:\n" + preview : "(no output yet)",
    `Use BashOutput({"bash_id":"${snap.id}"}) to fetch new output, or KillBash to stop.`,
  ].join("\n");
}

function safeKill(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    child.kill(signal);
  } catch {
    /* ignore */
  }
}

function clampIdle(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_IDLE_TIMEOUT_MS;
  return Math.min(Math.max(v, 5_000), MAX_IDLE_TIMEOUT_MS);
}

export function disposeBashTerminal(): void {
  hostState.terminal?.dispose();
  hostState.terminal = undefined;
  hostState.pty = undefined;
  backgroundShells.killAll();
}
