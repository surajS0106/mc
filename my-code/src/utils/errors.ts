/**
 * Error utilities — mirrors beta's utils/errors.ts.
 */

/** Extract a human-readable message from an unknown thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** Coerce any thrown value to an Error instance. */
export function toError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(String(error))
}

/** Check if an error is ENOENT (file not found). */
export function isENOENT(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}

/** Check if a filesystem error means the path is inaccessible (ENOENT, EACCES, EPERM). */
export function isFsInaccessible(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code
  return code === 'ENOENT' || code === 'EACCES' || code === 'EPERM'
}

/** Get the file path from an errno error if available. */
export function getErrnoPath(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException)?.path
}
