import { spawn } from 'child_process'
import { constants as fsConstants } from 'fs'
import { type FileHandle, mkdir, open } from 'fs/promises'
import {
  createAbortedCommand,
  type ShellCommand,
  wrapSpawn,
} from './ShellCommand.js'
import { getTaskOutputDir } from './task/diskOutput.js'
import { TaskOutput } from './task/TaskOutput.js'

export type { ExecResult } from './ShellCommand.js'

const DEFAULT_TIMEOUT = 30 * 60 * 1000 // 30 minutes

export type ExecOptions = {
  timeout?: number
  onProgress?: (
    lastLines: string,
    allLines: string,
    totalLines: number,
    totalBytes: number,
    isIncomplete: boolean,
  ) => void
  shouldAutoBackground?: boolean
  onStdout?: (data: string) => void
  cwd?: string
  taskId: string
}

export async function exec(
  command: string,
  abortSignal: AbortSignal,
  options: ExecOptions,
): Promise<ShellCommand> {
  const {
    timeout,
    onProgress,
    shouldAutoBackground,
    onStdout,
    cwd,
    taskId,
  } = options
  const commandTimeout = timeout || DEFAULT_TIMEOUT

  if (abortSignal.aborted) {
    return createAbortedCommand(taskId)
  }

  const isWindows = process.platform === 'win32'
  const spawnBinary = isWindows ? 'cmd.exe' : (process.env.SHELL ?? '/bin/sh')
  const shellArgs = isWindows ? ['/c', command] : ['-c', command]

  const usePipeMode = !!onStdout
  const taskOutput = new TaskOutput(taskId, onProgress ?? null, !usePipeMode)
  await mkdir(getTaskOutputDir(), { recursive: true })

  let outputHandle: FileHandle | undefined
  if (!usePipeMode) {
    const O_NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0
    outputHandle = await open(
      taskOutput.path,
      isWindows
        ? 'w'
        : fsConstants.O_WRONLY |
            fsConstants.O_CREAT |
            fsConstants.O_APPEND |
            O_NOFOLLOW,
    )
  }

  try {
    const childProcess = spawn(spawnBinary, shellArgs, {
      env: process.env,
      cwd: cwd ?? process.cwd(),
      stdio: usePipeMode
        ? ['pipe', 'pipe', 'pipe']
        : ['pipe', outputHandle?.fd, outputHandle?.fd],
      detached: !isWindows, // Allow process group killing on Unix
      windowsHide: true,
    })

    const shellCommand = wrapSpawn(
      childProcess,
      abortSignal,
      commandTimeout,
      taskOutput,
      shouldAutoBackground,
    )

    if (outputHandle !== undefined) {
      try {
        await outputHandle.close()
      } catch {
        // fd may already be closed
      }
    }

    if (childProcess.stdout && onStdout) {
      childProcess.stdout.on('data', (chunk: string | Buffer) => {
        onStdout(typeof chunk === 'string' ? chunk : chunk.toString())
      })
    }

    return shellCommand
  } catch (error) {
    if (outputHandle !== undefined) {
      try { await outputHandle.close() } catch {}
    }
    taskOutput.clear()
    
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Shell exec error: ${msg}`)

    return createAbortedCommand(taskId, undefined, {
      code: 126,
      stderr: msg,
    })
  }
}
