/**
 * ToolSearchTool — Let the LLM search the tool registry by keyword.
 *
 * Useful when many MCP tools are loaded and the LLM needs to find
 * the right tool without reading the full list. Scores by name match
 * (CamelCase parts + mcp__server__action parts) and description keyword.
 */

import { z } from 'zod';
import { buildTool } from './Tool.js';

// Escape special regex characters
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Split a tool name into searchable tokens
function tokeniseName(name: string): string[] {
  if (name.startsWith('mcp__')) {
    return name
      .replace(/^mcp__/, '')
      .toLowerCase()
      .split('__')
      .flatMap(p => p.split('_'))
      .filter(Boolean);
  }
  // CamelCase -> ['camel', 'case']
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export const ToolSearchTool = buildTool({
  name: 'ToolSearch',
  description:
    'Search the available tool registry by keyword. ' +
    'Returns tool names that match your query, sorted by relevance. ' +
    'Use this when you need a tool for a specific capability but are not sure of its exact name. ' +
    'Examples: "file read", "git commit", "mcp slack", "schedule cron", "web search".',

  inputSchema: z.object({
    query: z.string().describe(
      'Keywords to search for. Use tool name parts, capability descriptions, or MCP server names. ' +
      'Example: "read file", "slack message", "schedule", "web search".'
    ),
    max_results: z.number().optional().default(8).describe(
      'Maximum number of results to return (default: 8).'
    ),
  }),

  isReadOnly: () => true,
  isConcurrencySafe: () => true,

  async call(input, ctx) {
    const { query, max_results = 8 } = input;

    if (!ctx.registry) {
      return 'Error: Tool registry is not available in this context.';
    }

    const allTools = ctx.registry.list();

    if (allTools.length === 0) {
      return 'No tools found in registry.';
    }

    const queryLower = query.toLowerCase().trim();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);

    // Exact name match fast-path
    const exact = allTools.find(t => t.name.toLowerCase() === queryLower);
    if (exact) {
      return formatResults([exact.name], allTools.length);
    }

    // MCP prefix fast-path
    if (queryLower.startsWith('mcp__') && queryLower.length > 5) {
      const prefixMatches = allTools
        .filter(t => t.name.toLowerCase().startsWith(queryLower))
        .slice(0, max_results)
        .map(t => t.name);
      if (prefixMatches.length > 0) {
        return formatResults(prefixMatches, allTools.length);
      }
    }

    // Compile word-boundary patterns
    const patterns = queryTerms.map(term => ({
      term,
      re: new RegExp(`\\b${escapeRegExp(term)}\\b`),
    }));

    // Score each tool
    const scored = allTools.map(t => {
      const tokens = tokeniseName(t.name);
      const nameStr = tokens.join(' ');
      const desc = (t.description ?? '').toLowerCase();
      const isMcp = t.name.startsWith('mcp__');

      let score = 0;
      for (const { term, re } of patterns) {
        // Token match in name
        if (tokens.includes(term)) {
          score += isMcp ? 12 : 10;
        } else if (tokens.some(tok => tok.includes(term))) {
          score += isMcp ? 6 : 5;
        } else if (nameStr.includes(term)) {
          score += 3;
        }
        // Description keyword match
        if (re.test(desc)) {
          score += 2;
        }
      }

      return { name: t.name, score };
    });

    const matches = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max_results)
      .map(s => s.name);

    return formatResults(matches, allTools.length);
  },

  getActivityDescription(input) {
    return `searching tools: "${input.query}"`;
  },
});

function formatResults(matches: string[], total: number): string {
  if (matches.length === 0) {
    return `No tools matched your query. Total tools available: ${total}. Try different keywords.`;
  }
  return [
    `Found ${matches.length} tool(s) (of ${total} total):`,
    ...matches.map(n => `  - ${n}`),
  ].join('\n');
}
