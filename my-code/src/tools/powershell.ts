/**
 * PowerShellTool — Windows PowerShell equivalent of BashTool.
 *
 * Uses the same background task infrastructure as bash.ts:
 * - runShellCommand async generator (auto-background at 15s)
 * - run_in_background schema field
 * - Ctrl+B support via registerForeground / backgroundExistingForegroundTask
 * - Stall watchdog via spawnShellTask
 * - Progress polling via TaskOutput
 *
 * On Windows, prefers pwsh.exe (PowerShell 7+), falls back to powershell.exe (v5).
 */

import { z } from "zod";
import { buildTool } from "./Tool.js";
import { exec } from "../utils/Shell.js";
import type { ExecResult } from "../utils/ShellCommand.js";
import { TaskOutput } from "../utils/task/TaskOutput.js";
import { getTaskOutputPath } from "../utils/task/diskOutput.js";
import { spawnShellTask } from "../tasks/LocalShellTask/LocalShellTask.js";
import {
  registerForeground,
  backgroundExistingForegroundTask,
  unregisterForeground,
  markTaskNotified,
} from "../tasks/LocalShellTask/LocalShellTask.helpers.js";
import type { AppState } from "../state/AppState.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROGRESS_THRESHOLD_MS = 2_000;
const ASSISTANT_BLOCKING_BUDGET_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;
const MAX_OUTPUT_BYTES = 30_000;

const isBackgroundTasksDisabled = !!process.env.IG_DISABLE_BACKGROUND_TASKS;

// ─── Detect PowerShell executable ────────────────────────────────────────────

/** Prefer pwsh (PowerShell 7+), fall back to powershell (v5) */
function getPowerShellExe(): string {
  // On Windows, prefer pwsh; on other platforms, pwsh is the only option
  return process.platform === "win32" ? "pwsh" : "pwsh";
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  command: z.string().describe("The PowerShell command or script to execute"),
  timeout: z
    .number()
    .optional()
    .describe(`Optional timeout in milliseconds (max ${MAX_TIMEOUT_MS})`),
  description: z
    .string()
    .optional()
    .describe(
      "Clear description of what this command does (active voice, 5-15 words)"
    ),
  run_in_background: isBackgroundTasksDisabled
    ? z.undefined()
    : z
        .boolean()
        .optional()
        .describe(
          "Set to true to run this command in the background. The CLI stays responsive and notifies you on completion."
        ),
});

type PowerShellInput = z.infer<typeof schema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncateOutput(s: string): string {
  if (s.length <= MAX_OUTPUT_BYTES) return s;
  const head = s.slice(0, 5_000);
  const tail = s.slice(-MAX_OUTPUT_BYTES + 5_000);
  return `${head}\n...[truncated ${s.length - MAX_OUTPUT_BYTES} bytes]...\n${tail}`;
}

// ─── runPowerShellCommand async generator ────────────────────────────────────

