/**
 * ListMcpResources — Let the LLM browse resources exposed by MCP servers.
 *
 * MCP resources are named data items (files, configs, logs, etc.) that MCP
 * servers publish via the resources/list endpoint. They are separate from tools.
 */

import { z } from 'zod';
import { buildTool } from '../Tool.js';
import { getConnections } from '../../mcp/loader.js';
import { listMcpResources } from '../../mcp/client.js';

export const ListMcpResourcesTool = buildTool({
  name: 'ListMcpResources',
  description:
    'List resources available from connected MCP servers. ' +
    'MCP resources are named data items (files, configs, documents) published by MCP servers. ' +
    'Filter by server name with the `server` parameter, or omit to list all. ' +
    'Use ReadMcpResource to fetch the content of a specific resource by URI.',

  inputSchema: z.object({
    server: z.string().optional().describe(
      'Optional MCP server name to filter by. ' +
      'Omit to list resources from all connected servers.'
    ),
  }),

  isReadOnly: () => true,
  isConcurrencySafe: () => true,

  async call({ server: targetServer }) {
    const connections = getConnections();

    if (connections.length === 0) {
      return 'No MCP servers are currently connected. Configure MCP servers in .my-code/mcp.json.';
    }

    const filtered = targetServer
      ? connections.filter(c => c.serverName === targetServer)
      : connections;

    if (targetServer && filtered.length === 0) {
      const available = connections.map(c => c.serverName).join(', ');
      return `Server "${targetServer}" not found. Available servers: ${available}`;
    }

    const allResources: Array<{
      server: string;
      uri: string;
      name: string;
      mimeType?: string;
      description?: string;
    }> = [];

    for (const conn of filtered) {
      try {
        const resources = await listMcpResources(conn);
        for (const r of resources) {
          allResources.push({ server: conn.serverName, ...r });
        }
      } catch {
        // One server failure doesn't block others
      }
    }

    if (allResources.length === 0) {
      return targetServer
        ? `Server "${targetServer}" has no resources (or does not support the resources API).`
        : 'No resources found across all connected MCP servers.';
    }

    return allResources.map(r => {
      const mime = r.mimeType ? ` [${r.mimeType}]` : '';
      const desc = r.description ? `\n    ${r.description}` : '';
      return `[${r.server}] ${r.name}${mime}\n  URI: ${r.uri}${desc}`;
    }).join('\n\n');
  },

  getActivityDescription(input) {
    return input.server
      ? `listing MCP resources from: ${input.server}`
      : 'listing MCP resources';
  },
});
