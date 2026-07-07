/**
 * Current working directory — mirrors beta's utils/cwd.ts.
 */

let _cwd = process.cwd()

export function getCwd(): string {
  return _cwd
}

export function setCwd(dir: string): void {
  _cwd = dir
  process.chdir(dir)
}
