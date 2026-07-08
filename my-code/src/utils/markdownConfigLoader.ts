import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import type { FrontmatterData } from './frontmatterParser.js';
import { parseFrontmatter } from './frontmatterParser.js';

export type mycodeConfigDirectory = 'commands' | 'agents' | 'skills';

export type MarkdownFile = {
  filePath: string;
  baseDir: string;
  frontmatter: FrontmatterData;
  content: string;
  source: string;
};

export function extractDescriptionFromMarkdown(
  content: string,
  defaultDescription: string = 'Custom item',
): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      const headerMatch = trimmed.match(/^#+\s+(.+)$/);
      const text = headerMatch?.[1] ?? trimmed;
      return text.length > 100 ? text.substring(0, 97) + '...' : text;
    }
  }
  return defaultDescription;
}

export function parseSlashCommandToolsFromFrontmatter(toolsValue: unknown): string[] {
  if (!toolsValue) return [];
  if (typeof toolsValue === 'string') return [toolsValue];
  if (Array.isArray(toolsValue)) return toolsValue.filter(t => typeof t === 'string');
  return [];
}

export function parseAgentToolsFromFrontmatter(toolsValue: unknown): string[] | undefined {
  if (toolsValue === undefined) return undefined;
  if (!toolsValue) return [];
  let parsed = Array.isArray(toolsValue) ? toolsValue : [String(toolsValue)];
  if (parsed.includes('*')) return undefined;
  return parsed as string[];
}

export async function loadMarkdownFilesForSubdir(
  subdir: mycodeConfigDirectory,
  cwd: string,
): Promise<MarkdownFile[]> {
  const dirPath = join(cwd, '.my-code', subdir);
  const files: MarkdownFile[] = [];

  try {
    const stats = await stat(dirPath);
    if (!stats.isDirectory()) return [];

    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const filePath = join(dirPath, entry.name);
        const rawContent = await readFile(filePath, { encoding: 'utf-8' });
        const { frontmatter, content } = parseFrontmatter(rawContent, filePath);
        files.push({
          filePath,
          baseDir: dirPath,
          frontmatter,
          content,
          source: 'projectSettings',
        });
      }
    }
  } catch (error) {
    // Directory might not exist, which is fine
  }

  return files;
}
