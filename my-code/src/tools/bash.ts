import { z } from "zod";
import { buildTool } from "./Tool.js";
import { exec } from "../utils/Shell.js";
import type { ExecResult } from "../utils/ShellCommand.js";
import { TaskOutput } from "../utils/task/TaskOutput.js";
import { getTaskOutputPath } from "../utils/task/diskOutput.js";
import {
  spawnShellTask,
} from "../tasks/LocalShellTask/LocalShellTask.js";
import {
  registerForeground,
  backgroundExistingForegroundTask,
  unregisterForeground,
  markTaskNotified,
} from "../tasks/LocalShellTask/LocalShellTask.helpers.js";
import type { AppState } from "../state/AppState.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const PROGRESS_THRESHOLD_MS = 2000;         // Show progress after 2 seconds
const ASSISTANT_BLOCKING_BUDGET_MS = 15_000; // Auto-background after 15s in main agent
const DEFAULT_TIMEOUT_MS = 120_000;         // 2 minutes default
const MAX_TIMEOUT_MS = 600_000;             // 10 minutes max
const MAX_OUTPUT_BYTES = 30_000;            // 30KB inline output cap

// Commands that should NOT be auto-backgrounded (sleep stays foreground)
const DISALLOWED_AUTO_BACKGROUND = new Set(["sleep"]);

// Check env flag once at module load
const isBackgroundTasksDisabled = !!process.env.IG_DISABLE_BACKGROUND_TASKS;

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  command: z.string().describe("The shell command to execute"),
  timeout: z
    .number()
    .optional()
    .describe(`Optional timeout in milliseconds (max ${MAX_TIMEOUT_MS})`),
  description: z
    .string()
    .optional()
    .describe(
      `Clear, concise description of what this command does in active voice. Never use words like "complex" or "risk" — just describe what it does.

For simple commands, keep it brief (5-10 words):
- ls → "List files in current directory"
- git status → "Show working tree status"
- npm install → "Install package dependencies"

For harder-to-parse commands (pipes, obscure flags), add enough context:
- find . -name "*.tmp" -exec rm {} \\; → "Find and delete all .tmp files recursively"
- git reset --hard origin/main → "Discard all local changes and match remote main"`
    ),
  run_in_background: isBackgroundTasksDisabled
    ? z.undefined()
    : z
        .boolean()
        .optional()
        .describe(
          "Set to true to run this command in the background. The CLI will stay responsive and notify you when it completes."
        ),
});

type BashInput = z.infer<typeof schema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAutoBackgroundingAllowed(command: string): boolean {
  const base = command.trim().split(/\s+/)[0] ?? "";
  return !DISALLOWED_AUTO_BACKGROUND.has(base);
}

function truncateOutput(s: string): string {
  if (s.length <= MAX_OUTPUT_BYTES) return s;
  const head = s.slice(0, 5_000);
  const tail = s.slice(-MAX_OUTPUT_BYTES + 5_000);
  return `${head}\n...[truncated ${s.length - MAX_OUTPUT_BYTES} bytes]...\n${tail}`;
}

// ─── runShellCommand — the heart of the tool ─────────────────────────────────

/**
 * Async generator that drives shell command execution.
 * Yields progress updates until the command completes or is backgrounded.
 * Returns the final ExecResult.
 *
 * Mirrors the beta's runShellCommand() 1:1.
 */
async function* runShellCommand({
  input,
  abortController,
  setAppState,
  toolUseId,
}: {
  input: BashInput;
  abortController: AbortController;
  setAppState: (f: (prev: AppState) => AppState) => void;
  toolUseId?: string;
}): AsyncGenerator<
  {
    type: "progress";
    output: string;
    fullOutput: string;
    elapsedTimeSeconds: number;
    totalLines: number;
    totalBytes: number;
    taskId?: string;
    timeoutMs?: number;
  },
  ExecResult,
  void
