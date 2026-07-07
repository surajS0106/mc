/**
 * IDE Bridge — communication layer between the CLI and IDE extensions.
 *
 * The bridge enables VSCode (or any IDE) to:
 *   1. Send messages to the running CLI agent
 *   2. Receive real-time events (streaming, tool use, permission prompts)
 *   3. Share context (open files, cursor position, diagnostics)
 *   4. Control the agent (cancel, compact, switch model)
 *
 * Communication uses a local Unix/named-pipe socket + JSON-RPC protocol.
 * The CLI starts the server; the IDE extension connects as a client.
 *
 * Modeled after beta's bridge/ directory.
 */

import { createServer, type Server } from "node:net";
import { randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import type { SessionEvent } from "../agent/events.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BridgeMessage {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface BridgeNotification {
  method: string;
  params?: Record<string, unknown>;
}

export type BridgeHandler = (
  params: Record<string, unknown>
) => Promise<unknown> | unknown;

// ─── IDE Context (what the IDE sends us) ────────────────────────────────────

export interface IDEContext {
  /** Currently open files. */
  openFiles: string[];
  /** The active/focused file. */
  activeFile?: string;
  /** Cursor position in the active file. */
  cursor?: { line: number; column: number };
  /** Diagnostics (errors/warnings) from the IDE. */
  diagnostics?: Array<{
    file: string;
    line: number;
    severity: "error" | "warning" | "info";
    message: string;
  }>;
  /** Selection range, if any. */
  selection?: {
    file: string;
    startLine: number;
    endLine: number;
    text: string;
  };
}

// ─── Bridge Server ──────────────────────────────────────────────────────────

export class BridgeServer {
  private server: Server | null = null;
  private handlers = new Map<string, BridgeHandler>();
  private clients = new Set<import("node:net").Socket>();
  private _socketPath: string;
  private _ideContext: IDEContext = { openFiles: [] };

  constructor(sessionId: string) {
    // Socket path: ~/.my-code/bridge/<sessionId>.sock (Unix) or \\.\pipe\my-code-<sessionId> (Windows)
    if (os.platform() === "win32") {
      this._socketPath = `\\\\.\\pipe\\my-code-bridge-${sessionId}`;
    } else {
      this._socketPath = path.join(os.homedir(), ".my-code", "bridge", `${sessionId}.sock`);
    }
  }

  get socketPath(): string {
    return this._socketPath;
  }

  get ideContext(): IDEContext {
    return this._ideContext;
  }

  /** Register a handler for incoming RPC calls. */
  handle(method: string, fn: BridgeHandler): void {
    this.handlers.set(method, fn);
  }

  /** Start listening for IDE connections. */
  async start(): Promise<void> {
    // Ensure directory exists (Unix)
    if (os.platform() !== "win32") {
      await fs.mkdir(path.dirname(this._socketPath), { recursive: true });
      // Clean up stale socket
      try { await fs.unlink(this._socketPath); } catch {}
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => {
        this.clients.add(socket);
        let buffer = "";

        socket.on("data", (data) => {
          buffer += data.toString();
          // Process line-delimited JSON messages
          while (true) {
            const newlineIdx = buffer.indexOf("\n");
            if (newlineIdx === -1) break;
            const line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            this.handleMessage(socket, line);
          }
        });

        socket.on("close", () => {
          this.clients.delete(socket);
        });

        socket.on("error", () => {
          this.clients.delete(socket);
        });
      });

      this.server.listen(this._socketPath, () => resolve());
      this.server.on("error", reject);
    });
  }

  /** Stop the bridge server. */
  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    // Clean up socket file
    try { await fs.unlink(this._socketPath); } catch {}
  }

  /** Send a notification to all connected IDE clients. */
  notify(method: string, params?: Record<string, unknown>): void {
    const msg: BridgeNotification = { method, params };
    const line = JSON.stringify(msg) + "\n";
    for (const client of this.clients) {
      try { client.write(line); } catch {}
    }
  }

  /** Forward a SessionEvent to the IDE. */
  forwardEvent(event: SessionEvent): void {
    this.notify("agent/event", event as unknown as Record<string, unknown>);
  }

  /** Check if any IDE clients are connected. */
  get connected(): boolean {
    return this.clients.size > 0;
  }

  private async handleMessage(socket: import("node:net").Socket, raw: string): Promise<void> {
    try {
      const msg = JSON.parse(raw) as BridgeMessage;

      // Built-in handlers
      if (msg.method === "ide/context") {
        this._ideContext = msg.params as unknown as IDEContext;
        this.respond(socket, msg.id, { ok: true });
        return;
      }

      if (msg.method === "ide/ping") {
        this.respond(socket, msg.id, { pong: true, time: Date.now() });
        return;
      }

      // Custom handlers
      const handler = this.handlers.get(msg.method);
      if (handler) {
        const result = await handler(msg.params ?? {});
        this.respond(socket, msg.id, result);
      } else {
        this.respondError(socket, msg.id, -32601, `unknown method: ${msg.method}`);
      }
    } catch (e) {
      // Malformed message — ignore
    }
  }

  private respond(socket: import("node:net").Socket, id: string, result: unknown): void {
    const resp: BridgeResponse = { id, result };
    try { socket.write(JSON.stringify(resp) + "\n"); } catch {}
  }

  private respondError(socket: import("node:net").Socket, id: string, code: number, message: string): void {
    const resp: BridgeResponse = { id, error: { code, message } };
    try { socket.write(JSON.stringify(resp) + "\n"); } catch {}
  }
}

// ─── Bridge state file (how the IDE discovers the CLI) ──────────────────────

export interface BridgeInfo {
  sessionId: string;
  socketPath: string;
  pid: number;
  cwd: string;
  startedAt: number;
}

/** Write the bridge info file so the IDE can discover us. */
export async function writeBridgeInfo(info: BridgeInfo): Promise<string> {
  const dir = path.join(os.homedir(), ".my-code", "bridge");
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${info.sessionId}.json`);
  await fs.writeFile(filePath, JSON.stringify(info, null, 2) + "\n", "utf8");
  return filePath;
}

/** Remove the bridge info file on shutdown. */
export async function removeBridgeInfo(sessionId: string): Promise<void> {
  const filePath = path.join(os.homedir(), ".my-code", "bridge", `${sessionId}.json`);
  try { await fs.unlink(filePath); } catch {}
}

/** List all active bridge sessions (for the IDE to discover). */
export async function listBridgeSessions(): Promise<BridgeInfo[]> {
  const dir = path.join(os.homedir(), ".my-code", "bridge");
  try {
    const files = await fs.readdir(dir);
    const infos: BridgeInfo[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const txt = await fs.readFile(path.join(dir, f), "utf8");
        infos.push(JSON.parse(txt) as BridgeInfo);
      } catch {}
    }
    return infos;
  } catch {
    return [];
  }
}
