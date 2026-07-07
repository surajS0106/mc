export function formatTaskOutput(
  stdout: string,
  stderr: string,
  maxOutputLength: number,
): string {
  let combined = ''
  
  if (stdout && stderr) {
    combined = `${stdout}\n\n[stderr]\n${stderr}`
  } else if (stdout) {
    combined = stdout
  } else if (stderr) {
    combined = stderr
  }
  
  if (combined.length > maxOutputLength) {
    const halfLength = Math.floor(maxOutputLength / 2)
    return (
      combined.slice(0, halfLength) +
      '\n...[output truncated]...\n' +
      combined.slice(-halfLength)
    )
  }
  
  return combined
}

export function getMaxTaskOutputLength(): number {
  return 30000 // Match beta's roughly ~30k chars
}
