/**
 * Environment utilities.
 */

export function isBareMode(): boolean {
  // Simplification for the new CLI.
  return process.argv.includes('--bare') || process.argv.includes('-p')
}
