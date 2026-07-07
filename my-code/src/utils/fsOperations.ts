/**
 * File system helpers for task output reading.
 * Ported from beta's utils/fsOperations.ts — only the subset needed
 * by TaskOutput and the stall watchdog.
 */

import { type FileHandle, open, stat } from 'fs/promises'

/**
 * Read a range of bytes from a file.
 * Returns null if the file is empty or doesn't exist.
 */
export async function readFileRange(
  filePath: string,
  offset: number,
  maxBytes: number,
): Promise<{ content: string; bytesRead: number; bytesTotal: number } | null> {
  let fh: FileHandle | undefined
  try {
    fh = await open(filePath, 'r')
    const fileStat = await fh.stat()
    const bytesTotal = fileStat.size

    if (bytesTotal === 0 || offset >= bytesTotal) {
      return null
    }

    const bytesToRead = Math.min(maxBytes, bytesTotal - offset)
    const buffer = Buffer.alloc(bytesToRead)
    const { bytesRead } = await fh.read(buffer, 0, bytesToRead, offset)

    if (bytesRead === 0) {
      return null
    }

    return {
      content: buffer.slice(0, bytesRead).toString('utf-8'),
      bytesRead,
      bytesTotal,
    }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return null
    }
    throw e
  } finally {
    await fh?.close()
  }
}

/**
 * Read the tail of a file (last N bytes).
 * Used by the output poller for progress display and stall detection.
 */
export async function tailFile(
  filePath: string,
  maxBytes: number,
): Promise<{ content: string; bytesRead: number; bytesTotal: number }> {
  let fh: FileHandle | undefined
  try {
    fh = await open(filePath, 'r')
    const fileStat = await fh.stat()
    const bytesTotal = fileStat.size

    if (bytesTotal === 0) {
      return { content: '', bytesRead: 0, bytesTotal: 0 }
    }

    const offset = Math.max(0, bytesTotal - maxBytes)
    const bytesToRead = Math.min(maxBytes, bytesTotal)
    const buffer = Buffer.alloc(bytesToRead)
    const { bytesRead } = await fh.read(buffer, 0, bytesToRead, offset)

    return {
      content: buffer.slice(0, bytesRead).toString('utf-8'),
      bytesRead,
      bytesTotal,
    }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return { content: '', bytesRead: 0, bytesTotal: 0 }
    }
    throw e
  } finally {
    await fh?.close()
  }
}

/**
 * Join lines safely with a separator, filtering nullish values.
 */
export function safeJoinLines(lines: string[], sep: string): string {
  return lines.filter(Boolean).join(sep)
}
