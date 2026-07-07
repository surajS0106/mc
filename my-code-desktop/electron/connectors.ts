/**
 * Connector + MCP management for the desktop app (main process).
 *
 *  - Microsoft 365: device-code OAuth login (this file owns the flow + token
 *    store at ~/.my-code-desktop/tokens/microsoft.json). The MCP server
 *    (mcp/microsoft/server.mjs) only reads/refreshes that token.
 *  - MCP config: reads/writes ~/.my-code/mcp.json — the same file `my-code
 *    serve` loads. Enabling a connector adds its server entry; disabling
 *    removes it.
 */

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { spawn } from "node:child_process";

// ─── Microsoft device-code auth ───
const MS_CLIENT_ID = process.env.MY_CODE_MS_CLIENT_ID?.trim() || "634d9e8d-0b13-4210-bdc4-8796e9ab797b";
const TENANT = process.env.MY_CODE_MS_TENANT?.trim() || "734e360f-9a39-4178-8e90-cb94d8c322ed";
const DEVICE_CODE_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/devicecode`;
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const MS_SCOPES = ["offline_access", "User.Read", "Mail.Read", "Mail.Send", "Chat.ReadWrite"];

export function msTokenFile(): string {
  return join(homedir(), ".my-code-desktop", "tokens", "microsoft.json");
}

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  account?: string;
}

async function readMsToken(): Promise<StoredToken | null> {
  try {
    return JSON.parse(await readFile(msTokenFile(), "utf8")) as StoredToken;
  } catch {
    return null;
  }
}
async function writeMsToken(tok: StoredToken): Promise<void> {
  const f = msTokenFile();
  await mkdir(dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(tok, null, 2), "utf8");
}

export interface DevicePrompt {
  userCode: string;
  verificationUri: string;
  expiresInSeconds: number;
  message: string;
}

function decodeAccount(idToken?: string): string | undefined {
  if (!idToken) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as {
      preferred_username?: string;
      upn?: string;
      email?: string;
    };
    return payload.preferred_username ?? payload.upn ?? payload.email;
  } catch {
    return undefined;
  }
}

async function postForm(url: string, body: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
}

/**
 * Begin the device-code flow. Returns the prompt to show the user, plus a
 * promise that resolves (account) when they finish signing in, or rejects.
 */
export async function beginMicrosoftLogin(): Promise<{
  prompt: DevicePrompt;
  completion: Promise<string | undefined>;
}> {
  const res = await postForm(DEVICE_CODE_URL, {
    client_id: MS_CLIENT_ID,
    scope: MS_SCOPES.join(" "),
  });
  if (!res.ok) throw new Error(`device-code request failed (${res.status}): ${await res.text()}`);
  const device = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
    message: string;
  };

  const completion = (async (): Promise<string | undefined> => {
    const deadline = Date.now() + device.expires_in * 1000;
    let interval = Math.max(1, device.interval) * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval));
      const pr = await postForm(TOKEN_URL, {
        client_id: MS_CLIENT_ID,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: device.device_code,
      });
      if (pr.ok) {
        const tok = (await pr.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope?: string;
          id_token?: string;
        };
        if (!tok.refresh_token) throw new Error("no refresh_token returned (missing offline_access?)");
        const account = decodeAccount(tok.id_token);
        await writeMsToken({
          accessToken: tok.access_token,
          refreshToken: tok.refresh_token,
          expiresAt: Date.now() + (tok.expires_in - 60) * 1000,
          scopes: tok.scope ? tok.scope.split(" ") : MS_SCOPES,
          account,
        });
        return account;
      }
      const err = (await pr.json().catch(() => ({}))) as { error?: string };
      if (err.error === "authorization_pending") continue;
      if (err.error === "slow_down") {
        interval += 5000;
        continue;
      }
      throw new Error(`sign-in failed: ${err.error ?? pr.status}`);
    }
    throw new Error("device code expired before sign-in completed");
  })();

  return {
    prompt: {
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      expiresInSeconds: device.expires_in,
      message: device.message,
    },
    completion,
  };
}

export async function microsoftStatus(): Promise<{ connected: boolean; account?: string }> {
  const t = await readMsToken();
  return { connected: !!t?.refreshToken, account: t?.account };
}

export async function microsoftLogout(): Promise<void> {
  await rm(msTokenFile(), { force: true });
}

// ─── MCP config (~/.my-code/mcp.json) ───

export interface McpServerCfg {
  type: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  token?: string;
}
interface McpFile {
  servers: Record<string, McpServerCfg>;
}

function mcpConfigFile(): string {
  return join(homedir(), ".my-code", "mcp.json");
}
async function readMcp(): Promise<McpFile> {
  try {
    const f = JSON.parse(await readFile(mcpConfigFile(), "utf8")) as McpFile;
    if (!f.servers) f.servers = {};
    return f;
  } catch {
    return { servers: {} };
  }
}
async function writeMcp(f: McpFile): Promise<void> {
  const p = mcpConfigFile();
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(f, null, 2), "utf8");
}

export async function listMcpServers(): Promise<Record<string, McpServerCfg>> {
  return (await readMcp()).servers;
}
export async function setMcpServer(name: string, cfg: McpServerCfg): Promise<void> {
  const f = await readMcp();
  f.servers[name] = cfg;
  await writeMcp(f);
}
export async function removeMcpServer(name: string): Promise<void> {
  const f = await readMcp();
  delete f.servers[name];
  await writeMcp(f);
}

/**
 * stdio config for the built-in Microsoft server. Uses the Electron binary as
 * Node (ELECTRON_RUN_AS_NODE) so it runs without a system `node` on PATH.
 */
export function microsoftServerCfg(serverJsPath: string): McpServerCfg {
  return {
    type: "stdio",
    command: process.execPath,
    args: [serverJsPath],
    env: { ELECTRON_RUN_AS_NODE: "1" },
  };
}

export interface McpToolInfo {
  name: string;
  description: string;
}

/**
 * Discover the tools a connector exposes by spawning list-tools.mjs against its
 * config. No token needed — tools/list works unauthenticated. Returns [] on
 * failure (server offline, bad config) so the UI degrades gracefully.
 */
export function discoverMcpTools(cfg: McpServerCfg, listToolsJsPath: string): Promise<McpToolInfo[]> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [listToolsJsPath], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", MCP_CFG: JSON.stringify(cfg) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    const done = (tools: McpToolInfo[]) => {
      try {
        child.kill();
      } catch {
        /* noop */
      }
      resolve(tools);
    };
    child.on("close", () => {
      try {
        const parsed = JSON.parse(out) as { tools?: McpToolInfo[] };
        resolve(parsed.tools ?? []);
      } catch {
        resolve([]);
      }
    });
    child.on("error", () => done([]));
    setTimeout(() => done([]), 10_000);
  });
}
