/**
 * Logging — mirrors beta's utils/log.ts.
 */

export function logError(error: Error): void {
  process.stderr.write(`[ERROR] ${error.message}\n`)
  if (process.env.IG_DEBUG_LSP && error.stack) {
    process.stderr.write(error.stack + '\n')
  }
}
