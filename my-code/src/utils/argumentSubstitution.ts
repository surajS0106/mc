/**
 * Utility for substituting $ARGUMENTS placeholders in skill/command prompts.
 */

export function parseArguments(args: string): string[] {
  if (!args || !args.trim()) {
    return []
  }
  // Simple regex parser for arguments (handles basic quoting)
  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
  const result: string[] = [];
  let match;
  while ((match = regex.exec(args)) !== null) {
    if (match[1] !== undefined) {
      result.push(match[1].replace(/\\"/g, '"'));
    } else if (match[2] !== undefined) {
      result.push(match[2].replace(/\\'/g, "'"));
    } else if (match[3] !== undefined) {
      result.push(match[3]);
    }
  }
  return result;
}

export function parseArgumentNames(argumentNames: string | string[] | undefined): string[] {
  if (!argumentNames) return [];
  const isValidName = (name: string): boolean => typeof name === 'string' && name.trim() !== '' && !/^\d+$/.test(name);
  if (Array.isArray(argumentNames)) return argumentNames.filter(isValidName);
  if (typeof argumentNames === 'string') return argumentNames.split(/\s+/).filter(isValidName);
  return [];
}

export function generateProgressiveArgumentHint(argNames: string[], typedArgs: string[]): string | undefined {
  const remaining = argNames.slice(typedArgs.length);
  if (remaining.length === 0) return undefined;
  return remaining.map(name => `[${name}]`).join(' ');
}

export function substituteArguments(content: string, args: string | undefined, appendIfNoPlaceholder = true, argumentNames: string[] = []): string {
  if (args === undefined || args === null) return content;
  const parsedArgs = parseArguments(args);
  const originalContent = content;

  for (let i = 0; i < argumentNames.length; i++) {
    const name = argumentNames[i];
    if (!name) continue;
    content = content.replace(new RegExp(`\\$${name}(?![\\[\\w])`, 'g'), parsedArgs[i] ?? '');
  }

  content = content.replace(/\$ARGUMENTS\[(\d+)\]/g, (_, indexStr: string) => {
    const index = parseInt(indexStr, 10);
    return parsedArgs[index] ?? '';
  });

  content = content.replace(/\$(\d+)(?!\w)/g, (_, indexStr: string) => {
    const index = parseInt(indexStr, 10);
    return parsedArgs[index] ?? '';
  });

  content = content.replaceAll('$ARGUMENTS', args);

  if (content === originalContent && appendIfNoPlaceholder && args) {
    content = content + `\n\nARGUMENTS: ${args}`;
  }

  return content;
}
