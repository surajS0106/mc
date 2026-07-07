#!/usr/bin/env node
/**
 * Microsoft 365 MCP connector (stdio) for my-code.
 *
 * Exposes Outlook mail + Teams chat tools backed by Microsoft Graph, ported
 * from the original Sunday connectors. Auth is decoupled: the my-code-desktop
 * app owns the device-code LOGIN and writes the token to
 *   ~/.my-code-desktop/tokens/microsoft.json
 * This server only READS that token and silently refreshes it. If there's no
 * token, tools return a "not connected" message.
 *
 * my-code loads this via ~/.my-code/mcp.json and exposes each tool as
 * mcp__microsoft__<name>.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

// ─── Auth constants (Synergech tenant app; override via env) ───
const MS_CLIENT_ID = process.env.MY_CODE_MS_CLIENT_ID?.trim() || "634d9e8d-0b13-4210-bdc4-8796e9ab797b";
const TENANT = process.env.MY_CODE_MS_TENANT?.trim() || "734e360f-9a39-4178-8e90-cb94d8c322ed";
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function tokenFile() {
  return join(homedir(), ".my-code-desktop", "tokens", "microsoft.json");
}

async function readToken() {
  try {
    return JSON.parse(await readFile(tokenFile(), "utf8"));
  } catch {
    return null;
  }
}
async function writeToken(tok) {
  const f = tokenFile();
  await mkdir(dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(tok, null, 2), "utf8");
}

async function exchangeRefreshToken(refreshToken, scopes) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: (scopes ?? []).join(" "),
    }).toString(),
  });
  if (!res.ok) throw new Error(`token refresh failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/** Return a valid access token, refreshing silently if expired. */
async function getAccessToken() {
  const stored = await readToken();
  if (!stored?.accessToken) {
    throw new Error(
      "Microsoft 365 is not connected. Open Settings → Connectors in my-code and click Connect."
    );
  }
  if (Date.now() < (stored.expiresAt ?? 0)) return stored.accessToken;
  if (!stored.refreshToken) throw new Error("Microsoft session expired — reconnect from Settings → Connectors.");
  const refreshed = await exchangeRefreshToken(stored.refreshToken, stored.scopes);
  const next = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || stored.refreshToken,
    expiresAt: Date.now() + (refreshed.expires_in - 60) * 1000,
    scopes: refreshed.scope ? refreshed.scope.split(" ") : stored.scopes,
    account: stored.account,
  };
  await writeToken(next);
  return next.accessToken;
}

async function graph(path, opts = {}) {
  const token = await getAccessToken();
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const u = new URL(url);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  }
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  let body;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(u.toString(), { method: opts.method ?? "GET", headers, body });
  if (!res.ok) {
    let detail = await res.text().catch(() => "");
    try {
      const j = JSON.parse(detail);
      if (j.error) detail = `[${j.error.code ?? ""}] ${j.error.message ?? detail}`;
    } catch {}
    throw new Error(`Graph ${opts.method ?? "GET"} ${path} → ${res.status}: ${detail}`);
  }
  if (res.status === 204) return undefined;
  return res.json();
}

