/**
 * Slow operations — mirrors beta's utils/slowOperations.ts stubs we need.
 * Only the functions used by LSP infrastructure are included.
 */

export function jsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function jsonParse(text: string): unknown {
  return JSON.parse(text)
}
