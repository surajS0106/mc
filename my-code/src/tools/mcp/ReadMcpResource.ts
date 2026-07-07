/**
 * ReadMcpResource — Read the content of a specific MCP resource by URI.
 *
 * MCP resources are named data items published by MCP servers.
 * Use ListMcpResources first to discover available URIs.
 */

import { z } from 'zod';
import { buildTool } from '../Tool.js';
import { getConnections } from '../../mcp/loader.js';
import { readMcpResource } from '../../mcp/client.js';

export const ReadMcpResourceTool = buildTool({
  name: 'ReadMcpResource',
  description:
    'Read the content of a specific MCP resource by URI. ' +
    'Use ListMcpResources first to discover available URIs and server names. ' +
    'Returns the text content of the resource.',

  inputSchema: z.object({
    server: z.string().describe(
      'The MCP server name that owns this resource.'
    ),
    uri: z.string().describe(
      'The resource URI as returned by ListMcpResources (e.g. "file:///path/to/resource").'
    ),
  }),

  isReadOnly: () => true,
  isConcurrencySafe: () => true,

  async call({ server: serverName, uri }) {
    const connections = getConnections();

    if (connections.length === 0) {
      return 'No MCP servers are currently connected.';
    }

    const conn = connections.find(c => c.serverName === serverName);
    if (!conn) {
      const available = connections.map(c => c.serverName).join(', ');
      return `Server "${serverName}" not found. Available servers: ${available}`;
    }

    try {
      const contents = await readMcpResource(conn, uri);

      if (contents.length === 0) {
        return `Resource "${uri}" returned empty content.`;
      }

      return contents.map(c => {
        const header = c.mimeType ? `[${c.mimeType}] ${c.uri}` : c.uri;
        const body = c.text ?? '(no text content)';
        return `--- ${header} ---\n${body}`;
      }).join('\n\n');
    } catch (e) {
      return `Error reading resource: ${e instanceof Error ? e.message : String(e)}`;
    }
  },

  getActivityDescription(input) {
    return `reading MCP resource: ${input.uri}`;
  },
});
