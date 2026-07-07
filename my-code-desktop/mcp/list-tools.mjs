#!/usr/bin/env node
/**
 * One-shot MCP tool discovery. Reads a server config from the MCP_CFG env var
 * (JSON: { type:"stdio", command, args, env } | { type:"http", url, token }),
 * connects, lists tools, prints {"tools":[{name,description}]} to stdout, exits.
 *
 * Spawned by the desktop app (electron-as-node) so the Connectors UI can show
 * the tools inside a connector without the main bundle importing the ESM SDK.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const cfg = JSON.parse(process.env.MCP_CFG ?? "{}");
  let transport;
  if (cfg.type === "http") {
    const { StreamableHTTPClientTransport } = await import(
      "@modelcontextprotocol/sdk/client/streamableHttp.js"
    );
    const opts = cfg.token
      ? { requestInit: { headers: { Authorization: `Bearer ${cfg.token}` } } }
      : undefined;
    transport = new StreamableHTTPClientTransport(new URL(cfg.url), opts);
  } else {
    transport = new StdioClientTransport({
      command: cfg.command,
      args: cfg.args ?? [],
      env: { ...process.env, ...(cfg.env ?? {}) },
    });
  }
  const client = new Client({ name: "tool-lister", version: "1" }, { capabilities: {} });
  await client.connect(transport);
  const { tools } = await client.listTools();
  process.stdout.write(
    JSON.stringify({ tools: tools.map((t) => ({ name: t.name, description: t.description ?? "" })) })
  );
  await client.close();
}

main().then(
  () => process.exit(0),
  (e) => {
    process.stderr.write(String(e?.message ?? e));
    process.exit(1);
  }
);
