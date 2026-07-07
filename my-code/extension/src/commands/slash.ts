import * as vscode from "vscode";
import {
  formatSessionList,
  listAllSessionMetas,
  listSessionMetas,
  messagesFromTranscript,
} from "../../../src/session/transcript.js";
import { sessionDir } from "../../../src/session/projectStore.js";
import { costFor, formatCost, loadPricing } from "../../../src/session/pricing.js";
import {
  listConfig,
  setConfigKey,
} from "../../../src/config/globalConfig.js";
import type { EngineHost } from "../runtime/EngineHost.js";

export interface SlashOutcome {
  notice?: { text: string; tone: "info" | "warn" | "error" };
  /** A user prompt to submit through the engine — used by /init. */
  submit?: string;
  /** Sessions list payload (the webview formats it). */
  sessions?: Array<{
    id: string;
    cwd: string;
    model: string;
    startedAt: number;
    turns: number;
    promptTokens: number;
    completionTokens: number;
  }>;
}

export async function runSlash(
  host: EngineHost,
  cmd: string,
  rest: string[],
): Promise<SlashOutcome> {
  switch (cmd) {
    case "help":
      return { notice: { text: HELP_TEXT, tone: "info" } };

    case "tools":
      return {
        notice: {
          text: host.engineRef.tools
            .map((t) => `${t.name} — ${t.description}`)
            .join("\n"),
          tone: "info",
        },
      };

    case "clear":
      host.resetConversation();
      return { notice: { text: "conversation cleared", tone: "info" } };

    case "compact": {
      if (host.isBusy()) {
        return {
          notice: {
            text: "can't compact while a turn is running",
            tone: "warn",
          },
        };
      }
      const focus = rest.join(" ").trim() || undefined;
      try {
        const r = await host.runCompact(focus);
        return {
          notice: {
            text:
              r.droppedCount === 0
                ? "nothing to compact"
                : `compacted ${r.droppedCount} messages into summary`,
            tone: "info",
          },
        };
      } catch (e) {
        return {
          notice: {
            text: `compact failed: ${msg(e)}`,
            tone: "error",
          },
        };
      }
    }

    case "plan": {
      const arg = rest[0];
      let next: boolean;
      if (arg === "on") next = true;
      else if (arg === "off") next = false;
      else next = !host.planMode;
      // toggle and notify
      while (host.planMode !== next) host.togglePlanMode();
      return {
        notice: {
          text: `plan mode ${next ? "ON — writes/edits/bash blocked" : "OFF"}`,
          tone: next ? "warn" : "info",
        },
      };
    }

    case "bypass": {
      const v = rest[0];
      if (v === "on" || v === "true") {
        host.setPermissionMode("bypass");
        return {
          notice: {
            text: "⚠ bypass ON — all tool calls auto-approved",
            tone: "warn",
          },
        };
      } else if (v === "off" || v === "false") {
        host.setPermissionMode("normal");
        return { notice: { text: "bypass OFF", tone: "info" } };
      }
      return {
        notice: {
          text: `bypass is ${
            host.currentEditMode === "bypass" ? "ON" : "OFF"
          }. usage: /bypass on|off`,
          tone: "info",
        },
      };
    }

    case "permissions": {
      const eng = host.permissionsEngine;
      if (!eng) return { notice: { text: "permissions not initialized", tone: "warn" } };
      const snap = eng.snapshot();
      const text = [
        `bypass: session=${snap.session.bypassAll} · project=${
          !!snap.project.bypassAll
        } · global=${!!snap.global.bypassAll}`,
        "── session ──",
        `  allow: ${snap.session.allow.join(", ") || "(none)"}`,
        `  deny:  ${snap.session.deny.join(", ") || "(none)"}`,
        "── project ──",
        `  allow: ${
          (snap.project.permissions?.allow ?? []).join(", ") || "(none)"
        }`,
        `  deny:  ${
          (snap.project.permissions?.deny ?? []).join(", ") || "(none)"
        }`,
        "── global ──",
        `  allow: ${
          (snap.global.permissions?.allow ?? []).join(", ") || "(none)"
        }`,
        `  deny:  ${
          (snap.global.permissions?.deny ?? []).join(", ") || "(none)"
        }`,
      ].join("\n");
      return { notice: { text, tone: "info" } };
    }

    case "allow":
    case "deny": {
      const eng = host.permissionsEngine;
      if (!eng) return { notice: { text: "permissions not initialized", tone: "warn" } };
      if (rest.length === 0) {
        const snap = eng.snapshot();
        const text = [
          `── ${cmd} ──`,
          `session: ${snap.session[cmd].join(", ") || "(none)"}`,
          `project: ${
            (snap.project.permissions?.[cmd] ?? []).join(", ") || "(none)"
          }`,
          `global:  ${
            (snap.global.permissions?.[cmd] ?? []).join(", ") || "(none)"
          }`,
        ].join("\n");
        return { notice: { text, tone: "info" } };
      }
      let scope: "session" | "project" | "global" = "session";
      let rule: string;
      if (rest[0] === "project" || rest[0] === "global" || rest[0] === "session") {
        scope = rest[0];
        rule = rest.slice(1).join(" ");
      } else {
        rule = rest.join(" ");
      }
      if (!rule) {
        return {
          notice: {
            text: `usage: /${cmd} [session|project|global] <rule>`,
            tone: "warn",
          },
        };
      }
      if (scope === "session") {
        if (cmd === "allow") eng.addSessionAllow(rule);
        else eng.addSessionDeny(rule);
        return { notice: { text: `session ${cmd}: ${rule}`, tone: "info" } };
      }
      try {
        await eng.addPersistedRule(scope, cmd, rule);
        return {
          notice: { text: `${scope} ${cmd}: ${rule} (saved)`, tone: "info" },
        };
      } catch (e) {
        return { notice: { text: `save failed: ${msg(e)}`, tone: "error" } };
      }
    }

    case "model":
      if (rest[0]) {
        host.setModel(rest[0]);
        return {
          notice: { text: `model → ${rest[0]}`, tone: "info" },
        };
      }
      // Fallback to QuickPick
      await vscode.commands.executeCommand("reno.pickModel");
      return {};

    case "models": {
      try {
        const list = await host.listModels();
        return {
          notice: {
            text: list.length ? list.join("\n") : "(no models installed)",
            tone: "info",
          },
        };
      } catch (e) {
        return { notice: { text: msg(e), tone: "error" } };
      }
    }

    case "todos": {
      const todos = host.appState.finalized; // not the right structure — use AppState directly
      // Use the in-memory todo tool state via getAppState — for Phase 4 just
      // tell the agent to print them.
      return { submit: "Show the current todo list using TodoWrite." };
    }

    case "cost": {
      const t = host.statsTotals();
      const pricing = await loadPricing();
      const c = costFor(
        host.providerName,
        host.model,
        t.promptTokens,
        t.completionTokens,
        pricing,
      );
      const text = [
        `turns: ${t.turns} · requests: ${t.requests}`,
        `tokens: ${t.promptTokens.toLocaleString()} in / ${t.completionTokens.toLocaleString()} out`,
        `api time: ${(t.apiMs / 1000).toFixed(1)}s · wall: ${
          (t.wallMs / 1000).toFixed(1)
        }s`,
        c === null
          ? "cost: $— (add pricing to ~/.ig/pricing.json)"
          : `cost: ${formatCost(c)}`,
      ].join("\n");
      return { notice: { text, tone: "info" } };
    }

    case "sessions": {
      try {
        const all = rest.includes("--all");
        const metas = all
          ? await listAllSessionMetas(30)
          : await listSessionMetas(host.cwdPath);
        return {
          sessions: metas,
          notice: { text: formatSessionList(metas), tone: "info" },
        };
      } catch (e) {
        return { notice: { text: `sessions failed: ${msg(e)}`, tone: "error" } };
      }
    }

    case "resume": {
      if (host.isBusy()) {
        return {
          notice: { text: "can't resume while a turn is running", tone: "warn" },
        };
      }
      const sessionId = rest[0];
      try {
        const dir = sessionDir(host.cwdPath);
        let filePath: string;
        if (sessionId) filePath = `${dir}/${sessionId}.jsonl`;
        else {
          const metas = await listSessionMetas(host.cwdPath);
          if (!metas.length) {
            return {
              notice: {
                text: "no sessions found for this project",
                tone: "warn",
              },
            };
          }
          filePath = `${dir}/${metas[0]!.id}.jsonl`;
        }
        const messages = await messagesFromTranscript(filePath);
        if (!messages) {
          return {
            notice: {
              text: "could not load session (no checkpoint found)",
              tone: "warn",
            },
          };
        }
        host.setMessages(messages);
        return {
          notice: {
            text: `✔ loaded ${messages.length} messages from previous session`,
            tone: "info",
          },
        };
      } catch (e) {
        return { notice: { text: `resume failed: ${msg(e)}`, tone: "error" } };
      }
    }

    case "config": {
      const sub = rest[0];
      if (sub === "get") {
        const key = rest[1];
        if (!key) return { notice: { text: "usage: /config get <key>", tone: "warn" } };
        const cfg = await listConfig();
        return {
          notice: {
            text: `${key} = ${(cfg as Record<string, string>)[key] ?? "(not set)"}`,
            tone: "info",
          },
        };
      }
      if (sub === "set") {
        const key = rest[1];
        const value = rest.slice(2).join(" ");
        if (!key || !value) {
          return {
            notice: { text: "usage: /config set <key> <value>", tone: "warn" },
          };
        }
        try {
          const { file, key: nk } = await setConfigKey(key, value);
          return { notice: { text: `✔ ${nk} saved to ${file}`, tone: "info" } };
        } catch (e) {
          return {
            notice: { text: `config set failed: ${msg(e)}`, tone: "error" },
          };
        }
      }
      const cfg = await listConfig();
      const entries = Object.entries(cfg);
      return {
        notice: {
          text:
            entries.length === 0
              ? "(no config set — use /config set <key> <value>)"
              : entries.map(([k, v]) => `  ${k.padEnd(18)} ${v}`).join("\n"),
          tone: "info",
        },
      };
    }

    case "init":
      return {
        submit:
          "Read the most important files in this project (package.json, README, top-level source dirs) and create a concise IG.md at the project root. Include: project purpose, tech stack, key directories, build/test commands, any conventions. Keep it under 60 lines.",
      };

    case "mcp": {
      const mcpTools = host.engineRef.tools.filter((t) =>
        t.name.startsWith("mcp__"),
      );
      if (!mcpTools.length) {
        return {
          notice: {
            text: "No MCP servers connected. Configure servers in ~/.reno/mcp.json or .reno/mcp.json.",
            tone: "info",
          },
        };
      }
      const byServer = new Map<string, string[]>();
      for (const t of mcpTools) {
        const parts = t.name.split("__");
        const server = parts[1] ?? "unknown";
        const tool = parts.slice(2).join("__");
        const list = byServer.get(server) ?? [];
        list.push(tool);
        byServer.set(server, list);
      }
      const lines = [...byServer].map(
        ([server, tools]) =>
          `${server} (${tools.length} tools): ${tools.join(", ")}`,
      );
      return { notice: { text: lines.join("\n"), tone: "info" } };
    }

    case "worktree":
      return {
        notice: {
          text: host.appState.worktreePath
            ? `active worktree: ${host.appState.worktreePath}`
            : "no active worktree (use the EnterWorktree tool to create one)",
          tone: "info",
        },
      };

    case "exit":
    case "quit":
      return {
        notice: { text: "(close the reno panel to end the session)", tone: "info" },
      };

    default:
      return { notice: { text: `unknown command: /${cmd}`, tone: "warn" } };
  }
}

const HELP_TEXT = [
  "/init                 scan project and create IG.md",
  "/allow [scope] <rule> add allow rule  (session|project|global)",
  "/deny  [scope] <rule> add deny rule",
  "/bypass on|off        toggle session bypass (dangerous)",
  "/permissions          show all permission state",
  "/clear                reset conversation",
  "/compact              summarize conversation to free context",
  "/cost                 show token usage + cost",
  "/model [id]           switch model directly",
  "/models               list installed models",
  "/todos                show current task list",
  "/tools                list registered tools",
  "/sessions [--all]     list recent sessions",
  "/resume [id]          resume a previous session",
  "/config get|set       read/write global config",
  "/plan on|off          toggle plan mode (read-only)",
  "/mcp                  list MCP servers and tools",
].join("\n");

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