// ─── Alias cache (short handles for opaque Graph ids) ───
const stores = new Map();
function setAliases(ns, ids, prefix) {
  const m = new Map();
  stores.set(ns, m);
  return ids.map((real, i) => {
    const a = `${prefix}${i + 1}`;
    m.set(a, real);
    return a;
  });
}
function resolveAlias(ns, value) {
  const v = String(value).trim().replace(/^["']|["']$/g, "");
  return stores.get(ns)?.get(v) ?? v;
}

function stripHtml(s) {
  return (s ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function senderOf(m) {
  const a = m.from?.emailAddress;
  if (!a) return "(unknown sender)";
  return a.name ? `${a.name} <${a.address ?? ""}>` : a.address ?? "(unknown)";
}
function normalizeRecipients(v) {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : String(v).split(/[,;]/);
  return arr.map((s) => s.trim()).filter(Boolean).map((address) => ({ emailAddress: { address } }));
}

// ─── Tool definitions (JSON Schema, no zod) ───
const TOOLS = [
  {
    name: "outlook_list_mail",
    description:
      "List recent Outlook inbox messages, newest first. Each gets a short alias (m1, m2). Pass the alias to outlook_read_mail — never guess raw ids.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many (default 10, max 50)." },
        unread_only: { type: "boolean", description: "Only unread." },
        search: { type: "string", description: "Substring to search subject/body." },
      },
    },
    handler: async (input) => {
      const limit = input.limit ?? 10;
      const query = {
        $top: limit,
        $orderby: "receivedDateTime desc",
        $select: "id,subject,bodyPreview,receivedDateTime,isRead,from,webLink",
      };
      const filters = [];
      if (input.unread_only) filters.push("isRead eq false");
      if (filters.length) query.$filter = filters.join(" and ");
      if (input.search) query.$search = `"${String(input.search).replace(/"/g, "")}"`;
      const data = await graph("/me/messages", { query });
      if (!data.value?.length) return "No messages found.";
      const aliases = setAliases("outlook_mail", data.value.map((m) => m.id), "m");
      return data.value
        .map((m, i) => {
          const unread = m.isRead === false ? "•" : " ";
          const when = m.receivedDateTime ? new Date(m.receivedDateTime).toLocaleString() : "?";
          const preview = (m.bodyPreview ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
          return [
            `${aliases[i]}. ${unread} ${senderOf(m)}`,
            `   subject: ${m.subject ?? "(no subject)"}`,
            `   received: ${when}`,
            preview ? `   preview: ${preview}` : "",
          ].filter(Boolean).join("\n");
        })
        .join("\n\n");
    },
  },
  {
    name: "outlook_read_mail",
    description: "Read the full body/headers of one Outlook message. Pass the alias (e.g. m1) from outlook_list_mail.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Alias like m1." } },
      required: ["id"],
    },
    handler: async (input) => {
      const realId = resolveAlias("outlook_mail", input.id);
      const m = await graph(`/me/messages/${encodeURIComponent(realId)}`, {
        query: { $select: "id,subject,bodyPreview,receivedDateTime,isRead,from,toRecipients,body,webLink" },
      });
      const to = (m.toRecipients ?? []).map((r) => r.emailAddress?.address).filter(Boolean).join(", ");
      const body = m.body?.contentType === "html" ? stripHtml(m.body.content) : (m.body?.content ?? m.bodyPreview ?? "");
      return [
        `From:    ${senderOf(m)}`,
        `To:      ${to || "(none)"}`,
        `Subject: ${m.subject ?? "(no subject)"}`,
        `Date:    ${m.receivedDateTime ?? "?"}`,
        m.webLink ? `Link:    ${m.webLink}` : "",
        "",
        body,
      ].filter(Boolean).join("\n");
    },
  },
  {
    name: "outlook_send_mail",
    description: "Send an email from the signed-in Outlook account.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient(s), comma-separated." },
        subject: { type: "string" },
        body: { type: "string", description: "Plain-text body." },
        cc: { type: "string", description: "Optional CC, comma-separated." },
      },
      required: ["to", "subject", "body"],
    },
    handler: async (input) => {
      await graph("/me/sendMail", {
        method: "POST",
        body: {
          message: {
            subject: input.subject,
            body: { contentType: "Text", content: input.body },
            toRecipients: normalizeRecipients(input.to),
            ccRecipients: normalizeRecipients(input.cc),
          },
          saveToSentItems: true,
        },
      });
      return `Sent. To: ${input.to}, Subject: "${input.subject}"`;
    },
  },
  {
    name: "teams_list_chats",
    description:
      "List the user's most-recently-active Teams chats. Each gets a short alias (c1, c2). Pass the alias to teams_read_chat/teams_send_chat.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "How many (default 15, max 50)." } },
    },
    handler: async (input) => {
      const limit = input.limit ?? 15;
      const data = await graph("/me/chats", {
        query: { $top: limit, $expand: "members,lastMessagePreview", $orderby: "lastMessagePreview/createdDateTime desc" },
      });
      if (!data.value?.length) return "No chats found.";
      const aliases = setAliases("teams_chats", data.value.map((c) => c.id), "c");
      const label = (c) => {
        if (c.topic) return c.topic;
        const names = (c.members ?? []).map((m) => m.displayName).filter(Boolean);
        if (c.chatType === "oneOnOne") return names[0] ?? "(unknown)";
        return names.length ? `group: ${names.slice(0, 3).join(", ")}` : "(group chat)";
      };
      return data.value
        .map((c, i) => {
          const when = c.lastMessagePreview?.createdDateTime
            ? new Date(c.lastMessagePreview.createdDateTime).toLocaleString()
            : "?";
          const p = c.lastMessagePreview;
          const preview = p?.body?.content
            ? `${p.from?.user?.displayName ? p.from.user.displayName + ": " : ""}${(p.body.contentType === "html" ? stripHtml(p.body.content) : p.body.content).slice(0, 120)}`
            : "";
          return [
            `${aliases[i]}. ${label(c)} (${c.chatType ?? "chat"})`,
            `   last: ${when}`,
            preview ? `   preview: ${preview}` : "",
          ].filter(Boolean).join("\n");
        })
        .join("\n\n");
    },
  },
  {
    name: "teams_read_chat",
    description: "Read recent messages from a Teams chat. Pass the alias (e.g. c1) from teams_list_chats.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Alias like c1." },
        limit: { type: "number", description: "How many messages (default 20)." },
      },
      required: ["id"],
    },
    handler: async (input) => {
      const realId = resolveAlias("teams_chats", input.id);
      const data = await graph(`/me/chats/${encodeURIComponent(realId)}/messages`, {
        query: { $top: input.limit ?? 20 },
      });
      if (!data.value?.length) return "No messages in this chat.";
      return [...data.value]
        .reverse()
        .map((m) => {
          const sender = m.from?.user?.displayName ?? "(system)";
          const when = m.createdDateTime ? new Date(m.createdDateTime).toLocaleString() : "?";
          const text = m.body?.contentType === "html" ? stripHtml(m.body.content) : (m.body?.content ?? "").trim();
          return `[${when}] ${sender}\n  ${text}`;
        })
        .join("\n\n");
    },
  },
  {
    name: "teams_send_chat",
    description: "Send a message to a Teams chat. Pass the alias (e.g. c1) from teams_list_chats.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Alias like c1." },
        body: { type: "string", description: "Plain-text message." },
      },
      required: ["id", "body"],
    },
    handler: async (input) => {
      const realId = resolveAlias("teams_chats", input.id);
      await graph(`/me/chats/${encodeURIComponent(realId)}/messages`, {
        method: "POST",
        body: { body: { contentType: "text", content: input.body } },
      });
      return `Sent to ${input.id}.`;
    },
  },
  {
    name: "teams_start_chat",
    description: "Start a new 1:1 Teams chat with a user by email (UPN). Optionally send a first message.",
    inputSchema: {
      type: "object",
      properties: {
        recipient_email: { type: "string", description: "user@domain.com" },
        body: { type: "string", description: "Optional first message." },
      },
      required: ["recipient_email"],
    },
    handler: async (input) => {
      const email = String(input.recipient_email).trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`Invalid email: "${email}".`);
      const me = "https://graph.microsoft.com/v1.0/users('me')";
      const them = `https://graph.microsoft.com/v1.0/users('${encodeURIComponent(email)}')`;
      const created = await graph("/chats", {
        method: "POST",
        body: {
          chatType: "oneOnOne",
          members: [
            { "@odata.type": "#microsoft.graph.aadUserConversationMember", roles: ["owner"], "user@odata.bind": me },
            { "@odata.type": "#microsoft.graph.aadUserConversationMember", roles: ["owner"], "user@odata.bind": them },
          ],
        },
      });
      let result = `Started 1:1 chat with ${email}. chat_id: "${created.id}".`;
      if (input.body) {
        await graph(`/chats/${encodeURIComponent(created.id)}/messages`, {
          method: "POST",
          body: { body: { contentType: "text", content: input.body } },
        });
        result += ` First message sent: "${input.body}"`;
      }
      return result;
    },
  },
];

// ─── MCP wiring ───
const server = new Server(
  { name: "microsoft", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) return { content: [{ type: "text", text: `unknown tool ${req.params.name}` }], isError: true };
  try {
    const text = await tool.handler(req.params.arguments ?? {});
    return { content: [{ type: "text", text: String(text) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