async function* runPowerShellCommand({
  input,
  abortController,
  setAppState,
  toolUseId,
}: {
  input: PowerShellInput;
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
    return Math.min(timeout <= 600 ? timeout * 1000 : timeout, MAX_TIMEOUT_MS);
  })();

  // Wrap command to use PowerShell
  const psExe = getPowerShellExe();
  const wrappedCommand = `${psExe} -NoProfile -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`;

  let fullOutput = "";
  let lastProgressOutput = "";
  let lastTotalLines = 0;
  let lastTotalBytes = 0;
  let backgroundShellId: string | undefined;
  let assistantAutoBackgrounded = false;

  let resolveProgress: (() => void) | null = null;
  function createProgressSignal(): Promise<null> {
    return new Promise<null>(resolve => {
      resolveProgress = () => resolve(null);
    });
  }

  const shellCommand = await exec(wrappedCommand, abortController.signal, {
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
    shouldAutoBackground: true,
    taskId: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  });

  const resultPromise = shellCommand.result;

  async function spawnBackgroundTask(): Promise<string> {
    const handle = await spawnShellTask(
      { command: wrappedCommand, description: description || command, shellCommand, toolUseId },
      { setAppState }
    );
    return handle.taskId;
  }

  let foregroundTaskId: string | undefined;

  function startBackgrounding(backgroundFn?: (shellId: string) => void): void {
    if (foregroundTaskId) {
      if (!backgroundExistingForegroundTask(foregroundTaskId, shellCommand, description || command, setAppState, toolUseId)) return;
      backgroundShellId = foregroundTaskId;
      backgroundFn?.(foregroundTaskId);
      return;
    }
    void spawnBackgroundTask().then(shellId => {
      backgroundShellId = shellId;
      const resolve = resolveProgress;
      if (resolve) { resolveProgress = null; resolve(); }
      backgroundFn?.(shellId);
    });
  }

  if (shellCommand.onTimeout) {
    shellCommand.onTimeout(backgroundFn => startBackgrounding(backgroundFn));
  }

  if (!isBackgroundTasksDisabled && run_in_background !== true) {
    setTimeout(() => {
      if (shellCommand.status === "running" && backgroundShellId === undefined) {
        assistantAutoBackgrounded = true;
        startBackgrounding();
      }
    }, ASSISTANT_BLOCKING_BUDGET_MS).unref();
  }

  if (run_in_background === true && !isBackgroundTasksDisabled) {
    const shellId = await spawnBackgroundTask();
    return { stdout: "", stderr: "", code: 0, interrupted: false, backgroundTaskId: shellId };
  }

  const startTime = Date.now();

  {
    const initialResult = await Promise.race([
      resultPromise,
      new Promise<null>(resolve => {
        const t = setTimeout((r: (v: null) => void) => r(null), PROGRESS_THRESHOLD_MS, resolve);
        t.unref();
      }),
    ]);

    if (initialResult !== null) {
      shellCommand.cleanup();
      return initialResult;
    }

    if (backgroundShellId) {
      return { stdout: "", stderr: "", code: 0, interrupted: false, backgroundTaskId: backgroundShellId, assistantAutoBackgrounded };
    }
  }

  TaskOutput.startPolling(shellCommand.taskOutput.taskId);

  try {
    while (true) {
      const progressSignal = createProgressSignal();
      const result = await Promise.race([resultPromise, progressSignal]);

      if (result !== null) {
        if (result.backgroundTaskId !== undefined) {
          markTaskNotified(result.backgroundTaskId, setAppState);
          const fixedResult: ExecResult = { ...result, backgroundTaskId: undefined };
          const { taskOutput } = shellCommand;
          if (taskOutput.stdoutToFile && !taskOutput.outputFileRedundant) {
            fixedResult.outputFilePath = taskOutput.path;
            fixedResult.outputFileSize = taskOutput.outputFileSize;
            fixedResult.outputTaskId = taskOutput.taskId;
          }
          shellCommand.cleanup();
          return fixedResult;
        }
        if (foregroundTaskId) unregisterForeground(foregroundTaskId, setAppState);
        shellCommand.cleanup();
        return result;
      }

      if (backgroundShellId) {
        return { stdout: "", stderr: "", code: 0, interrupted: false, backgroundTaskId: backgroundShellId, assistantAutoBackgrounded };
      }

      if (foregroundTaskId && shellCommand.status === "backgrounded") {
        return { stdout: "", stderr: "", code: 0, interrupted: false, backgroundTaskId: foregroundTaskId, backgroundedByUser: true };
      }

      const elapsed = Date.now() - startTime;
      const elapsedSeconds = Math.floor(elapsed / 1000);

      if (!isBackgroundTasksDisabled && backgroundShellId === undefined && elapsedSeconds >= PROGRESS_THRESHOLD_MS / 1000 && !foregroundTaskId) {
        foregroundTaskId = registerForeground(
          { command: wrappedCommand, description: description || command, shellCommand },
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

// ─── The tool ─────────────────────────────────────────────────────────────────

export const powerShellTool = buildTool({
  name: "PowerShell",
  description:
    "Execute a PowerShell command on Windows. Returns combined stdout/stderr. " +
    "Default timeout 2 minutes (max 10). " +
    "Use run_in_background=true for long-running processes (dev servers, watchers, installs). " +
    "Prefer this over Bash for Windows-specific operations (registry, COM, .NET, WMI, Windows services).",
  inputSchema: schema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,
  isEnabled: () => process.platform === "win32",
  getActivityDescription: (input: PowerShellInput) => {
    const desc = input.description ?? input.command.trim().split(/\s+/)[0] ?? "powershell";
    return `Running ${desc}`;
  },
  renderToolUse: (input: PowerShellInput) =>
    input.description
      ? `PowerShell: ${input.description}`
      : `PowerShell: ${input.command.split("\n")[0]}`,

  async call(input: PowerShellInput, ctx, onProgress) {
    const { abortController, setAppState, toolUseId } = ctx;
    const generator = runPowerShellCommand({ input, abortController, setAppState, toolUseId });

    let generatorResult: IteratorResult<Awaited<ReturnType<typeof generator.next>>["value"], ExecResult>;
    do {
      generatorResult = await generator.next() as any;
      if (!generatorResult.done && onProgress) {
        const p = generatorResult.value as any;
        onProgress({
          type: "output",
          message: p.output ? `[${p.elapsedTimeSeconds}s] ${p.output}` : `[${p.elapsedTimeSeconds}s] Running…`,
        });
      }
    } while (!generatorResult.done);

    const result = (generatorResult as any).value as ExecResult;
    const outputPath = result.backgroundTaskId ? getTaskOutputPath(result.backgroundTaskId) : undefined;

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
    if (result.outputFilePath) parts.push(`\n[Output too large for inline display. Full output at: ${result.outputFilePath}]`);

    return parts.join("\n") || "(no output)";
  },
});
