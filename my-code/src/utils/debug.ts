/**
 * Debug logging — mirrors beta's utils/debug.ts.
 * Set IG_DEBUG_LSP=1 to enable verbose LSP protocol logging.
 */

const DEBUG = !!process.env.IG_DEBUG_LSP

export function logForDebugging(
  message: string,
  opts?: { level?: 'info' | 'warn' | 'error' },
): void {
  if (DEBUG) {
    const prefix = opts?.level === 'error' ? '[ERROR]' : opts?.level === 'warn' ? '[WARN]' : '[DEBUG]'
    process.stderr.write(`${prefix} ${message}\n`)
  }
}