> {
  const { command, description, timeout, run_in_background } = input;
  const timeoutMs = (() => {
    if (!timeout) return DEFAULT_TIMEOUT_MS;
    // LLMs sometimes pass seconds instead of ms (e.g. "120" meaning 2min)
    return Math.min(timeout <= 600 ? timeout * 1000 : timeout, MAX_TIMEOUT_MS);
  })();

  let fullOutput = "";
  let lastProgressOutput = "";
  let lastTotalLines = 0;
  let lastTotalBytes = 0;
  let backgroundShellId: string | undefined;
  let assistantAutoBackgrounded = false;

  // Progress signal: resolves when onProgress fires, waking the generator
  let resolveProgress: (() => void) | null = null;
  function createProgressSignal(): Promise<null> {
    return new Promise<null>(resolve => {
      resolveProgress = () => resolve(null);
    });
  }

  const shouldAutoBackground =
    !isBackgroundTasksDisabled && isAutoBackgroundingAllowed(command);

  const shellCommand = await exec(command, abortController.signal, {
    timeout: timeoutMs,
    onProgress(lastLines, allLines, totalLines, totalBytes, isIncomplete) {
      lastProgressOutput = lastLines;
      fullOutput = allLines;
      lastTotalLines = totalLines;
      lastTotalBytes = isIncomplete ? totalBytes : 0;
      const resolve = resolveProgress;
      if (resolve) {
        resolveProgress = null;
        resolve();
      }
    },
    shouldAutoBackground,
    taskId: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  });

  const resultPromise = shellCommand.result;

  // Spawn a new background task and return its ID
  async function spawnBackgroundTask(): Promise<string> {
    const handle = await spawnShellTask(
      {
        command,
        description: description || command,
        shellCommand,
        toolUseId,
      },
      { setAppState }
    );
    return handle.taskId;
  }

  // Start backgrounding — either in-place (if foreground registered) or fresh spawn
  let foregroundTaskId: string | undefined;
  function startBackgrounding(backgroundFn?: (shellId: string) => void): void {
    if (foregroundTaskId) {
      if (
        !backgroundExistingForegroundTask(
          foregroundTaskId,
          shellCommand,
          description || command,
          setAppState,
          toolUseId
        )
      ) {
        return;
      }
      backgroundShellId = foregroundTaskId;
      backgroundFn?.(foregroundTaskId);
      return;
    }

    // No foreground task yet — spawn a new background task
    void spawnBackgroundTask().then(shellId => {
      backgroundShellId = shellId;
      // Wake the generator's Promise.race so it sees backgroundShellId
      const resolve = resolveProgress;
      if (resolve) {
        resolveProgress = null;
        resolve();
      }
      backgroundFn?.(shellId);
    });
  }

  // Wire auto-background on timeout (if the shell command supports it)
  if (shellCommand.onTimeout && shouldAutoBackground) {
    shellCommand.onTimeout(backgroundFn => {
      startBackgrounding(backgroundFn);
    });
  }

  // ASSISTANT_BLOCKING_BUDGET: auto-background after 15s to keep agent responsive
  if (!isBackgroundTasksDisabled && run_in_background !== true) {
    setTimeout(() => {
      if (shellCommand.status === "running" && backgroundShellId === undefined) {
        assistantAutoBackgrounded = true;
        startBackgrounding();
      }
    }, ASSISTANT_BLOCKING_BUDGET_MS).unref();
  }

  // If caller explicitly requested background, spawn immediately and return
  if (run_in_background === true && !isBackgroundTasksDisabled) {
    const shellId = await spawnBackgroundTask();
    return {
      stdout: "",
      stderr: "",
      code: 0,
      interrupted: false,
      backgroundTaskId: shellId,
    };
  }

  // ── Initial wait: up to PROGRESS_THRESHOLD_MS before showing progress ──
  const startTime = Date.now();

  {
    const initialResult = await Promise.race([
      resultPromise,
      new Promise<null>(resolve => {
        const t = setTimeout(
          (r: (v: null) => void) => r(null),
          PROGRESS_THRESHOLD_MS,
          resolve
        );
        t.unref();
      }),
    ]);

    if (initialResult !== null) {
      // Fast command — completed before threshold
      shellCommand.cleanup();
      return initialResult;
    }

    if (backgroundShellId) {
      return {
        stdout: "",
        stderr: "",
        code: 0,
        interrupted: false,
        backgroundTaskId: backgroundShellId,
        assistantAutoBackgrounded,
      };
    }
  }

  // Start output polling for live progress
  TaskOutput.startPolling(shellCommand.taskOutput.taskId);

  try {
    while (true) {
      const progressSignal = createProgressSignal();
      const result = await Promise.race([resultPromise, progressSignal]);

      if (result !== null) {
        // Race condition: backgrounding fired but process completed first.
        // ShellCommand sets backgroundTaskId but skips outputFilePath.
        // Strip backgroundTaskId so the model sees a clean completed command,
        // reconstruct outputFilePath for large outputs, and suppress the
        // redundant <task_notification> from the .then() handler.
        if (result.backgroundTaskId !== undefined) {
          markTaskNotified(result.backgroundTaskId, setAppState);
          const fixedResult: ExecResult = {
            ...result,
            backgroundTaskId: undefined,
          };
          const { taskOutput } = shellCommand;
          if (taskOutput.stdoutToFile && !taskOutput.outputFileRedundant) {
            fixedResult.outputFilePath = taskOutput.path;
            fixedResult.outputFileSize = taskOutput.outputFileSize;
            fixedResult.outputTaskId = taskOutput.taskId;
          }
          shellCommand.cleanup();
          return fixedResult;
        }

        // Normal completion
        if (foregroundTaskId) {
          unregisterForeground(foregroundTaskId, setAppState);
        }
        shellCommand.cleanup();
        return result;
      }

      // Null means progress signal fired — check state

      if (backgroundShellId) {
        return {
          stdout: "",
          stderr: "",
          code: 0,
          interrupted: false,
          backgroundTaskId: backgroundShellId,
          assistantAutoBackgrounded,
        };
      }

      // Check if this foreground task was backgrounded via Ctrl+B
      if (foregroundTaskId && shellCommand.status === "backgrounded") {
        return {
          stdout: "",
          stderr: "",
          code: 0,
          interrupted: false,
          backgroundTaskId: foregroundTaskId,
          backgroundedByUser: true,
        };
      }

      // Time for a progress update
      const elapsed = Date.now() - startTime;
      const elapsedSeconds = Math.floor(elapsed / 1000);

      // Register as foreground task after threshold (enables Ctrl+B)
      if (
        !isBackgroundTasksDisabled &&
        backgroundShellId === undefined &&
        elapsedSeconds >= PROGRESS_THRESHOLD_MS / 1000 &&
        !foregroundTaskId
      ) {
        foregroundTaskId = registerForeground(
          {
            command,
            description: description || command,
            shellCommand,
          },
          setAppState,
          toolUseId
        );
      }

      yield {
        type: "progress",
        fullOutput,
        output: lastProgressOutput,
        elapsedTimeSeconds: elapsedSeconds,
        totalLines: lastTotalLines,
        totalBytes: lastTotalBytes,
        taskId: shellCommand.taskOutput.taskId,
        ...(timeout ? { timeoutMs } : undefined),
      };
    }
  } finally {
    TaskOutput.stopPolling(shellCommand.taskOutput.taskId);
  }
}

