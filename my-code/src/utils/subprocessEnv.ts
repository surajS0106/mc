/**
 * Subprocess environment — mirrors beta's utils/subprocessEnv.ts.
 * Returns a clean copy of process.env to pass to spawned children.
 */

export function subprocessEnv(): NodeJS.ProcessEnv {
  return { ...process.env }
}
