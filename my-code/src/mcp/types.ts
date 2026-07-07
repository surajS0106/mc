/**
 * Config shapes for `~/.my-code/mcp.json` and `.my-code/mcp.json` (project-scoped).
 *
 * Two transports today: stdio (spawn a subprocess) and http (remote URL).
 * Future transports — websocket, sse — slot in here as new `type` literals.
 */

export interface StdioMcpServerConfig {
  type: "stdio";
  /** Executable to spawn (resolved via PATH). */
  command: string;
  /** Args to pass to the executable. */
  args?: string[];
  /** Extra env vars merged with parent env. */
  env?: Record<string, string>;
  /** cwd for the spawned process. */
  cwd?: string;
}

export interface HttpMcpServerConfig {
  type: "http";
  /** Base URL of the remote MCP server. */
  url: string;
  /** Optional bearer token. Will be sent as Authorization: Bearer <token>. */
  token?: string;
  /** Additional HTTP headers. */
  headers?: Record<string, string>;
}

export type McpServerConfig = StdioMcpServerConfig | HttpMcpServerConfig;

/**
 * The `mcp.json` file shape:
 * {
 *   "servers": {
 *     "filesystem": { "type": "stdio", "command": "npx", "args": ["@modelcontextprotocol/server-filesystem", "/Users/me"] },
 *     "github":     { "type": "http",  "url": "https://example.com/mcp", "token": "..." }
 *   }
 * }
 */
export interface McpFile {
  servers?: Record<string, McpServerConfig>;
}

export interface NamedMcpServer {
  name: string;
  config: McpServerConfig;
}