// ─── The tool ────────────────────────────────────────────────────────────────

export const bashTool = buildTool({
  name: "Bash",
  description:
    "Execute a shell command. Returns combined stdout/stderr. " +
    "Default timeout 2 minutes (max 10). " +
    "For long-running processes (dev servers, watchers, builds), set " +
    "run_in_background=true — the command runs detached and you'll be notified on completion. " +
    "Avoid using for file read/edit — use Read/Edit/Write instead.",
  inputSchema: schema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,
  getActivityDescription: (input: BashInput) => {
    const desc = input.description ?? input.command.trim().split(/\s+/)[0] ?? "shell";
    return `Running ${desc}`;
  },
  renderToolUse: (input: BashInput) =>
    input.description
      ? `Bash: ${input.description}`
      : `Bash: ${input.command.split("\n")[0]}`,

  async call(input: BashInput, ctx, onProgress) {
    const { abortController, setAppState, toolUseId } = ctx;
    let result: ExecResult;

    // Consume the async generator, forwarding progress to the caller
    const generator = runShellCommand({
      input,
      abortController,
      setAppState,
      toolUseId,
    });

    let progressCounter = 0;
    let generatorResult: IteratorResult<Awaited<ReturnType<typeof generator.next>>["value"], ExecResult>;

    do {
      generatorResult = await generator.next() as any;
      if (!generatorResult.done && onProgress) {
        const p = generatorResult.value as any;
        onProgress({
          type: "output",
          message: p.output
            ? `[${p.elapsedTimeSeconds}s] ${p.output}`
            : `[${p.elapsedTimeSeconds}s] Running…`,
        });
        progressCounter++;
      }
    } while (!generatorResult.done);

    result = (generatorResult as any).value as ExecResult;

    // Build the return string
    const outputPath = result.backgroundTaskId
      ? getTaskOutputPath(result.backgroundTaskId)
      : undefined;

    if (result.backgroundTaskId) {
      const label = result.assistantAutoBackgrounded
        ? `Command exceeded ${ASSISTANT_BLOCKING_BUDGET_MS / 1000}s budget and was moved to the background`
        : result.backgroundedByUser
        ? "Command was backgrounded by user"
        : "Command running in background";

      return (
        `${label} (Task ID: ${result.backgroundTaskId}).\n` +
        `Output is being written to: ${outputPath}\n` +
        `You will be notified when it completes.`
      );
    }

    const stdout = truncateOutput((result.stdout || "").trimEnd());
    const stderr = (result.stderr || "").trim();
    const parts: string[] = [];

    if (stdout) parts.push(stdout);
    if (stderr) parts.push(`[stderr]\n${stderr}`);
    if (result.interrupted) parts.push("<error>Command was aborted before completion</error>");
    if (result.code !== 0 && !result.interrupted) parts.push(`Exit code ${result.code}`);

    if (result.outputFilePath) {
      // Large output — point to the file
      parts.push(
        `\n[Output too large for inline display. Full output at: ${result.outputFilePath}]`
      );
    }

    return parts.join("\n") || "(no output)";
  },
});
