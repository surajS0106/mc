"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../src/hooks/index.ts
var hooks_exports = {};
__export(hooks_exports, {
  clearHooks: () => clearHooks,
  hookCount: () => hookCount,
  registerHook: () => registerHook,
  runPostToolUseHooks: () => runPostToolUseHooks,
  runPreToolUseHooks: () => runPreToolUseHooks,
  runSessionEndHooks: () => runSessionEndHooks,
  runSessionStartHooks: () => runSessionStartHooks
});
function registerHook(phase, fn) {
  switch (phase) {
    case "PreToolUse":
      store.preToolUse.push(fn);
      break;
    case "PostToolUse":
      store.postToolUse.push(fn);
      break;
    case "SessionStart":
      store.sessionStart.push(fn);
      break;
    case "SessionEnd":
      store.sessionEnd.push(fn);
      break;
  }
}
function clearHooks() {
  store.preToolUse = [];
  store.postToolUse = [];
  store.sessionStart = [];
  store.sessionEnd = [];
}
function hookCount() {
  return {
    PreToolUse: store.preToolUse.length,
    PostToolUse: store.postToolUse.length,
    SessionStart: store.sessionStart.length,
    SessionEnd: store.sessionEnd.length
  };
}
async function runPreToolUseHooks(args) {
  let denied = null;
  let modifiedInput = null;
  for (const hook of store.preToolUse) {
    try {
      const result = await hook(args);
      if (result?.deny) {
        denied = result.deny;
        break;
      }
      if (result?.modifiedInput) {
        modifiedInput = result.modifiedInput;
      }
    } catch (e) {
      process.stderr.write(
        `  \u26A0 PreToolUse hook error: ${e instanceof Error ? e.message : String(e)}
`
      );
    }
  }
  return { denied, modifiedInput };
}
async function runPostToolUseHooks(args) {
  let modifiedOutput = null;
  for (const hook of store.postToolUse) {
    try {
      const result = await hook(args);
      if (result?.modifiedOutput) {
        modifiedOutput = result.modifiedOutput;
      }
    } catch (e) {
      process.stderr.write(
        `  \u26A0 PostToolUse hook error: ${e instanceof Error ? e.message : String(e)}
`
      );
    }
  }
  return { modifiedOutput };
}
async function runSessionStartHooks(args) {
  for (const hook of store.sessionStart) {
    try {
      await hook(args);
    } catch (e) {
      process.stderr.write(
        `  \u26A0 SessionStart hook error: ${e instanceof Error ? e.message : String(e)}
`
      );
    }
  }
}
async function runSessionEndHooks(args) {
  for (const hook of store.sessionEnd) {
    try {
      await hook(args);
    } catch (e) {
      process.stderr.write(
        `  \u26A0 SessionEnd hook error: ${e instanceof Error ? e.message : String(e)}
`
      );
    }
  }
}
var store;
var init_hooks = __esm({
  "../src/hooks/index.ts"() {
    "use strict";
    store = {
      preToolUse: [],
      postToolUse: [],
      sessionStart: [],
      sessionEnd: []
    };
  }
});

// ../src/config/globalConfig.ts
function renoDir() {
  return import_node_path3.default.join(import_node_os3.default.homedir(), ".reno");
}
function configPath() {
  return import_node_path3.default.join(renoDir(), "config.json");
}
function localConfigPath() {
  return import_node_path3.default.join(renoDir(), "settings.local.json");
}
function projectConfigPath(cwd) {
  return import_node_path3.default.join(cwd ?? process.cwd(), ".reno", "config.json");
}
async function readJsonSafe2(p) {
  try {
    return JSON.parse(await import_promises3.default.readFile(p, "utf8"));
  } catch {
    return {};
  }
}
async function writeJsonSafe(p, data) {
  await import_promises3.default.mkdir(import_node_path3.default.dirname(p), { recursive: true });
  await import_promises3.default.writeFile(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}
async function loadConfig(cwd) {
  const [userCfg, projectCfg, localCfg] = await Promise.all([
    readJsonSafe2(configPath()),
    readJsonSafe2(projectConfigPath(cwd)),
    readJsonSafe2(localConfigPath())
  ]);
  const sources = {};
  const pick = (key, ...layers) => {
    for (const layer of layers.reverse()) {
      if (layer.val !== void 0) {
        sources[key] = layer.src;
        return layer.val;
      }
    }
    return void 0;
  };
  const accounts = localCfg.accounts ?? [];
  const activeId = localCfg.activeAccountId;
  const activeAccount = activeId ? accounts.find((a) => a.id === activeId) : void 0;
  const activeOllama = activeAccount?.provider === "ollama" ? activeAccount : void 0;
  return {
    accounts,
    activeAccountId: activeId,
    provider: pick(
      "provider",
      { val: userCfg.provider, src: "user" },
      { val: projectCfg.provider, src: "project" },
      { val: process.env.RENO_PROVIDER, src: "env" }
    ),
    defaultModel: pick(
      "defaultModel",
      { val: userCfg.defaultModel, src: "user" },
      { val: projectCfg.defaultModel, src: "project" },
      { val: process.env.RENO_MODEL, src: "env" }
    ),
    ollamaHost: pick(
      "ollamaHost",
      { val: userCfg.ollamaHost, src: "user" },
      { val: projectCfg.ollamaHost, src: "project" },
      { val: localCfg.ollamaHost, src: "local" },
      { val: process.env.OLLAMA_HOST, src: "env" },
      { val: activeOllama?.host, src: "account" }
    ),
    ollamaApiKey: pick(
      "ollamaApiKey",
      { val: localCfg.ollamaApiKey, src: "local" },
      { val: process.env.OLLAMA_API_KEY, src: "env" },
      { val: activeOllama?.apiKey, src: "account" }
    ),
    openaiApiKey: pick(
      "openaiApiKey",
      { val: localCfg.openaiApiKey, src: "local" },
      { val: process.env.OPENAI_API_KEY, src: "env" }
    ),
    openaiBaseUrl: pick(
      "openaiBaseUrl",
      { val: userCfg.openaiBaseUrl, src: "user" },
      { val: projectCfg.openaiBaseUrl, src: "project" },
      { val: process.env.OPENAI_BASE_URL, src: "env" }
    ),
    geminiApiKey: pick(
      "geminiApiKey",
      { val: localCfg.geminiApiKey, src: "local" },
      { val: process.env.GEMINI_API_KEY, src: "env" }
    ),
    geminiBaseUrl: pick(
      "geminiBaseUrl",
      { val: userCfg.geminiBaseUrl, src: "user" },
      { val: projectCfg.geminiBaseUrl, src: "project" }
    ),
    _sources: sources
  };
}
function normalizeKey(key) {
  if (key === "model") return "defaultModel";
  if (key === "apiKey" || key === "api-key") return "ollamaApiKey";
  if (key === "host") return "ollamaHost";
  return key;
}
async function setConfigKey(key, value) {
  const nk = normalizeKey(key);
  const isSecret = SECRET_KEYS.has(nk);
  const file = isSecret ? localConfigPath() : configPath();
  const current = isSecret ? await readJsonSafe2(file) : await readJsonSafe2(file);
  current[nk] = value;
  await writeJsonSafe(file, current);
  return { file, key: nk };
}
function maskSecret(s) {
  return "***" + s.slice(-4);
}
async function listConfig() {
  const cfg = await loadConfig();
  const out = {};
  if (cfg.provider) out.provider = cfg.provider;
  if (cfg.defaultModel) out.defaultModel = cfg.defaultModel;
  if (cfg.ollamaHost) out.ollamaHost = cfg.ollamaHost;
  if (cfg.ollamaApiKey) out.ollamaApiKey = maskSecret(cfg.ollamaApiKey);
  if (cfg.openaiApiKey) out.openaiApiKey = maskSecret(cfg.openaiApiKey);
  if (cfg.openaiBaseUrl) out.openaiBaseUrl = cfg.openaiBaseUrl;
  if (cfg.geminiApiKey) out.geminiApiKey = maskSecret(cfg.geminiApiKey);
  if (cfg.geminiBaseUrl) out.geminiBaseUrl = cfg.geminiBaseUrl;
  return out;
}
var import_promises3, import_node_path3, import_node_os3, SECRET_KEYS;
var init_globalConfig = __esm({
  "../src/config/globalConfig.ts"() {
    "use strict";
    import_promises3 = __toESM(require("node:fs/promises"), 1);
    import_node_path3 = __toESM(require("node:path"), 1);
    import_node_os3 = __toESM(require("node:os"), 1);
    SECRET_KEYS = /* @__PURE__ */ new Set(["ollamaApiKey", "openaiApiKey", "geminiApiKey"]);
  }
});

// ../src/session/projectStore.ts
var projectStore_exports = {};
__export(projectStore_exports, {
  ensureProjectMeta: () => ensureProjectMeta,
  hashProject: () => hashProject,
  listProjects: () => listProjects,
  projectDir: () => projectDir,
  sessionDir: () => sessionDir
});
function hashProject(cwd) {
  return (0, import_node_crypto3.createHash)("sha256").update(cwd).digest("hex").slice(0, 16);
}
function projectDir(cwd) {
  return import_node_path4.default.join(renoDir(), "projects", hashProject(cwd));
}
function sessionDir(cwd) {
  return import_node_path4.default.join(projectDir(cwd), "sessions");
}
async function ensureProjectMeta(cwd) {
  const dir = projectDir(cwd);
  const metaPath = import_node_path4.default.join(dir, "meta.json");
  try {
    await import_promises4.default.access(metaPath);
  } catch {
    await import_promises4.default.mkdir(dir, { recursive: true });
    const meta = { cwd, hash: hashProject(cwd), createdAt: Date.now() };
    await import_promises4.default.writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
  }
}
async function listProjects() {
  const projectsDir = import_node_path4.default.join(renoDir(), "projects");
  try {
    const entries = await import_promises4.default.readdir(projectsDir, { withFileTypes: true });
    const metas = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        const txt = await import_promises4.default.readFile(
          import_node_path4.default.join(projectsDir, e.name, "meta.json"),
          "utf8"
        );
        metas.push(JSON.parse(txt));
      } catch {
      }
    }
    return metas;
  } catch {
    return [];
  }
}
var import_node_crypto3, import_promises4, import_node_path4;
var init_projectStore = __esm({
  "../src/session/projectStore.ts"() {
    "use strict";
    import_node_crypto3 = require("node:crypto");
    import_promises4 = __toESM(require("node:fs/promises"), 1);
    import_node_path4 = __toESM(require("node:path"), 1);
    init_globalConfig();
  }
});

// ../src/session/transcript.ts
var transcript_exports = {};
__export(transcript_exports, {
  TranscriptWriter: () => TranscriptWriter,
  deleteSession: () => deleteSession,
  exportSessionAsMarkdown: () => exportSessionAsMarkdown,
  formatSessionList: () => formatSessionList,
  listAllSessionMetas: () => listAllSessionMetas,
  listSessionMetas: () => listSessionMetas,
  loadTranscript: () => loadTranscript,
  messagesFromTranscript: () => messagesFromTranscript,
  searchSessions: () => searchSessions
});
async function loadTranscript(filePath) {
  try {
    const txt = await import_promises10.default.readFile(filePath, "utf8");
    return txt.split("\n").filter(Boolean).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
async function messagesFromTranscript(filePath) {
  const events = await loadTranscript(filePath);
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "checkpoint") return e.messages;
  }
  return reconstructFromEvents(events);
}
function reconstructFromEvents(events) {
  if (events.length === 0) return null;
  const messages = [];
  for (const ev of events) {
    switch (ev.type) {
      case "user":
        messages.push({ role: "user", content: ev.content });
        break;
      case "assistant":
        messages.push({ role: "assistant", content: ev.content });
        break;
      case "tool_result":
        messages.push({ role: "tool", tool_name: ev.name, content: ev.result });
        break;
    }
  }
  return messages.length > 0 ? messages : null;
}
async function listSessionMetas(cwd) {
  const dir = sessionDir(cwd);
  try {
    const files = await import_promises10.default.readdir(dir);
    const metaFiles = files.filter((f) => f.endsWith(".meta.json")).sort().reverse();
    const out = [];
    for (const f of metaFiles) {
      try {
        const txt = await import_promises10.default.readFile(import_node_path11.default.join(dir, f), "utf8");
        out.push(JSON.parse(txt));
      } catch {
      }
    }
    return out;
  } catch {
    return [];
  }
}
async function listAllSessionMetas(limit = 20) {
  const { listProjects: listProjects2 } = await Promise.resolve().then(() => (init_projectStore(), projectStore_exports));
  const projects = await listProjects2();
  const all = [];
  for (const p of projects) {
    const metas = await listSessionMetas(p.cwd);
    all.push(...metas);
  }
  return all.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0)).slice(0, limit);
}
async function searchSessions(cwd, query) {
  const metas = await listSessionMetas(cwd);
  const q = query.toLowerCase();
  return metas.filter(
    (m) => m.summary?.toLowerCase().includes(q) || m.model.toLowerCase().includes(q) || m.id.includes(q)
  );
}
async function deleteSession(cwd, sessionId) {
  const dir = sessionDir(cwd);
  try {
    await import_promises10.default.unlink(import_node_path11.default.join(dir, `${sessionId}.jsonl`)).catch(() => {
    });
    await import_promises10.default.unlink(import_node_path11.default.join(dir, `${sessionId}.meta.json`)).catch(() => {
    });
    return true;
  } catch {
    return false;
  }
}
async function exportSessionAsMarkdown(filePath) {
  const events = await loadTranscript(filePath);
  const lines = ["# Session Transcript\n"];
  for (const ev of events) {
    switch (ev.type) {
      case "user":
        lines.push(`## User
${ev.content}
`);
        break;
      case "assistant":
        lines.push(`## Assistant
${ev.content}
`);
        break;
      case "tool_call":
        lines.push(`### Tool: ${ev.name}
\`\`\`json
${JSON.stringify(ev.args, null, 2)}
\`\`\`
`);
        break;
      case "tool_result":
        lines.push(`### Result: ${ev.name}${ev.isError ? " \u274C" : ""}
\`\`\`
${ev.result.slice(0, 2e3)}
\`\`\`
`);
        break;
      case "system":
        lines.push(`> ${ev.content}
`);
        break;
    }
  }
  return lines.join("\n");
}
function formatSessionList(sessions) {
  if (sessions.length === 0) return "(no sessions found)";
  const now = Date.now();
  return sessions.map((s, i) => {
    const age = now - s.startedAt;
    const ageStr = age < 6e4 ? "just now" : age < 36e5 ? `${Math.round(age / 6e4)}m ago` : age < 864e5 ? `${Math.round(age / 36e5)}h ago` : `${Math.round(age / 864e5)}d ago`;
    const tokens = s.promptTokens + s.completionTokens;
    const tokStr = tokens > 0 ? tokens < 1e3 ? `${tokens}` : `${(tokens / 1e3).toFixed(1)}k` : "\u2014";
    const shortCwd = s.cwd.replace(/\\/g, "/").split("/").slice(-2).join("/");
    const summary = s.summary ? ` "${s.summary.slice(0, 40)}"` : "";
    return `  [${i + 1}] ${ageStr.padEnd(10)} ${s.turns}t \xB7 ${tokStr} tok \xB7 ${s.model.replace(/:.*$/, "")} \xB7 ${shortCwd}${summary}  (${s.id})`;
  }).join("\n");
}
var import_promises10, import_node_path11, AUTO_CHECKPOINT_INTERVAL, TranscriptWriter;
var init_transcript = __esm({
  "../src/session/transcript.ts"() {
    "use strict";
    import_promises10 = __toESM(require("node:fs/promises"), 1);
    import_node_path11 = __toESM(require("node:path"), 1);
    init_projectStore();
    AUTO_CHECKPOINT_INTERVAL = 5;
    TranscriptWriter = class {
      handle = null;
      filePath;
      metaPath;
      meta;
      turnsSinceCheckpoint = 0;
      _onCheckpoint = null;
      constructor(sessionId, cwd, model) {
        const dir = sessionDir(cwd);
        this.filePath = import_node_path11.default.join(dir, `${sessionId}.jsonl`);
        this.metaPath = import_node_path11.default.join(dir, `${sessionId}.meta.json`);
        this.meta = {
          id: sessionId,
          cwd,
          model,
          startedAt: Date.now(),
          turns: 0,
          promptTokens: 0,
          completionTokens: 0
        };
      }
      /** Set a callback that provides messages for auto-checkpointing. */
      set onCheckpoint(fn) {
        this._onCheckpoint = fn;
      }
      async open() {
        await ensureProjectMeta(this.meta.cwd);
        await import_promises10.default.mkdir(import_node_path11.default.dirname(this.filePath), { recursive: true });
        this.handle = await import_promises10.default.open(this.filePath, "a");
        await this.flushMeta();
      }
      async append(event) {
        if (!this.handle) return;
        try {
          await this.handle.write(JSON.stringify(event) + "\n");
          if (event.type === "user" && !this.meta.summary) {
            this.meta.summary = event.content.slice(0, 100).replace(/\n/g, " ");
            await this.flushMeta();
          }
        } catch {
        }
      }
      // Save a checkpoint of the full message array so resume can reconstruct the agent
      async checkpoint(messages) {
        await this.append({ type: "checkpoint", messages, at: Date.now() });
        this.turnsSinceCheckpoint = 0;
      }
      /** Track turns and auto-checkpoint periodically. */
      async trackTurn(messages) {
        this.turnsSinceCheckpoint++;
        if (this.turnsSinceCheckpoint >= AUTO_CHECKPOINT_INTERVAL && messages) {
          await this.checkpoint(messages);
        }
      }
      // Update running stats and flush the meta file (fast summary for /sessions listing)
      async updateMeta(partial) {
        Object.assign(this.meta, partial);
        await this.flushMeta();
      }
      async close(final) {
        if (final) Object.assign(this.meta, final);
        this.meta.endedAt = Date.now();
        await this.flushMeta();
        if (this.handle) {
          await this.handle.close().catch(() => {
          });
          this.handle = null;
        }
      }
      async flushMeta() {
        try {
          await import_promises10.default.writeFile(this.metaPath, JSON.stringify(this.meta, null, 2) + "\n", "utf8");
        } catch {
        }
      }
    };
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode14 = __toESM(require("vscode"));

// src/chat/ChatViewProvider.ts
var vscode9 = __toESM(require("vscode"));

// src/runtime/EngineHost.ts
var vscode6 = __toESM(require("vscode"));

// ../src/agent/QueryEngine.ts
var import_node_crypto2 = require("node:crypto");

// ../src/utils/fileStateCache.ts
var import_node_crypto = require("node:crypto");
var import_promises = __toESM(require("node:fs/promises"), 1);
var FileStateCache = class {
  entries = /* @__PURE__ */ new Map();
  maxEntries;
  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }
  /** Called by the Read tool after a successful read. */
  async markRead(absPath, content) {
    try {
      const stat2 = await import_promises.default.stat(absPath);
      const sha1 = (0, import_node_crypto.createHash)("sha1").update(content).digest("hex");
      this.put(absPath, {
        mtimeMs: stat2.mtimeMs,
        size: stat2.size,
        sha1,
        readAt: Date.now()
      });
    } catch {
    }
  }
  /** Called by Edit/Write to check: did this file change since we last read it? */
  async isStale(absPath) {
    const cached = this.entries.get(absPath);
    if (!cached) return false;
    try {
      const stat2 = await import_promises.default.stat(absPath);
      if (stat2.mtimeMs === cached.mtimeMs && stat2.size === cached.size) {
        return false;
      }
      const content = await import_promises.default.readFile(absPath, "utf8");
      const sha1 = (0, import_node_crypto.createHash)("sha1").update(content).digest("hex");
      return sha1 !== cached.sha1;
    } catch {
      return true;
    }
  }
  /** Called by Write tool after overwrite. */
  async markWritten(absPath, content) {
    await this.markRead(absPath, content);
  }
  has(absPath) {
    return this.entries.has(absPath);
  }
  clear() {
    this.entries.clear();
  }
  put(key, entry) {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === void 0) break;
      this.entries.delete(oldest);
    }
  }
};

// ../src/services/sessionMemory/sessionMemory.ts
var fs2 = __toESM(require("node:fs/promises"), 1);
var path = __toESM(require("node:path"), 1);

// ../src/services/sessionMemory/sessionMemoryState.ts
var DEFAULT_SESSION_MEMORY_CONFIG = {
  minimumTokensToInit: 1e4,
  minimumTokensBetweenUpdate: 5e3,
  toolCallsBetweenUpdates: 3
};
var config = { ...DEFAULT_SESSION_MEMORY_CONFIG };
var lastSummarizedMessageId;
var extractionStartedAt;
var tokensAtLastExtraction = 0;
var initialized = false;
function hasMetInitThreshold(currentTokens) {
  return currentTokens >= config.minimumTokensToInit;
}
function hasMetUpdateThreshold(currentTokens) {
  return currentTokens - tokensAtLastExtraction >= config.minimumTokensBetweenUpdate;
}
function getToolCallsBetweenUpdates() {
  return config.toolCallsBetweenUpdates;
}
function isSessionMemoryInitialized() {
  return initialized;
}
function markSessionMemoryInitialized() {
  initialized = true;
}
function markExtractionStarted() {
  extractionStartedAt = Date.now();
}
function markExtractionCompleted() {
  extractionStartedAt = void 0;
}
function isExtractionInProgress() {
  if (!extractionStartedAt) return false;
  return Date.now() - extractionStartedAt < 6e4;
}
function recordExtractionTokenCount(tokens) {
  tokensAtLastExtraction = tokens;
}
function setLastSummarizedMessageId(id) {
  lastSummarizedMessageId = id;
}

// ../src/services/sessionMemory/sessionMemory.ts
function getSessionMemoryDir(cwd) {
  return path.join(cwd, ".reno");
}
function getSessionMemoryPath(cwd) {
  return path.join(cwd, ".reno", "session-memory.md");
}
function estimateTokens(messages) {
  let chars = 0;
  for (const msg2 of messages) {
    chars += (msg2.content ?? "").length;
    for (const tc of msg2.tool_calls ?? []) {
      chars += JSON.stringify(tc.function.arguments).length;
    }
  }
  return Math.ceil(chars / 4);
}
function countToolCallsSince(messages, sinceId) {
  let count = 0;
  let found = sinceId === void 0;
  for (const msg2 of messages) {
    if (!found) {
      if (msg2.tool_use_id === sinceId) found = true;
      continue;
    }
    if (msg2.tool_calls && msg2.tool_calls.length > 0) count += msg2.tool_calls.length;
  }
  return count;
}
var lastExtractionMessageId;
function shouldExtractSessionMemory(messages) {
  const tokens = estimateTokens(messages);
  if (!isSessionMemoryInitialized()) {
    if (!hasMetInitThreshold(tokens)) return false;
    markSessionMemoryInitialized();
  }
  const meetsTokenThreshold = hasMetUpdateThreshold(tokens);
  if (!meetsTokenThreshold) return false;
  const toolCalls = countToolCallsSince(messages, lastExtractionMessageId);
  const meetsToolCallThreshold = toolCalls >= getToolCallsBetweenUpdates();
  const lastMsg = messages[messages.length - 1];
  const lastHasToolCalls = lastMsg?.tool_calls != null && lastMsg.tool_calls.length > 0;
  return meetsToolCallThreshold || !lastHasToolCalls;
}
var TEMPLATE = `# Session Memory

This file is automatically maintained by reno to track the current session.
It is used to restore context after conversation compaction.

## Active Tasks

(none yet)

## Files Touched

(none yet)

## Key Decisions

(none yet)

## Errors / Blockers

(none yet)
`;
function buildExtractionPrompt(currentMemory, memoryPath, messages) {
  const recentMessages = messages.slice(-30).map((m) => {
    const role = m.role === "tool" ? "tool_result" : m.role;
    const body = (m.content ?? "").slice(0, 500);
    return `<${role}>${body}</${role}>`;
  }).join("\n");
  return [
    `You are a session memory extractor. Your job is to update the session memory file at:`,
    `  ${memoryPath}`,
    ``,
    `Current session memory:`,
    `<current_memory>`,
    currentMemory || "(empty)",
    `</current_memory>`,
    ``,
    `Recent conversation excerpt:`,
    `<recent_conversation>`,
    recentMessages,
    `</recent_conversation>`,
    ``,
    `Update the session memory file to reflect the current state of the conversation.`,
    `Keep it concise (under 1000 tokens). Maintain the existing sections.`,
    `Use the Edit tool to update: ${memoryPath}`
  ].join("\n");
}
function maybeExtractSessionMemory(messages, cwd, runExtraction) {
  if (isExtractionInProgress()) return;
  if (!shouldExtractSessionMemory(messages)) return;
  const lastMsg = messages[messages.length - 1];
  const capturedMsgId = lastMsg ? lastMsg.tool_use_id : void 0;
  markExtractionStarted();
  _doExtraction(messages, cwd, runExtraction, capturedMsgId).catch(() => {
    markExtractionCompleted();
  });
}
async function _doExtraction(messages, cwd, runExtraction, capturedMsgId) {
  try {
    const memoryDir = getSessionMemoryDir(cwd);
    const memoryPath = getSessionMemoryPath(cwd);
    await fs2.mkdir(memoryDir, { recursive: true, mode: 448 });
    let currentMemory = "";
    try {
      currentMemory = await fs2.readFile(memoryPath, "utf-8");
    } catch {
      await fs2.writeFile(memoryPath, TEMPLATE, { encoding: "utf-8", mode: 384 });
      currentMemory = TEMPLATE;
    }
    const prompt = buildExtractionPrompt(currentMemory, memoryPath, messages);
    await runExtraction(prompt, memoryPath);
    recordExtractionTokenCount(estimateTokens(messages));
    const lastMsg = messages[messages.length - 1];
    const hasToolCalls = lastMsg?.tool_calls != null && lastMsg.tool_calls.length > 0;
    if (!hasToolCalls && lastMsg) {
      setLastSummarizedMessageId(capturedMsgId ?? "");
      lastExtractionMessageId = capturedMsgId;
    }
  } finally {
    markExtractionCompleted();
  }
}
async function readSessionMemory(cwd) {
  const memoryPath = getSessionMemoryPath(cwd);
  try {
    return await fs2.readFile(memoryPath, "utf-8");
  } catch {
    return null;
  }
}

// ../src/agent/compact.ts
var SUMMARY_SYSTEM = "You are a conversation summarizer for a coding agent. Your output replaces a long tool-using transcript. Keep it under 800 tokens. Preserve: files read/edited (full paths), key decisions, command outcomes, outstanding TODOs, user preferences, errors encountered. Drop: boilerplate, duplicate tool invocations, verbose tool outputs (just note what was learned). Write as compact notes, not prose. Use bullet-like lines.";
async function compactMessages(messages, opts) {
  const keepTail = opts.keepTail ?? 4;
  if (messages.length === 0) {
    return { messages, droppedCount: 0, summary: "" };
  }
  const [system, ...rest] = messages;
  const tail = rest.slice(-keepTail);
  const older = rest.slice(0, Math.max(0, rest.length - keepTail));
  if (older.length === 0) {
    return { messages, droppedCount: 0, summary: "" };
  }
  const sessionMemory = await readSessionMemory(opts.cwd);
  if (sessionMemory) {
    const next2 = [
      system,
      { role: "user", content: `[Earlier conversation summary]
${sessionMemory.trim()}` },
      ...tail
    ];
    return {
      messages: next2,
      droppedCount: older.length,
      summaryTokens: 0,
      summary: "Used existing session memory file."
    };
  }
  if (!opts.provider || !opts.model) {
    throw new Error("Cannot run LLM compaction without provider and model");
  }
  const transcript = older.map((m) => {
    const role = m.role;
    let content = m.content || "";
    if (m.tool_calls && m.tool_calls.length) {
      const calls = m.tool_calls.map((c) => `${c.function.name}(${JSON.stringify(c.function.arguments)})`).join(", ");
      content = content ? `${content}
[tool_calls: ${calls}]` : `[tool_calls: ${calls}]`;
    }
    if (role === "tool" && content.length > 2e3) {
      content = content.slice(0, 2e3) + "\n\u2026[truncated]";
    }
    return `<<${role}>>
${content}`;
  }).join("\n\n");
  const focusNote = opts.focus ? `

SPECIAL INSTRUCTION: Preserve detail on this topic: ${opts.focus}` : "";
  const summarizerMessages = [
    { role: "system", content: SUMMARY_SYSTEM + focusNote },
    {
      role: "user",
      content: "Summarize this earlier conversation between a user and a coding agent:\n\n" + transcript
    }
  ];
  let summary = "";
  let completion = 0;
  for await (const chunk of opts.provider.streamChat({
    model: opts.model,
    messages: summarizerMessages
  })) {
    if (chunk.message?.content) {
      summary += chunk.message.content;
      opts.onProgress?.(chunk.message.content);
    }
    if (chunk.done && chunk.eval_count) completion = chunk.eval_count;
  }
  const next = [
    system,
    { role: "user", content: `[Earlier conversation summary]
${summary.trim()}` },
    ...tail
  ];
  return {
    messages: next,
    droppedCount: older.length,
    summaryTokens: completion || void 0,
    summary: summary.trim()
  };
}

// ../src/agent/snipCompact.ts
var SNIP_THRESHOLD = 4e3;
var MICROCOMPACT_THRESHOLD = 1500;
function snipToolOutputs(messages, opts) {
  const threshold = opts?.threshold ?? SNIP_THRESHOLD;
  const preserveTail = opts?.preserveTail ?? 4;
  let snippedCount = 0;
  const result = messages.map((msg2, i) => {
    if (msg2.role !== "tool") return msg2;
    if (i >= messages.length - preserveTail) return msg2;
    if (msg2.content.length <= threshold) return msg2;
    snippedCount++;
    const kept = msg2.content.slice(0, threshold);
    const droppedChars = msg2.content.length - threshold;
    return {
      ...msg2,
      content: kept + `

[...snipped ${droppedChars} characters]`
    };
  });
  return { messages: result, snippedCount };
}
function microcompactToolOutputs(messages, opts) {
  const threshold = opts?.threshold ?? MICROCOMPACT_THRESHOLD;
  const preserveTail = opts?.preserveTail ?? 4;
  let compactedCount = 0;
  const result = messages.map((msg2, i) => {
    if (msg2.role !== "tool") return msg2;
    if (i >= messages.length - preserveTail) return msg2;
    if (msg2.content.length <= threshold) return msg2;
    compactedCount++;
    const lines = msg2.content.split("\n");
    const firstLines = lines.slice(0, 5).join("\n");
    const lastLines = lines.slice(-3).join("\n");
    return {
      ...msg2,
      content: `${firstLines}

[...${lines.length - 8} lines omitted (${msg2.content.length} chars total)]

${lastLines}`
    };
  });
  return { messages: result, compactedCount };
}
function collapseReadSearchGroups(messages, opts) {
  const minGroupSize = opts?.minGroupSize ?? 3;
  const preserveTail = opts?.preserveTail ?? 6;
  const readToolNames = /* @__PURE__ */ new Set(["Read", "Grep", "Glob", "WebFetch", "WebSearch"]);
  const safeEnd = Math.max(0, messages.length - preserveTail);
  let collapsedGroups = 0;
  const result = [];
  let i = 0;
  while (i < messages.length) {
    if (i >= safeEnd) {
      result.push(messages[i]);
      i++;
      continue;
    }
    const groupStart = i;
    const groupTools = [];
    while (i < safeEnd && messages[i].role === "tool" && messages[i].tool_name && readToolNames.has(messages[i].tool_name)) {
      groupTools.push(messages[i].tool_name);
      i++;
    }
    if (groupTools.length >= minGroupSize) {
      collapsedGroups++;
      const toolCounts = /* @__PURE__ */ new Map();
      for (const t of groupTools) {
        toolCounts.set(t, (toolCounts.get(t) ?? 0) + 1);
      }
      const summary = Array.from(toolCounts.entries()).map(([name, count]) => `${name}\xD7${count}`).join(", ");
      result.push({
        role: "tool",
        tool_name: "system",
        content: `[Collapsed ${groupTools.length} read-only tool results: ${summary}]`
      });
    } else {
      for (let j2 = groupStart; j2 < i; j2++) {
        result.push(messages[j2]);
      }
      if (i === groupStart) {
        result.push(messages[i]);
        i++;
      }
    }
  }
  return { messages: result, collapsedGroups };
}
function estimateTokens2(messages) {
  let chars = 0;
  for (const msg2 of messages) {
    chars += msg2.content.length;
    if (msg2.tool_calls) {
      for (const tc of msg2.tool_calls) {
        chars += JSON.stringify(tc.function.arguments).length;
      }
    }
  }
  return Math.ceil(chars / 4);
}

// ../src/agent/context.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_os = __toESM(require("node:os"), 1);
var import_node_path = __toESM(require("node:path"), 1);

// ../node_modules/lodash-es/_freeGlobal.js
var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
var freeGlobal_default = freeGlobal;

// ../node_modules/lodash-es/_root.js
var freeSelf = typeof self == "object" && self && self.Object === Object && self;
var root = freeGlobal_default || freeSelf || Function("return this")();
var root_default = root;

// ../node_modules/lodash-es/_Symbol.js
var Symbol2 = root_default.Symbol;
var Symbol_default = Symbol2;

// ../node_modules/lodash-es/_getRawTag.js
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
var nativeObjectToString = objectProto.toString;
var symToStringTag = Symbol_default ? Symbol_default.toStringTag : void 0;
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
  try {
    value[symToStringTag] = void 0;
    var unmasked = true;
  } catch (e) {
  }
  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}
var getRawTag_default = getRawTag;

// ../node_modules/lodash-es/_objectToString.js
var objectProto2 = Object.prototype;
var nativeObjectToString2 = objectProto2.toString;
function objectToString(value) {
  return nativeObjectToString2.call(value);
}
var objectToString_default = objectToString;

// ../node_modules/lodash-es/_baseGetTag.js
var nullTag = "[object Null]";
var undefinedTag = "[object Undefined]";
var symToStringTag2 = Symbol_default ? Symbol_default.toStringTag : void 0;
function baseGetTag(value) {
  if (value == null) {
    return value === void 0 ? undefinedTag : nullTag;
  }
  return symToStringTag2 && symToStringTag2 in Object(value) ? getRawTag_default(value) : objectToString_default(value);
}
var baseGetTag_default = baseGetTag;

// ../node_modules/lodash-es/isObject.js
function isObject(value) {
  var type = typeof value;
  return value != null && (type == "object" || type == "function");
}
var isObject_default = isObject;

// ../node_modules/lodash-es/isFunction.js
var asyncTag = "[object AsyncFunction]";
var funcTag = "[object Function]";
var genTag = "[object GeneratorFunction]";
var proxyTag = "[object Proxy]";
function isFunction(value) {
  if (!isObject_default(value)) {
    return false;
  }
  var tag = baseGetTag_default(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}
var isFunction_default = isFunction;

// ../node_modules/lodash-es/_coreJsData.js
var coreJsData = root_default["__core-js_shared__"];
var coreJsData_default = coreJsData;

// ../node_modules/lodash-es/_isMasked.js
var maskSrcKey = function() {
  var uid = /[^.]+$/.exec(coreJsData_default && coreJsData_default.keys && coreJsData_default.keys.IE_PROTO || "");
  return uid ? "Symbol(src)_1." + uid : "";
}();
function isMasked(func) {
  return !!maskSrcKey && maskSrcKey in func;
}
var isMasked_default = isMasked;

// ../node_modules/lodash-es/_toSource.js
var funcProto = Function.prototype;
var funcToString = funcProto.toString;
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {
    }
    try {
      return func + "";
    } catch (e) {
    }
  }
  return "";
}
var toSource_default = toSource;

// ../node_modules/lodash-es/_baseIsNative.js
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
var reIsHostCtor = /^\[object .+?Constructor\]$/;
var funcProto2 = Function.prototype;
var objectProto3 = Object.prototype;
var funcToString2 = funcProto2.toString;
var hasOwnProperty2 = objectProto3.hasOwnProperty;
var reIsNative = RegExp(
  "^" + funcToString2.call(hasOwnProperty2).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
);
function baseIsNative(value) {
  if (!isObject_default(value) || isMasked_default(value)) {
    return false;
  }
  var pattern = isFunction_default(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource_default(value));
}
var baseIsNative_default = baseIsNative;

// ../node_modules/lodash-es/_getValue.js
function getValue(object, key) {
  return object == null ? void 0 : object[key];
}
var getValue_default = getValue;

// ../node_modules/lodash-es/_getNative.js
function getNative(object, key) {
  var value = getValue_default(object, key);
  return baseIsNative_default(value) ? value : void 0;
}
var getNative_default = getNative;

// ../node_modules/lodash-es/eq.js
function eq(value, other) {
  return value === other || value !== value && other !== other;
}
var eq_default = eq;

// ../node_modules/lodash-es/_nativeCreate.js
var nativeCreate = getNative_default(Object, "create");
var nativeCreate_default = nativeCreate;

// ../node_modules/lodash-es/_hashClear.js
function hashClear() {
  this.__data__ = nativeCreate_default ? nativeCreate_default(null) : {};
  this.size = 0;
}
var hashClear_default = hashClear;

// ../node_modules/lodash-es/_hashDelete.js
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}
var hashDelete_default = hashDelete;

// ../node_modules/lodash-es/_hashGet.js
var HASH_UNDEFINED = "__lodash_hash_undefined__";
var objectProto4 = Object.prototype;
var hasOwnProperty3 = objectProto4.hasOwnProperty;
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate_default) {
    var result = data[key];
    return result === HASH_UNDEFINED ? void 0 : result;
  }
  return hasOwnProperty3.call(data, key) ? data[key] : void 0;
}
var hashGet_default = hashGet;

// ../node_modules/lodash-es/_hashHas.js
var objectProto5 = Object.prototype;
var hasOwnProperty4 = objectProto5.hasOwnProperty;
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate_default ? data[key] !== void 0 : hasOwnProperty4.call(data, key);
}
var hashHas_default = hashHas;

// ../node_modules/lodash-es/_hashSet.js
var HASH_UNDEFINED2 = "__lodash_hash_undefined__";
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = nativeCreate_default && value === void 0 ? HASH_UNDEFINED2 : value;
  return this;
}
var hashSet_default = hashSet;

// ../node_modules/lodash-es/_Hash.js
function Hash(entries) {
  var index = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}
Hash.prototype.clear = hashClear_default;
Hash.prototype["delete"] = hashDelete_default;
Hash.prototype.get = hashGet_default;
Hash.prototype.has = hashHas_default;
Hash.prototype.set = hashSet_default;
var Hash_default = Hash;

// ../node_modules/lodash-es/_listCacheClear.js
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}
var listCacheClear_default = listCacheClear;

// ../node_modules/lodash-es/_assocIndexOf.js
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq_default(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}
var assocIndexOf_default = assocIndexOf;

// ../node_modules/lodash-es/_listCacheDelete.js
var arrayProto = Array.prototype;
var splice = arrayProto.splice;
function listCacheDelete(key) {
  var data = this.__data__, index = assocIndexOf_default(data, key);
  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  --this.size;
  return true;
}
var listCacheDelete_default = listCacheDelete;

// ../node_modules/lodash-es/_listCacheGet.js
function listCacheGet(key) {
  var data = this.__data__, index = assocIndexOf_default(data, key);
  return index < 0 ? void 0 : data[index][1];
}
var listCacheGet_default = listCacheGet;

// ../node_modules/lodash-es/_listCacheHas.js
function listCacheHas(key) {
  return assocIndexOf_default(this.__data__, key) > -1;
}
var listCacheHas_default = listCacheHas;

// ../node_modules/lodash-es/_listCacheSet.js
function listCacheSet(key, value) {
  var data = this.__data__, index = assocIndexOf_default(data, key);
  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}
var listCacheSet_default = listCacheSet;

// ../node_modules/lodash-es/_ListCache.js
function ListCache(entries) {
  var index = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}
ListCache.prototype.clear = listCacheClear_default;
ListCache.prototype["delete"] = listCacheDelete_default;
ListCache.prototype.get = listCacheGet_default;
ListCache.prototype.has = listCacheHas_default;
ListCache.prototype.set = listCacheSet_default;
var ListCache_default = ListCache;

// ../node_modules/lodash-es/_Map.js
var Map2 = getNative_default(root_default, "Map");
var Map_default = Map2;

// ../node_modules/lodash-es/_mapCacheClear.js
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    "hash": new Hash_default(),
    "map": new (Map_default || ListCache_default)(),
    "string": new Hash_default()
  };
}
var mapCacheClear_default = mapCacheClear;

// ../node_modules/lodash-es/_isKeyable.js
function isKeyable(value) {
  var type = typeof value;
  return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
}
var isKeyable_default = isKeyable;

// ../node_modules/lodash-es/_getMapData.js
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable_default(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
}
var getMapData_default = getMapData;

// ../node_modules/lodash-es/_mapCacheDelete.js
function mapCacheDelete(key) {
  var result = getMapData_default(this, key)["delete"](key);
  this.size -= result ? 1 : 0;
  return result;
}
var mapCacheDelete_default = mapCacheDelete;

// ../node_modules/lodash-es/_mapCacheGet.js
function mapCacheGet(key) {
  return getMapData_default(this, key).get(key);
}
var mapCacheGet_default = mapCacheGet;

// ../node_modules/lodash-es/_mapCacheHas.js
function mapCacheHas(key) {
  return getMapData_default(this, key).has(key);
}
var mapCacheHas_default = mapCacheHas;

// ../node_modules/lodash-es/_mapCacheSet.js
function mapCacheSet(key, value) {
  var data = getMapData_default(this, key), size = data.size;
  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}
var mapCacheSet_default = mapCacheSet;

// ../node_modules/lodash-es/_MapCache.js
function MapCache(entries) {
  var index = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}
MapCache.prototype.clear = mapCacheClear_default;
MapCache.prototype["delete"] = mapCacheDelete_default;
MapCache.prototype.get = mapCacheGet_default;
MapCache.prototype.has = mapCacheHas_default;
MapCache.prototype.set = mapCacheSet_default;
var MapCache_default = MapCache;

// ../node_modules/lodash-es/memoize.js
var FUNC_ERROR_TEXT = "Expected a function";
function memoize(func, resolver) {
  if (typeof func != "function" || resolver != null && typeof resolver != "function") {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var memoized = function() {
    var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache2 = memoized.cache;
    if (cache2.has(key)) {
      return cache2.get(key);
    }
    var result = func.apply(this, args);
    memoized.cache = cache2.set(key, result) || cache2;
    return result;
  };
  memoized.cache = new (memoize.Cache || MapCache_default)();
  return memoized;
}
memoize.Cache = MapCache_default;
var memoize_default = memoize;

// ../src/plugins/index.ts
init_hooks();
var promptSections = [];
function getPluginPromptSections() {
  return [...promptSections];
}

// ../src/utils/git.ts
var import_node_child_process = require("node:child_process");
var import_node_util = require("node:util");
var execAsync = (0, import_node_util.promisify)(import_node_child_process.exec);
async function findGitRoot(startPath) {
  try {
    const { stdout } = await execAsync("git rev-parse --show-toplevel", { cwd: startPath });
    return stdout.trim();
  } catch {
    return null;
  }
}
async function getBranch(cwd) {
  try {
    const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd });
    return stdout.trim();
  } catch {
    return "";
  }
}
async function getChangedFiles(cwd) {
  try {
    const { stdout } = await execAsync("git --no-optional-locks status --porcelain", { cwd });
    return stdout.trim().split("\n").map((line) => line.trim().split(" ", 2)[1]?.trim()).filter((line) => !!line);
  } catch {
    return [];
  }
}

// ../src/memdir/paths.ts
var path2 = __toESM(require("node:path"), 1);
function getAutoMemPath(cwd) {
  const renoDir2 = path2.join(cwd, ".reno");
  return path2.join(renoDir2, "memory");
}
function getAutoMemEntrypoint(cwd) {
  return path2.join(getAutoMemPath(cwd), "MEMORY.md");
}

// ../src/memdir/memoryTypes.ts
var MEMORY_TYPES = ["user", "feedback", "project", "reference"];
var TYPES_SECTION = [
  "## Types of memory",
  "",
  "There are several discrete types of memory that you can store in your memory system:",
  "",
  "<types>",
  "<type>",
  "    <name>user</name>",
  "    <description>Contain information about the user's role, goals, responsibilities, and knowledge. Great user memories help you tailor your future behavior to the user's preferences and perspective.</description>",
  "    <when_to_save>When you learn any details about the user's role, preferences, responsibilities, or knowledge</when_to_save>",
  "    <how_to_use>When your work should be informed by the user's profile or perspective.</how_to_use>",
  "    <examples>",
  "    user: I'm a data scientist investigating what logging we have in place",
  "    assistant: [saves user memory: user is a data scientist, currently focused on observability/logging]",
  "",
  "    user: I've been writing Go for ten years but this is my first time touching the React side of this repo",
  "    assistant: [saves user memory: deep Go expertise, new to React and this project's frontend \u2014 frame frontend explanations in terms of backend analogues]",
  "    </examples>",
  "</type>",
  "<type>",
  "    <name>feedback</name>",
  "    <description>Guidance the user has given you about how to approach work \u2014 both what to avoid and what to keep doing.</description>",
  "    <when_to_save>Any time the user corrects your approach or confirms a non-obvious approach worked. Include *why* so you can judge edge cases later.</when_to_save>",
  "    <how_to_use>Let these memories guide your behavior so that the user does not need to offer the same guidance twice.</how_to_use>",
  "    <body_structure>Lead with the rule itself, then a **Why:** line and a **How to apply:** line.</body_structure>",
  "    <examples>",
  "    user: don't mock the database in these tests \u2014 we got burned last quarter when mocked tests passed but the prod migration failed",
  "    assistant: [saves feedback memory: integration tests must hit a real database, not mocks. Reason: prior incident where mock/prod divergence masked a broken migration]",
  "    </examples>",
  "</type>",
  "<type>",
  "    <name>project</name>",
  "    <description>Information that you learn about ongoing work, goals, initiatives, bugs, or incidents within the project that is not otherwise derivable from the code or git history.</description>",
  "    <when_to_save>When you learn who is doing what, why, or by when. Convert relative dates to absolute dates when saving.</when_to_save>",
  "    <how_to_use>Use these memories to more fully understand the nuance behind the user's request and make better informed suggestions.</how_to_use>",
  "    <examples>",
  "    user: we're freezing all non-critical merges after Thursday \u2014 mobile team is cutting a release branch",
  "    assistant: [saves project memory: merge freeze begins 2026-03-05 for mobile release cut. Flag any non-critical PR work scheduled after that date]",
  "    </examples>",
  "</type>",
  "<type>",
  "    <name>reference</name>",
  "    <description>Stores pointers to where information can be found in external systems.</description>",
  "    <when_to_save>When you learn about resources in external systems and their purpose.</when_to_save>",
  "    <how_to_use>When the user references an external system or information that may be in an external system.</how_to_use>",
  "    <examples>",
  `    user: check the Linear project "INGEST" if you want context on these tickets, that's where we track all pipeline bugs`,
  '    assistant: [saves reference memory: pipeline bugs are tracked in Linear project "INGEST"]',
  "    </examples>",
  "</type>",
  "</types>",
  ""
];
var WHAT_NOT_TO_SAVE_SECTION = [
  "## What NOT to save in memory",
  "",
  "- Code patterns, conventions, architecture, file paths, or project structure \u2014 these can be derived by reading the current project state.",
  "- Git history, recent changes, or who-changed-what \u2014 `git log` / `git blame` are authoritative.",
  "- Debugging solutions or fix recipes \u2014 the fix is in the code; the commit message has the context.",
  "- Anything already documented in reno.md files.",
  "- Ephemeral task details: in-progress work, temporary state, current conversation context.",
  "",
  "These exclusions apply even when the user explicitly asks you to save. If they ask you to save a PR list or activity summary, ask what was *surprising* or *non-obvious* about it \u2014 that is the part worth keeping."
];
var WHEN_TO_ACCESS_SECTION = [
  "## When to access memories",
  "- When memories seem relevant, or the user references prior-conversation work.",
  "- You MUST access memory when the user explicitly asks you to check, recall, or remember.",
  "- If the user says to *ignore* or *not use* memory: proceed as if MEMORY.md were empty.",
  "- Memory records can become stale over time. Verify memory against current state before answering."
];
var TRUSTING_RECALL_SECTION = [
  "## Before recommending from memory",
  "",
  "A memory that names a specific function, file, or flag is a claim that it existed *when the memory was written*. Before recommending it:",
  "",
  "- If the memory names a file path: check the file exists.",
  "- If the memory names a function or flag: grep for it.",
  "- If the user is about to act on your recommendation, verify first.",
  "",
  '"The memory says X exists" is not the same as "X exists now."'
];
var MEMORY_FRONTMATTER_EXAMPLE = [
  "```markdown",
  "---",
  "name: {{memory name}}",
  "description: {{one-line description \u2014 used to decide relevance in future conversations, so be specific}}",
  `type: {{${MEMORY_TYPES.join(", ")}}}`,
  "---",
  "",
  "{{memory content \u2014 for feedback/project types, structure as: rule/fact, then **Why:** and **How to apply:** lines}}",
  "```"
];

// ../src/memdir/memdir.ts
var fs3 = __toESM(require("node:fs"), 1);
var ENTRYPOINT_NAME = "MEMORY.md";
var MAX_ENTRYPOINT_LINES = 200;
var MAX_ENTRYPOINT_BYTES = 25e3;
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
function truncateEntrypointContent(raw) {
  const trimmed = raw.trim();
  const contentLines = trimmed.split("\n");
  const lineCount = contentLines.length;
  const byteCount = trimmed.length;
  const wasLineTruncated = lineCount > MAX_ENTRYPOINT_LINES;
  const wasByteTruncated = byteCount > MAX_ENTRYPOINT_BYTES;
  if (!wasLineTruncated && !wasByteTruncated) {
    return {
      content: trimmed,
      lineCount,
      byteCount,
      wasLineTruncated,
      wasByteTruncated
    };
  }
  let truncated = wasLineTruncated ? contentLines.slice(0, MAX_ENTRYPOINT_LINES).join("\n") : trimmed;
  if (truncated.length > MAX_ENTRYPOINT_BYTES) {
    const cutAt = truncated.lastIndexOf("\n", MAX_ENTRYPOINT_BYTES);
    truncated = truncated.slice(0, cutAt > 0 ? cutAt : MAX_ENTRYPOINT_BYTES);
  }
  const reason = wasByteTruncated && !wasLineTruncated ? `${formatFileSize(byteCount)} (limit: ${formatFileSize(MAX_ENTRYPOINT_BYTES)}) \u2014 index entries are too long` : wasLineTruncated && !wasByteTruncated ? `${lineCount} lines (limit: ${MAX_ENTRYPOINT_LINES})` : `${lineCount} lines and ${formatFileSize(byteCount)}`;
  return {
    content: truncated + `

> WARNING: ${ENTRYPOINT_NAME} is ${reason}. Only part of it was loaded. Keep index entries to one line under ~200 chars; move detail into topic files.`,
    lineCount,
    byteCount,
    wasLineTruncated,
    wasByteTruncated
  };
}
function buildMemoryLines(memoryDir) {
  const howToSave = [
    "## How to save memories",
    "",
    "Saving a memory is a two-step process:",
    "",
    "**Step 1** \u2014 write the memory to its own file (e.g., `user_role.md`, `feedback_testing.md`) using this frontmatter format:",
    "",
    ...MEMORY_FRONTMATTER_EXAMPLE,
    "",
    `**Step 2** \u2014 add a pointer to that file in \`${ENTRYPOINT_NAME}\`. \`${ENTRYPOINT_NAME}\` is an index, not a memory \u2014 each entry should be one line, under ~150 characters: \`- [Title](file.md) \u2014 one-line hook\`. It has no frontmatter. Never write memory content directly into \`${ENTRYPOINT_NAME}\`.`,
    "",
    `- \`${ENTRYPOINT_NAME}\` is always loaded into your conversation context \u2014 lines after ${MAX_ENTRYPOINT_LINES} will be truncated, so keep the index concise`,
    "- Keep the name, description, and type fields in memory files up-to-date with the content",
    "- Organize memory semantically by topic, not chronologically",
    "- Update or remove memories that turn out to be wrong or outdated",
    "- Do not write duplicate memories. First check if there is an existing memory you can update before writing a new one."
  ];
  const lines = [
    `# auto memory`,
    "",
    `You have a persistent, file-based memory system at \`${memoryDir}\`. This directory already exists \u2014 write to it directly with the Write tool (do not run mkdir or check for its existence).`,
    "",
    "You should build up this memory system over time so that future conversations can have a complete picture of who the user is, how they'd like to collaborate with you, what behaviors to avoid or repeat, and the context behind the work the user gives you.",
    "",
    "If the user explicitly asks you to remember something, save it immediately as whichever type fits best. If they ask you to forget something, find and remove the relevant entry.",
    "",
    ...TYPES_SECTION,
    ...WHAT_NOT_TO_SAVE_SECTION,
    "",
    ...howToSave,
    "",
    ...WHEN_TO_ACCESS_SECTION,
    "",
    ...TRUSTING_RECALL_SECTION,
    ""
  ];
  return lines;
}
function loadMemoryPrompt(cwd) {
  const memoryDir = getAutoMemPath(cwd);
  const entrypoint = getAutoMemEntrypoint(cwd);
  let entrypointContent = "";
  try {
    if (fs3.existsSync(entrypoint)) {
      entrypointContent = fs3.readFileSync(entrypoint, "utf8");
    }
  } catch {
  }
  const lines = buildMemoryLines(memoryDir);
  if (entrypointContent.trim()) {
    const t = truncateEntrypointContent(entrypointContent);
    lines.push(`## ${ENTRYPOINT_NAME}`, "", t.content);
  } else {
    lines.push(
      `## ${ENTRYPOINT_NAME}`,
      "",
      `Your ${ENTRYPOINT_NAME} is currently empty. When you save new memories, they will appear here.`
    );
  }
  return lines.join("\n");
}

// ../src/memdir/memoryAge.ts
function memoryAgeDays(mtimeMs) {
  return Math.max(0, Math.floor((Date.now() - mtimeMs) / 864e5));
}
function memoryAge(mtimeMs) {
  const d = memoryAgeDays(mtimeMs);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

// ../src/memdir/memoryScan.ts
var fs4 = __toESM(require("node:fs/promises"), 1);
var path3 = __toESM(require("node:path"), 1);
var MAX_MEMORY_FILES = 200;
function parseFrontmatter(content) {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return {};
  const end = trimmed.indexOf("---", 3);
  if (end === -1) return {};
  const block = trimmed.slice(3, end);
  const result = {};
  for (const line of block.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
    if (key === "name") result.name = value;
    else if (key === "description") result.description = value;
    else if (key === "type") result.type = value;
  }
  return result;
}
function parseMemoryType(raw) {
  if (!raw) return void 0;
  return MEMORY_TYPES.includes(raw) ? raw : void 0;
}
async function scanMemoryFiles(memoryDir) {
  try {
    const entries = await fs4.readdir(memoryDir, { recursive: true });
    const mdFiles = entries.filter(
      (f) => f.endsWith(".md") && path3.basename(f) !== "MEMORY.md"
    );
    const results = await Promise.allSettled(
      mdFiles.map(async (relative) => {
        const filePath = path3.join(memoryDir, relative);
        const stat2 = await fs4.stat(filePath);
        const handle = await fs4.open(filePath, "r");
        let content = "";
        try {
          const buf = Buffer.alloc(2048);
          const { bytesRead } = await handle.read(buf, 0, 2048, 0);
          content = buf.slice(0, bytesRead).toString("utf-8");
        } finally {
          await handle.close();
        }
        const fm = parseFrontmatter(content);
        return {
          filename: relative,
          filePath,
          mtimeMs: stat2.mtimeMs,
          description: fm.description ?? null,
          type: parseMemoryType(fm.type),
          name: fm.name ?? null
        };
      })
    );
    return results.filter(
      (r) => r.status === "fulfilled"
    ).map((r) => r.value).sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, MAX_MEMORY_FILES);
  } catch {
    return [];
  }
}
function formatMemoryManifest(memories) {
  if (memories.length === 0) return "(no memory files)";
  return memories.map((m) => {
    const tag = m.type ? `[${m.type}] ` : "";
    const age = memoryAge(m.mtimeMs);
    const label = m.name ?? m.filename;
    return m.description ? `- ${tag}${label} (${age}): ${m.description}` : `- ${tag}${label} (${age})`;
  }).join("\n");
}

// ../src/agent/systemPromptSections.ts
var sectionCache = /* @__PURE__ */ new Map();
function systemPromptSection(name, compute) {
  return { name, compute, cacheBreak: false };
}
function DANGEROUS_uncachedSystemPromptSection(name, compute, _reason) {
  return { name, compute, cacheBreak: true };
}
async function resolveSystemPromptSections(sections, cacheKeyPrefix = "") {
  return Promise.all(
    sections.map(async (s) => {
      const key = `${cacheKeyPrefix}::${s.name}`;
      if (!s.cacheBreak && sectionCache.has(key)) {
        return sectionCache.get(key) ?? null;
      }
      const value = await s.compute();
      sectionCache.set(key, value);
      return value;
    })
  );
}

// ../src/agent/context.ts
var SYSTEM_PROMPT_DYNAMIC_BOUNDARY = "====== DYNAMIC BOUNDARY ======";
function readFileSafe(filePath) {
  try {
    if (import_node_fs.default.existsSync(filePath)) {
      return import_node_fs.default.readFileSync(filePath, "utf-8").trim();
    }
  } catch {
  }
  return null;
}
async function loadProjectMemory(cwd) {
  const sources = [];
  const gitRoot = await findGitRoot(cwd) || cwd;
  const dirs = [];
  let currentDir = cwd;
  while (currentDir.length >= gitRoot.length && currentDir.startsWith(gitRoot)) {
    dirs.unshift(currentDir);
    const parent = import_node_path.default.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  const userPath = import_node_path.default.join(import_node_os.default.homedir(), ".reno", "reno.md");
  const userContent = readFileSafe(userPath);
  if (userContent) sources.push({ path: userPath, content: userContent, scope: "user" });
  for (const dir of dirs) {
    const legacyPath = import_node_path.default.join(dir, "reno.md");
    const legacyContent = readFileSafe(legacyPath);
    if (legacyContent) sources.push({ path: legacyPath, content: legacyContent, scope: "project" });
    const projectPath = import_node_path.default.join(dir, ".reno", "reno.md");
    const projectContent = readFileSafe(projectPath);
    if (projectContent) sources.push({ path: projectPath, content: projectContent, scope: "project" });
    const rulesDir = import_node_path.default.join(dir, ".reno", "rules");
    try {
      if (import_node_fs.default.existsSync(rulesDir)) {
        const files = import_node_fs.default.readdirSync(rulesDir);
        for (const file of files) {
          if (file.endsWith(".md")) {
            const rulePath = import_node_path.default.join(rulesDir, file);
            const ruleContent = readFileSafe(rulePath);
            if (ruleContent) sources.push({ path: rulePath, content: ruleContent, scope: "project" });
          }
        }
      }
    } catch {
    }
  }
  const localPath = import_node_path.default.join(cwd, ".reno", "reno.local.md");
  const localContent = readFileSafe(localPath);
  if (localContent) sources.push({ path: localPath, content: localContent, scope: "local" });
  return sources;
}
function formatMemorySources(sources) {
  if (sources.length === 0) return "";
  return sources.map((s) => `--- From ${s.path} ---
${s.content}`).join("\n\n");
}
function getKnowledgeCutoff(modelId) {
  const id = modelId.toLowerCase();
  if (id.includes("gemini-2.5") || id.includes("gemini-2-5")) return "January 2025";
  if (id.includes("gemini-2.0") || id.includes("gemini-2-0")) return "August 2024";
  if (id.includes("gemini-1.5") || id.includes("gemini-1-5")) return "January 2024";
  if (id.includes("claude-opus-4") || id.includes("claude-sonnet-4")) return "March 2025";
  if (id.includes("claude-haiku-4")) return "February 2025";
  if (id.includes("claude-3-7") || id.includes("claude-3.7")) return "October 2024";
  if (id.includes("claude-3-5-sonnet") || id.includes("claude-3.5-sonnet")) return "April 2024";
  if (id.includes("claude-3-5")) return "April 2024";
  if (id.includes("claude-3")) return "August 2023";
  return null;
}
function isGitWorktree(cwd) {
  try {
    const gitPath = import_node_path.default.join(cwd, ".git");
    if (import_node_fs.default.existsSync(gitPath)) {
      return import_node_fs.default.statSync(gitPath).isFile();
    }
    const parent = import_node_path.default.dirname(cwd);
    if (parent !== cwd) return isGitWorktree(parent);
  } catch {
  }
  return false;
}
var getSystemContext = memoize_default(async (cwd) => {
  const branch = await getBranch(cwd);
  const isGit = !!branch;
  const statusLines = isGit ? await getChangedFiles(cwd) : [];
  const parts = [
    `cwd: ${cwd}`,
    `platform: ${import_node_os.default.platform()} (${import_node_os.default.release()})`,
    `shell: ${process.env.SHELL ?? (process.platform === "win32" ? "powershell" : "/bin/sh")}${process.platform === "win32" ? " (use PowerShell syntax, not Unix \u2014 e.g., $null not /dev/null, $env:VAR not $VAR, backtick for line continuation)" : ""}`,
    `git: ${isGit ? `yes, branch=${branch}` : "not a git repo"}`
  ];
  if (statusLines.length > 0) {
    const lines = statusLines.slice(0, 30);
    parts.push("git status (changed files, top 30):");
    parts.push(lines.map((l) => "  " + l).join("\n"));
  }
  return parts.join("\n");
});
var getUserContext = memoize_default(async (cwd) => {
  const sources = await loadProjectMemory(cwd);
  return formatMemorySources(sources);
});
var STATIC_PROMPT = `You are reno, a terminal-based AI coding assistant. You help users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges, and educational contexts. Refuse requests for destructive techniques, DoS attacks, mass targeting, supply chain compromise, or detection evasion for malicious purposes. Dual-use security tools (C2 frameworks, credential testing, exploit development) require clear authorization context: pentesting engagements, CTF competitions, security research, or defensive use cases.

# Tone and style
 - Only use emojis if the user explicitly requests it. Avoid using emojis in all communication unless asked.
 - Your responses should be short and concise.
 - When referencing specific functions or pieces of code include the pattern file_path:line_number to allow the user to easily navigate to the source code location.
 - When referencing GitHub issues or pull requests, use the owner/repo#123 format (e.g. owner/repo#100) so they render as clickable links.
 - Do not use a colon before tool calls. Your tool calls may not be shown directly in the output, so text like "Let me read the file:" followed by a read tool call should just be "Let me read the file." with a period.

# Output efficiency
IMPORTANT: Go straight to the point. Try the simplest approach first without going in circles. Do not overdo it. Be extra concise.

Keep your text output brief and direct. Lead with the answer or action, not the reasoning. Skip filler words, preamble, and unnecessary transitions. Do not restate what the user said \u2014 just do it. When explaining, include only what is necessary for the user to understand.

Focus text output on:
 - Decisions that need the user's input
 - High-level status updates at natural milestones
 - Errors or blockers that change the plan

If you can say it in one sentence, don't use three. Prefer short, direct sentences over long explanations. This does not apply to code or tool calls.

When working with tool results, write down any important information you might need later in your response, as the original tool result may be cleared later.`;
async function buildSystemPromptSections(cwd, model, tokenBudget, mcpClients, language, additionalWorkingDirectories) {
  const sections = [
    systemPromptSection("core", () => STATIC_PROMPT),
    // --- Language ---
    systemPromptSection("language", () => {
      if (!language) return null;
      return "# Language\nAlways respond in " + language + ". Use " + language + " for all explanations, comments, and communications with the user. Technical terms and code identifiers should remain in their original form.";
    }),
    // --- Environment (Static parts) ---
    systemPromptSection("env_static", async () => {
      const sysCtx = await getSystemContext(cwd);
      const worktree = isGitWorktree(cwd);
      let envSection = "# Environment\nYou have been invoked in the following environment:\n" + sysCtx;
      if (worktree) {
        envSection += "\n - This is a git worktree \u2014 an isolated copy of the repository. Run all commands from this directory. Do NOT `cd` to the original repository root.";
      }
      if (additionalWorkingDirectories && additionalWorkingDirectories.length > 0) {
        envSection += "\n - Additional working directories:";
        for (const dir of additionalWorkingDirectories) {
          envSection += "\n   - " + dir;
        }
      }
      if (model) {
        envSection += "\n - You are powered by the model " + model + ".";
        const cutoff = getKnowledgeCutoff(model);
        if (cutoff) {
          envSection += "\n - Assistant knowledge cutoff is " + cutoff + ".";
        }
      }
      return envSection;
    }),
    // --- Auto Memory (Phase 10) ---
    systemPromptSection("auto_memory", () => {
      return loadMemoryPrompt(cwd) || null;
    }),
    // --- User Context (reno.md files) ---
    systemPromptSection("user_context", async () => {
      const uCtx = await getUserContext(cwd);
      if (uCtx) {
        return "# Project Instructions\n\n" + uCtx;
      }
      return null;
    }),
    // --- Memory File Manifest (Phase 23) ---
    systemPromptSection("memory_manifest", async () => {
      try {
        const memDir = getAutoMemPath(cwd);
        const memHeaders = await scanMemoryFiles(memDir);
        if (memHeaders.length > 0) {
          const manifest = formatMemoryManifest(memHeaders);
          return "## Memory Index\n\n" + manifest;
        }
      } catch {
      }
      return null;
    }),
    // --- Plugin prompt sections (Phase 4.1) ---
    systemPromptSection("plugins", () => {
      try {
        const pluginSections = getPluginPromptSections();
        if (pluginSections.length === 0) return null;
        let prompt = "";
        for (const section of pluginSections) {
          prompt += "# " + section.title + "\n\n" + section.content + "\n\n";
        }
        return prompt.trim();
      } catch {
        return null;
      }
    }),
    // --- MCP Server Instructions ---
    systemPromptSection("mcp_instructions", () => {
      if (mcpClients && mcpClients.length > 0) {
        const withInstructions = mcpClients.filter((c) => c.instructions?.trim());
        if (withInstructions.length > 0) {
          const blocks = withInstructions.map((c) => "## " + c.name + "\n" + c.instructions).join("\n\n");
          return "# MCP Server Instructions\n\nThe following MCP servers have provided instructions for how to use their tools and resources:\n\n" + blocks;
        }
      }
      return null;
    }),
    // ==========================================
    // DYNAMIC SECTION BOUNDARY (Recomputed per-turn)
    // ==========================================
    systemPromptSection("dynamic_boundary", () => SYSTEM_PROMPT_DYNAMIC_BOUNDARY),
    // --- Dynamic Time/Date ---
    DANGEROUS_uncachedSystemPromptSection("current_time", () => {
      return "date: " + (/* @__PURE__ */ new Date()).toISOString().split("T")[0] + "\ntime: " + (/* @__PURE__ */ new Date()).toLocaleTimeString();
    }, "Time changes every turn"),
    // --- Session Memory (Next Day Resume) ---
    DANGEROUS_uncachedSystemPromptSection("session_memory", async () => {
      const mem = await readSessionMemory(cwd);
      if (!mem) return null;
      return "# Previous Session Memory\n" + mem;
    }, "Session memory updates constantly in the background"),
    // --- Token Budget (Phase 26) ---
    DANGEROUS_uncachedSystemPromptSection("token_budget", () => {
      if (tokenBudget && tokenBudget.limit > 0) {
        const ratio = tokenBudget.used / tokenBudget.limit;
        const remaining = tokenBudget.limit - tokenBudget.used;
        const pct = Math.round(ratio * 100);
        if (ratio >= 0.7) {
          const urgency = ratio >= 0.9 ? "CRITICAL" : ratio >= 0.8 ? "WARNING" : "NOTICE";
          return [
            "<token_budget>",
            "<used>" + tokenBudget.used + "</used>",
            "<limit>" + tokenBudget.limit + "</limit>",
            "<remaining>" + remaining + "</remaining>",
            "<percentage_used>" + pct + "%</percentage_used>",
            "<urgency>" + urgency + "</urgency>",
            urgency === "CRITICAL" ? "You have used " + pct + "% of the context window. STOP expanding the task. Wrap up your current action, write a handoff summary in your final response, and use /compact if you need to continue." : urgency === "WARNING" ? "You have used " + pct + "% of the context window. Be concise. Avoid large tool outputs. Consider compacting soon." : "You have used " + pct + "% of the context window. Be mindful of output length.",
            "</token_budget>"
          ].join("\n");
        }
      }
      return null;
    }, "Token budget changes every turn")
  ];
  const resolved = await resolveSystemPromptSections(sections, cwd);
  return resolved.filter((r) => r !== null && r !== "");
}

// ../src/agent/contextApi.ts
function splitSysPromptPrefix(systemPrompt) {
  const boundaryIndex = systemPrompt.findIndex(
    (s) => s === SYSTEM_PROMPT_DYNAMIC_BOUNDARY
  );
  if (boundaryIndex !== -1) {
    const staticBlocks = [];
    const dynamicBlocks = [];
    for (let i = 0; i < systemPrompt.length; i++) {
      const block = systemPrompt[i];
      if (!block || block === SYSTEM_PROMPT_DYNAMIC_BOUNDARY) continue;
      if (i < boundaryIndex) {
        staticBlocks.push(block);
      } else {
        dynamicBlocks.push(block);
      }
    }
    const result = [];
    const staticJoined = staticBlocks.join("\n\n");
    if (staticJoined) {
      result.push({ text: staticJoined, cacheScope: "global" });
    }
    const dynamicJoined = dynamicBlocks.join("\n\n");
    if (dynamicJoined) {
      result.push({ text: dynamicJoined, cacheScope: null });
    }
    return result;
  }
  const restJoined = systemPrompt.filter(Boolean).join("\n\n");
  return restJoined ? [{ text: restJoined, cacheScope: "org" }] : [];
}

// ../src/utils/retry.ts
function classifyApiError(error) {
  if (!(error instanceof Error)) return "unknown";
  const msg2 = error.message.toLowerCase();
  if (msg2.includes("429") || msg2.includes("rate limit") || msg2.includes("too many requests")) {
    return "rate_limit";
  }
  if (msg2.includes("prompt is too long") || msg2.includes("context length") || msg2.includes("maximum context") || msg2.includes("too long") || msg2.includes("token limit")) {
    return "prompt_too_long";
  }
  if (msg2.includes("401") || msg2.includes("403") || msg2.includes("unauthorized") || msg2.includes("forbidden")) {
    return "auth";
  }
  if (msg2.includes("500") || msg2.includes("502") || msg2.includes("503") || msg2.includes("504") || msg2.includes("internal server error")) {
    return "server";
  }
  if (msg2.includes("fetch") || msg2.includes("econnrefused") || msg2.includes("econnreset") || msg2.includes("etimedout") || msg2.includes("network") || msg2.includes("socket")) {
    return "network";
  }
  return "unknown";
}
function isDefaultRetryable(error) {
  const kind = classifyApiError(error);
  return kind === "rate_limit" || kind === "network" || kind === "server";
}
function sleep(ms, signal) {
  return new Promise((resolve2, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const timer = setTimeout(resolve2, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    }, { once: true });
  });
}
async function withRetry(fn, opts = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 1e3,
    maxDelayMs = 3e4,
    jitter = 0.3,
    signal,
    onRetry,
    isRetryable = isDefaultRetryable
  } = opts;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (attempt >= maxAttempts) throw error;
      if (!isRetryable(error)) throw error;
      const exponential = baseDelayMs * Math.pow(2, attempt - 1);
      const jitterMs = exponential * jitter * Math.random();
      const delayMs = Math.min(exponential + jitterMs, maxDelayMs);
      onRetry?.(error, attempt, delayMs);
      await sleep(delayMs, signal);
    }
  }
  throw lastError;
}

// ../src/utils/messageQueueManager.ts
var commandQueue = [];
var snapshot = Object.freeze([]);
var subscribers = /* @__PURE__ */ new Set();
function notifySubscribers() {
  snapshot = Object.freeze([...commandQueue]);
  for (const cb of subscribers) cb();
}
function dequeueAll() {
  if (commandQueue.length === 0) return [];
  const commands9 = [...commandQueue];
  commandQueue.length = 0;
  notifySubscribers();
  return commands9;
}

// ../node_modules/lru-cache/dist/esm/node/index.min.js
var import_node_diagnostics_channel = require("node:diagnostics_channel");
var S = (0, import_node_diagnostics_channel.channel)("lru-cache:metrics");
var W = (0, import_node_diagnostics_channel.tracingChannel)("lru-cache");
var C = typeof performance == "object" && performance && typeof performance.now == "function" ? performance : Date;
var D = () => S.hasSubscribers || W.hasSubscribers;
var U = /* @__PURE__ */ new Set();
var L = typeof process == "object" && process ? process : {};
var P = (u3, e, t, i) => {
  typeof L.emitWarning == "function" ? L.emitWarning(u3, e, t, i) : console.error(`[${t}] ${e}: ${u3}`);
};
var H = (u3) => !U.has(u3);
var X = Symbol("type");
var F = (u3) => !!u3 && u3 === Math.floor(u3) && u3 > 0 && isFinite(u3);
var j = (u3) => F(u3) ? u3 <= Math.pow(2, 8) ? Uint8Array : u3 <= Math.pow(2, 16) ? Uint16Array : u3 <= Math.pow(2, 32) ? Uint32Array : u3 <= Number.MAX_SAFE_INTEGER ? O : null : null;
var O = class extends Array {
  constructor(e) {
    super(e), this.fill(0);
  }
};
var R = class u {
  heap;
  length;
  static #o = false;
  static create(e) {
    let t = j(e);
    if (!t) return [];
    u.#o = true;
    let i = new u(e, t);
    return u.#o = false, i;
  }
  constructor(e, t) {
    if (!u.#o) throw new TypeError("instantiate Stack using Stack.create(n)");
    this.heap = new t(e), this.length = 0;
  }
  push(e) {
    this.heap[this.length++] = e;
  }
  pop() {
    return this.heap[--this.length];
  }
};
var M = class u2 {
  #o;
  #u;
  #w;
  #x;
  #S;
  #M;
  #U;
  #m;
  get perf() {
    return this.#m;
  }
  ttl;
  ttlResolution;
  ttlAutopurge;
  updateAgeOnGet;
  updateAgeOnHas;
  allowStale;
  noDisposeOnSet;
  noUpdateTTL;
  maxEntrySize;
  sizeCalculation;
  noDeleteOnFetchRejection;
  noDeleteOnStaleGet;
  allowStaleOnFetchAbort;
  allowStaleOnFetchRejection;
  ignoreFetchAbort;
  #n;
  #b;
  #s;
  #i;
  #t;
  #a;
  #c;
  #l;
  #h;
  #y;
  #r;
  #_;
  #F;
  #d;
  #g;
  #T;
  #W;
  #f;
  #j;
  static unsafeExposeInternals(e) {
    return { starts: e.#F, ttls: e.#d, autopurgeTimers: e.#g, sizes: e.#_, keyMap: e.#s, keyList: e.#i, valList: e.#t, next: e.#a, prev: e.#c, get head() {
      return e.#l;
    }, get tail() {
      return e.#h;
    }, free: e.#y, isBackgroundFetch: (t) => e.#e(t), backgroundFetch: (t, i, s, n) => e.#P(t, i, s, n), moveToTail: (t) => e.#L(t), indexes: (t) => e.#A(t), rindexes: (t) => e.#z(t), isStale: (t) => e.#p(t) };
  }
  get max() {
    return this.#o;
  }
  get maxSize() {
    return this.#u;
  }
  get calculatedSize() {
    return this.#b;
  }
  get size() {
    return this.#n;
  }
  get fetchMethod() {
    return this.#M;
  }
  get memoMethod() {
    return this.#U;
  }
  get dispose() {
    return this.#w;
  }
  get onInsert() {
    return this.#x;
  }
  get disposeAfter() {
    return this.#S;
  }
  constructor(e) {
    let { max: t = 0, ttl: i, ttlResolution: s = 1, ttlAutopurge: n, updateAgeOnGet: o, updateAgeOnHas: r, allowStale: h, dispose: l, onInsert: c, disposeAfter: f, noDisposeOnSet: g, noUpdateTTL: p, maxSize: T = 0, maxEntrySize: w = 0, sizeCalculation: y, fetchMethod: a, memoMethod: m, noDeleteOnFetchRejection: _, noDeleteOnStaleGet: b, allowStaleOnFetchRejection: d, allowStaleOnFetchAbort: A, ignoreFetchAbort: z, perf: x } = e;
    if (x !== void 0 && typeof x?.now != "function") throw new TypeError("perf option must have a now() method if specified");
    if (this.#m = x ?? C, t !== 0 && !F(t)) throw new TypeError("max option must be a nonnegative integer");
    let v = t ? j(t) : Array;
    if (!v) throw new Error("invalid max value: " + t);
    if (this.#o = t, this.#u = T, this.maxEntrySize = w || this.#u, this.sizeCalculation = y, this.sizeCalculation) {
      if (!this.#u && !this.maxEntrySize) throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize");
      if (typeof this.sizeCalculation != "function") throw new TypeError("sizeCalculation set to non-function");
    }
    if (m !== void 0 && typeof m != "function") throw new TypeError("memoMethod must be a function if defined");
    if (this.#U = m, a !== void 0 && typeof a != "function") throw new TypeError("fetchMethod must be a function if specified");
    if (this.#M = a, this.#W = !!a, this.#s = /* @__PURE__ */ new Map(), this.#i = Array.from({ length: t }).fill(void 0), this.#t = Array.from({ length: t }).fill(void 0), this.#a = new v(t), this.#c = new v(t), this.#l = 0, this.#h = 0, this.#y = R.create(t), this.#n = 0, this.#b = 0, typeof l == "function" && (this.#w = l), typeof c == "function" && (this.#x = c), typeof f == "function" ? (this.#S = f, this.#r = []) : (this.#S = void 0, this.#r = void 0), this.#T = !!this.#w, this.#j = !!this.#x, this.#f = !!this.#S, this.noDisposeOnSet = !!g, this.noUpdateTTL = !!p, this.noDeleteOnFetchRejection = !!_, this.allowStaleOnFetchRejection = !!d, this.allowStaleOnFetchAbort = !!A, this.ignoreFetchAbort = !!z, this.maxEntrySize !== 0) {
      if (this.#u !== 0 && !F(this.#u)) throw new TypeError("maxSize must be a positive integer if specified");
      if (!F(this.maxEntrySize)) throw new TypeError("maxEntrySize must be a positive integer if specified");
      this.#X();
    }
    if (this.allowStale = !!h, this.noDeleteOnStaleGet = !!b, this.updateAgeOnGet = !!o, this.updateAgeOnHas = !!r, this.ttlResolution = F(s) || s === 0 ? s : 1, this.ttlAutopurge = !!n, this.ttl = i || 0, this.ttl) {
      if (!F(this.ttl)) throw new TypeError("ttl must be a positive integer if specified");
      this.#H();
    }
    if (this.#o === 0 && this.ttl === 0 && this.#u === 0) throw new TypeError("At least one of max, maxSize, or ttl is required");
    if (!this.ttlAutopurge && !this.#o && !this.#u) {
      let E = "LRU_CACHE_UNBOUNDED";
      H(E) && (U.add(E), P("TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.", "UnboundedCacheWarning", E, u2));
    }
  }
  getRemainingTTL(e) {
    return this.#s.has(e) ? 1 / 0 : 0;
  }
  #H() {
    let e = new O(this.#o), t = new O(this.#o);
    this.#d = e, this.#F = t;
    let i = this.ttlAutopurge ? Array.from({ length: this.#o }) : void 0;
    this.#g = i, this.#N = (r, h, l = this.#m.now()) => {
      t[r] = h !== 0 ? l : 0, e[r] = h, s(r, h);
    }, this.#D = (r) => {
      t[r] = e[r] !== 0 ? this.#m.now() : 0, s(r, e[r]);
    };
    let s = this.ttlAutopurge ? (r, h) => {
      if (i?.[r] && (clearTimeout(i[r]), i[r] = void 0), h && h !== 0 && i) {
        let l = setTimeout(() => {
          this.#p(r) && this.#v(this.#i[r], "expire");
        }, h + 1);
        l.unref && l.unref(), i[r] = l;
      }
    } : () => {
    };
    this.#E = (r, h) => {
      if (e[h]) {
        let l = e[h], c = t[h];
        if (!l || !c) return;
        r.ttl = l, r.start = c, r.now = n || o();
        let f = r.now - c;
        r.remainingTTL = l - f;
      }
    };
    let n = 0, o = () => {
      let r = this.#m.now();
      if (this.ttlResolution > 0) {
        n = r;
        let h = setTimeout(() => n = 0, this.ttlResolution);
        h.unref && h.unref();
      }
      return r;
    };
    this.getRemainingTTL = (r) => {
      let h = this.#s.get(r);
      if (h === void 0) return 0;
      let l = e[h], c = t[h];
      if (!l || !c) return 1 / 0;
      let f = (n || o()) - c;
      return l - f;
    }, this.#p = (r) => {
      let h = t[r], l = e[r];
      return !!l && !!h && (n || o()) - h > l;
    };
  }
  #D = () => {
  };
  #E = () => {
  };
  #N = () => {
  };
  #p = () => false;
  #X() {
    let e = new O(this.#o);
    this.#b = 0, this.#_ = e, this.#R = (t) => {
      this.#b -= e[t], e[t] = 0;
    }, this.#k = (t, i, s, n) => {
      if (this.#e(i)) return 0;
      if (!F(s)) if (n) {
        if (typeof n != "function") throw new TypeError("sizeCalculation must be a function");
        if (s = n(i, t), !F(s)) throw new TypeError("sizeCalculation return invalid (expect positive integer)");
      } else throw new TypeError("invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.");
      return s;
    }, this.#I = (t, i, s) => {
      if (e[t] = i, this.#u) {
        let n = this.#u - e[t];
        for (; this.#b > n; ) this.#G(true);
      }
      this.#b += e[t], s && (s.entrySize = i, s.totalCalculatedSize = this.#b);
    };
  }
  #R = (e) => {
  };
  #I = (e, t, i) => {
  };
  #k = (e, t, i, s) => {
    if (i || s) throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache");
    return 0;
  };
  *#A({ allowStale: e = this.allowStale } = {}) {
    if (this.#n) for (let t = this.#h; this.#V(t) && ((e || !this.#p(t)) && (yield t), t !== this.#l); ) t = this.#c[t];
  }
  *#z({ allowStale: e = this.allowStale } = {}) {
    if (this.#n) for (let t = this.#l; this.#V(t) && ((e || !this.#p(t)) && (yield t), t !== this.#h); ) t = this.#a[t];
  }
  #V(e) {
    return e !== void 0 && this.#s.get(this.#i[e]) === e;
  }
  *entries() {
    for (let e of this.#A()) this.#t[e] !== void 0 && this.#i[e] !== void 0 && !this.#e(this.#t[e]) && (yield [this.#i[e], this.#t[e]]);
  }
  *rentries() {
    for (let e of this.#z()) this.#t[e] !== void 0 && this.#i[e] !== void 0 && !this.#e(this.#t[e]) && (yield [this.#i[e], this.#t[e]]);
  }
  *keys() {
    for (let e of this.#A()) {
      let t = this.#i[e];
      t !== void 0 && !this.#e(this.#t[e]) && (yield t);
    }
  }
  *rkeys() {
    for (let e of this.#z()) {
      let t = this.#i[e];
      t !== void 0 && !this.#e(this.#t[e]) && (yield t);
    }
  }
  *values() {
    for (let e of this.#A()) this.#t[e] !== void 0 && !this.#e(this.#t[e]) && (yield this.#t[e]);
  }
  *rvalues() {
    for (let e of this.#z()) this.#t[e] !== void 0 && !this.#e(this.#t[e]) && (yield this.#t[e]);
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  [Symbol.toStringTag] = "LRUCache";
  find(e, t = {}) {
    for (let i of this.#A()) {
      let s = this.#t[i], n = this.#e(s) ? s.__staleWhileFetching : s;
      if (n !== void 0 && e(n, this.#i[i], this)) return this.#C(this.#i[i], t);
    }
  }
  forEach(e, t = this) {
    for (let i of this.#A()) {
      let s = this.#t[i], n = this.#e(s) ? s.__staleWhileFetching : s;
      n !== void 0 && e.call(t, n, this.#i[i], this);
    }
  }
  rforEach(e, t = this) {
    for (let i of this.#z()) {
      let s = this.#t[i], n = this.#e(s) ? s.__staleWhileFetching : s;
      n !== void 0 && e.call(t, n, this.#i[i], this);
    }
  }
  purgeStale() {
    let e = false;
    for (let t of this.#z({ allowStale: true })) this.#p(t) && (this.#v(this.#i[t], "expire"), e = true);
    return e;
  }
  info(e) {
    let t = this.#s.get(e);
    if (t === void 0) return;
    let i = this.#t[t], s = this.#e(i) ? i.__staleWhileFetching : i;
    if (s === void 0) return;
    let n = { value: s };
    if (this.#d && this.#F) {
      let o = this.#d[t], r = this.#F[t];
      if (o && r) {
        let h = o - (this.#m.now() - r);
        n.ttl = h, n.start = Date.now();
      }
    }
    return this.#_ && (n.size = this.#_[t]), n;
  }
  dump() {
    let e = [];
    for (let t of this.#A({ allowStale: true })) {
      let i = this.#i[t], s = this.#t[t], n = this.#e(s) ? s.__staleWhileFetching : s;
      if (n === void 0 || i === void 0) continue;
      let o = { value: n };
      if (this.#d && this.#F) {
        o.ttl = this.#d[t];
        let r = this.#m.now() - this.#F[t];
        o.start = Math.floor(Date.now() - r);
      }
      this.#_ && (o.size = this.#_[t]), e.unshift([i, o]);
    }
    return e;
  }
  load(e) {
    this.clear();
    for (let [t, i] of e) {
      if (i.start) {
        let s = Date.now() - i.start;
        i.start = this.#m.now() - s;
      }
      this.#O(t, i.value, i);
    }
  }
  set(e, t, i = {}) {
    let { status: s = S.hasSubscribers ? {} : void 0 } = i;
    i.status = s, s && (s.op = "set", s.key = e, t !== void 0 && (s.value = t));
    let n = this.#O(e, t, i);
    return s && S.hasSubscribers && S.publish(s), n;
  }
  #O(e, t, i = {}) {
    let { ttl: s = this.ttl, start: n, noDisposeOnSet: o = this.noDisposeOnSet, sizeCalculation: r = this.sizeCalculation, status: h } = i;
    if (t === void 0) return h && (h.set = "deleted"), this.delete(e), this;
    let { noUpdateTTL: l = this.noUpdateTTL } = i;
    h && !this.#e(t) && (h.value = t);
    let c = this.#k(e, t, i.size || 0, r, h);
    if (this.maxEntrySize && c > this.maxEntrySize) return this.#v(e, "set"), h && (h.set = "miss", h.maxEntrySizeExceeded = true), this;
    let f = this.#n === 0 ? void 0 : this.#s.get(e);
    if (f === void 0) f = this.#n === 0 ? this.#h : this.#y.length !== 0 ? this.#y.pop() : this.#n === this.#o ? this.#G(false) : this.#n, this.#i[f] = e, this.#t[f] = t, this.#s.set(e, f), this.#a[this.#h] = f, this.#c[f] = this.#h, this.#h = f, this.#n++, this.#I(f, c, h), h && (h.set = "add"), l = false, this.#j && this.#x?.(t, e, "add");
    else {
      this.#L(f);
      let g = this.#t[f];
      if (t !== g) {
        if (this.#W && this.#e(g)) {
          g.__abortController.abort(new Error("replaced"));
          let { __staleWhileFetching: p } = g;
          p !== void 0 && !o && (this.#T && this.#w?.(p, e, "set"), this.#f && this.#r?.push([p, e, "set"]));
        } else o || (this.#T && this.#w?.(g, e, "set"), this.#f && this.#r?.push([g, e, "set"]));
        if (this.#R(f), this.#I(f, c, h), this.#t[f] = t, h) {
          h.set = "replace";
          let p = g && this.#e(g) ? g.__staleWhileFetching : g;
          p !== void 0 && (h.oldValue = p);
        }
      } else h && (h.set = "update");
      this.#j && this.onInsert?.(t, e, t === g ? "update" : "replace");
    }
    if (s !== 0 && !this.#d && this.#H(), this.#d && (l || this.#N(f, s, n), h && this.#E(h, f)), !o && this.#f && this.#r) {
      let g = this.#r, p;
      for (; p = g?.shift(); ) this.#S?.(...p);
    }
    return this;
  }
  pop() {
    try {
      for (; this.#n; ) {
        let e = this.#t[this.#l];
        if (this.#G(true), this.#e(e)) {
          if (e.__staleWhileFetching) return e.__staleWhileFetching;
        } else if (e !== void 0) return e;
      }
    } finally {
      if (this.#f && this.#r) {
        let e = this.#r, t;
        for (; t = e?.shift(); ) this.#S?.(...t);
      }
    }
  }
  #G(e) {
    let t = this.#l, i = this.#i[t], s = this.#t[t];
    return this.#W && this.#e(s) ? s.__abortController.abort(new Error("evicted")) : (this.#T || this.#f) && (this.#T && this.#w?.(s, i, "evict"), this.#f && this.#r?.push([s, i, "evict"])), this.#R(t), this.#g?.[t] && (clearTimeout(this.#g[t]), this.#g[t] = void 0), e && (this.#i[t] = void 0, this.#t[t] = void 0, this.#y.push(t)), this.#n === 1 ? (this.#l = this.#h = 0, this.#y.length = 0) : this.#l = this.#a[t], this.#s.delete(i), this.#n--, t;
  }
  has(e, t = {}) {
    let { status: i = S.hasSubscribers ? {} : void 0 } = t;
    t.status = i, i && (i.op = "has", i.key = e);
    let s = this.#Y(e, t);
    return S.hasSubscribers && S.publish(i), s;
  }
  #Y(e, t = {}) {
    let { updateAgeOnHas: i = this.updateAgeOnHas, status: s } = t, n = this.#s.get(e);
    if (n !== void 0) {
      let o = this.#t[n];
      if (this.#e(o) && o.__staleWhileFetching === void 0) return false;
      if (this.#p(n)) s && (s.has = "stale", this.#E(s, n));
      else return i && this.#D(n), s && (s.has = "hit", this.#E(s, n)), true;
    } else s && (s.has = "miss");
    return false;
  }
  peek(e, t = {}) {
    let { status: i = D() ? {} : void 0 } = t;
    i && (i.op = "peek", i.key = e), t.status = i;
    let s = this.#J(e, t);
    return S.hasSubscribers && S.publish(i), s;
  }
  #J(e, t) {
    let { status: i, allowStale: s = this.allowStale } = t, n = this.#s.get(e);
    if (n === void 0 || !s && this.#p(n)) {
      i && (i.peek = n === void 0 ? "miss" : "stale");
      return;
    }
    let o = this.#t[n], r = this.#e(o) ? o.__staleWhileFetching : o;
    return i && (r !== void 0 ? (i.peek = "hit", i.value = r) : i.peek = "miss"), r;
  }
  #P(e, t, i, s) {
    let n = t === void 0 ? void 0 : this.#t[t];
    if (this.#e(n)) return n;
    let o = new AbortController(), { signal: r } = i;
    r?.addEventListener("abort", () => o.abort(r.reason), { signal: o.signal });
    let h = { signal: o.signal, options: i, context: s }, l = (w, y = false) => {
      let { aborted: a } = o.signal, m = i.ignoreFetchAbort && w !== void 0, _ = i.ignoreFetchAbort || !!(i.allowStaleOnFetchAbort && w !== void 0);
      if (i.status && (a && !y ? (i.status.fetchAborted = true, i.status.fetchError = o.signal.reason, m && (i.status.fetchAbortIgnored = true)) : i.status.fetchResolved = true), a && !m && !y) return f(o.signal.reason, _);
      let b = p, d = this.#t[t];
      return (d === p || d === void 0 && m && y) && (w === void 0 ? b.__staleWhileFetching !== void 0 ? this.#t[t] = b.__staleWhileFetching : this.#v(e, "fetch") : (i.status && (i.status.fetchUpdated = true), this.#O(e, w, h.options))), w;
    }, c = (w) => (i.status && (i.status.fetchRejected = true, i.status.fetchError = w), f(w, false)), f = (w, y) => {
      let { aborted: a } = o.signal, m = a && i.allowStaleOnFetchAbort, _ = m || i.allowStaleOnFetchRejection, b = _ || i.noDeleteOnFetchRejection, d = p;
      if (this.#t[t] === p && (!b || !y && d.__staleWhileFetching === void 0 ? this.#v(e, "fetch") : m || (this.#t[t] = d.__staleWhileFetching)), _) return i.status && d.__staleWhileFetching !== void 0 && (i.status.returnedStale = true), d.__staleWhileFetching;
      if (d.__returned === d) throw w;
    }, g = (w, y) => {
      let a = this.#M?.(e, n, h);
      a && a instanceof Promise && a.then((m) => w(m === void 0 ? void 0 : m), y), o.signal.addEventListener("abort", () => {
        (!i.ignoreFetchAbort || i.allowStaleOnFetchAbort) && (w(void 0), i.allowStaleOnFetchAbort && (w = (m) => l(m, true)));
      });
    };
    i.status && (i.status.fetchDispatched = true);
    let p = new Promise(g).then(l, c), T = Object.assign(p, { __abortController: o, __staleWhileFetching: n, __returned: void 0 });
    return t === void 0 ? (this.#O(e, T, { ...h.options, status: void 0 }), t = this.#s.get(e)) : this.#t[t] = T, T;
  }
  #e(e) {
    if (!this.#W) return false;
    let t = e;
    return !!t && t instanceof Promise && t.hasOwnProperty("__staleWhileFetching") && t.__abortController instanceof AbortController;
  }
  fetch(e, t = {}) {
    let i = W.hasSubscribers, { status: s = D() ? {} : void 0 } = t;
    t.status = s, s && t.context && (s.context = t.context);
    let n = this.#B(e, t);
    return s && i && (s.trace = true, W.tracePromise(() => n, s).catch(() => {
    })), n;
  }
  async #B(e, t = {}) {
    let { allowStale: i = this.allowStale, updateAgeOnGet: s = this.updateAgeOnGet, noDeleteOnStaleGet: n = this.noDeleteOnStaleGet, ttl: o = this.ttl, noDisposeOnSet: r = this.noDisposeOnSet, size: h = 0, sizeCalculation: l = this.sizeCalculation, noUpdateTTL: c = this.noUpdateTTL, noDeleteOnFetchRejection: f = this.noDeleteOnFetchRejection, allowStaleOnFetchRejection: g = this.allowStaleOnFetchRejection, ignoreFetchAbort: p = this.ignoreFetchAbort, allowStaleOnFetchAbort: T = this.allowStaleOnFetchAbort, context: w, forceRefresh: y = false, status: a, signal: m } = t;
    if (a && (a.op = "fetch", a.key = e, y && (a.forceRefresh = true)), !this.#W) return a && (a.fetch = "get"), this.#C(e, { allowStale: i, updateAgeOnGet: s, noDeleteOnStaleGet: n, status: a });
    let _ = { allowStale: i, updateAgeOnGet: s, noDeleteOnStaleGet: n, ttl: o, noDisposeOnSet: r, size: h, sizeCalculation: l, noUpdateTTL: c, noDeleteOnFetchRejection: f, allowStaleOnFetchRejection: g, allowStaleOnFetchAbort: T, ignoreFetchAbort: p, status: a, signal: m }, b = this.#s.get(e);
    if (b === void 0) {
      a && (a.fetch = "miss");
      let d = this.#P(e, b, _, w);
      return d.__returned = d;
    } else {
      let d = this.#t[b];
      if (this.#e(d)) {
        let E = i && d.__staleWhileFetching !== void 0;
        return a && (a.fetch = "inflight", E && (a.returnedStale = true)), E ? d.__staleWhileFetching : d.__returned = d;
      }
      let A = this.#p(b);
      if (!y && !A) return a && (a.fetch = "hit"), this.#L(b), s && this.#D(b), a && this.#E(a, b), d;
      let z = this.#P(e, b, _, w), v = z.__staleWhileFetching !== void 0 && i;
      return a && (a.fetch = A ? "stale" : "refresh", v && A && (a.returnedStale = true)), v ? z.__staleWhileFetching : z.__returned = z;
    }
  }
  forceFetch(e, t = {}) {
    let i = W.hasSubscribers, { status: s = D() ? {} : void 0 } = t;
    t.status = s, s && t.context && (s.context = t.context);
    let n = this.#K(e, t);
    return s && i && (s.trace = true, W.tracePromise(() => n, s).catch(() => {
    })), n;
  }
  async #K(e, t = {}) {
    let i = await this.#B(e, t);
    if (i === void 0) throw new Error("fetch() returned undefined");
    return i;
  }
  memo(e, t = {}) {
    let { status: i = S.hasSubscribers ? {} : void 0 } = t;
    t.status = i, i && (i.op = "memo", i.key = e, t.context && (i.context = t.context));
    let s = this.#Q(e, t);
    return i && (i.value = s), S.hasSubscribers && S.publish(i), s;
  }
  #Q(e, t = {}) {
    let i = this.#U;
    if (!i) throw new Error("no memoMethod provided to constructor");
    let { context: s, status: n, forceRefresh: o, ...r } = t;
    n && o && (n.forceRefresh = true);
    let h = this.#C(e, r), l = o || h === void 0;
    if (n && (n.memo = l ? "miss" : "hit", l || (n.value = h)), !l) return h;
    let c = i(e, h, { options: r, context: s });
    return n && (n.value = c), this.#O(e, c, r), c;
  }
  get(e, t = {}) {
    let { status: i = S.hasSubscribers ? {} : void 0 } = t;
    t.status = i, i && (i.op = "get", i.key = e);
    let s = this.#C(e, t);
    return i && (s !== void 0 && (i.value = s), S.hasSubscribers && S.publish(i)), s;
  }
  #C(e, t = {}) {
    let { allowStale: i = this.allowStale, updateAgeOnGet: s = this.updateAgeOnGet, noDeleteOnStaleGet: n = this.noDeleteOnStaleGet, status: o } = t, r = this.#s.get(e);
    if (r === void 0) {
      o && (o.get = "miss");
      return;
    }
    let h = this.#t[r], l = this.#e(h);
    return o && this.#E(o, r), this.#p(r) ? l ? (o && (o.get = "stale-fetching"), i && h.__staleWhileFetching !== void 0 ? (o && (o.returnedStale = true), h.__staleWhileFetching) : void 0) : (n || this.#v(e, "expire"), o && (o.get = "stale"), i ? (o && (o.returnedStale = true), h) : void 0) : (o && (o.get = l ? "fetching" : "hit"), this.#L(r), s && this.#D(r), l ? h.__staleWhileFetching : h);
  }
  #$(e, t) {
    this.#c[t] = e, this.#a[e] = t;
  }
  #L(e) {
    e !== this.#h && (e === this.#l ? this.#l = this.#a[e] : this.#$(this.#c[e], this.#a[e]), this.#$(this.#h, e), this.#h = e);
  }
  delete(e) {
    return this.#v(e, "delete");
  }
  #v(e, t) {
    S.hasSubscribers && S.publish({ op: "delete", delete: t, key: e });
    let i = false;
    if (this.#n !== 0) {
      let s = this.#s.get(e);
      if (s !== void 0) if (this.#g?.[s] && (clearTimeout(this.#g?.[s]), this.#g[s] = void 0), i = true, this.#n === 1) this.#q(t);
      else {
        this.#R(s);
        let n = this.#t[s];
        if (this.#e(n) ? n.__abortController.abort(new Error("deleted")) : (this.#T || this.#f) && (this.#T && this.#w?.(n, e, t), this.#f && this.#r?.push([n, e, t])), this.#s.delete(e), this.#i[s] = void 0, this.#t[s] = void 0, s === this.#h) this.#h = this.#c[s];
        else if (s === this.#l) this.#l = this.#a[s];
        else {
          let o = this.#c[s];
          this.#a[o] = this.#a[s];
          let r = this.#a[s];
          this.#c[r] = this.#c[s];
        }
        this.#n--, this.#y.push(s);
      }
    }
    if (this.#f && this.#r?.length) {
      let s = this.#r, n;
      for (; n = s?.shift(); ) this.#S?.(...n);
    }
    return i;
  }
  clear() {
    return this.#q("delete");
  }
  #q(e) {
    for (let t of this.#z({ allowStale: true })) {
      let i = this.#t[t];
      if (this.#e(i)) i.__abortController.abort(new Error("deleted"));
      else {
        let s = this.#i[t];
        this.#T && this.#w?.(i, s, e), this.#f && this.#r?.push([i, s, e]);
      }
    }
    if (this.#s.clear(), this.#t.fill(void 0), this.#i.fill(void 0), this.#d && this.#F) {
      this.#d.fill(0), this.#F.fill(0);
      for (let t of this.#g ?? []) t !== void 0 && clearTimeout(t);
      this.#g?.fill(void 0);
    }
    if (this.#_ && this.#_.fill(0), this.#l = 0, this.#h = 0, this.#y.length = 0, this.#b = 0, this.#n = 0, this.#f && this.#r) {
      let t = this.#r, i;
      for (; i = t?.shift(); ) this.#S?.(...i);
    }
  }
};

// ../src/utils/debug.ts
var DEBUG = !!process.env.IG_DEBUG_LSP;
function logForDebugging(message, opts) {
  if (DEBUG) {
    const prefix = opts?.level === "error" ? "[ERROR]" : opts?.level === "warn" ? "[WARN]" : "[DEBUG]";
    process.stderr.write(`${prefix} ${message}
`);
  }
}

// ../src/utils/errors.ts
function toError(error) {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

// ../src/utils/log.ts
function logError(error) {
  process.stderr.write(`[ERROR] ${error.message}
`);
  if (process.env.IG_DEBUG_LSP && error.stack) {
    process.stderr.write(error.stack + "\n");
  }
}

// ../src/utils/slowOperations.ts
function jsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ../src/services/lsp/LSPDiagnosticRegistry.ts
var MAX_DIAGNOSTICS_PER_FILE = 10;
var MAX_TOTAL_DIAGNOSTICS = 30;
var MAX_DELIVERED_FILES = 500;
var pendingDiagnostics = /* @__PURE__ */ new Map();
var deliveredDiagnostics = new M({
  max: MAX_DELIVERED_FILES
});
function severityToNumber(severity) {
  switch (severity) {
    case "Error":
      return 1;
    case "Warning":
      return 2;
    case "Info":
      return 3;
    case "Hint":
      return 4;
    default:
      return 4;
  }
}
function createDiagnosticKey(diag) {
  return jsonStringify({
    message: diag.message,
    severity: diag.severity,
    range: diag.range,
    source: diag.source || null,
    code: diag.code || null
  });
}
function deduplicateDiagnosticFiles(allFiles) {
  const fileMap = /* @__PURE__ */ new Map();
  const dedupedFiles = [];
  for (const file of allFiles) {
    if (!fileMap.has(file.uri)) {
      fileMap.set(file.uri, /* @__PURE__ */ new Set());
      dedupedFiles.push({ uri: file.uri, diagnostics: [] });
    }
    const seenDiagnostics = fileMap.get(file.uri);
    const dedupedFile = dedupedFiles.find((f) => f.uri === file.uri);
    const previouslyDelivered = deliveredDiagnostics.get(file.uri) || /* @__PURE__ */ new Set();
    for (const diag of file.diagnostics) {
      try {
        const key = createDiagnosticKey(diag);
        if (seenDiagnostics.has(key) || previouslyDelivered.has(key)) {
          continue;
        }
        seenDiagnostics.add(key);
        dedupedFile.diagnostics.push(diag);
      } catch (error) {
        const err = toError(error);
        const truncatedMessage = diag.message?.substring(0, 100) || "<no message>";
        logError(
          new Error(
            `Failed to deduplicate diagnostic in ${file.uri}: ${err.message}. Diagnostic message: ${truncatedMessage}`
          )
        );
        dedupedFile.diagnostics.push(diag);
      }
    }
  }
  return dedupedFiles.filter((f) => f.diagnostics.length > 0);
}
function checkForLSPDiagnostics() {
  logForDebugging(
    `LSP Diagnostics: Checking registry - ${pendingDiagnostics.size} pending`
  );
  const allFiles = [];
  const serverNames = /* @__PURE__ */ new Set();
  const diagnosticsToMark = [];
  for (const diagnostic of pendingDiagnostics.values()) {
    if (!diagnostic.attachmentSent) {
      allFiles.push(...diagnostic.files);
      serverNames.add(diagnostic.serverName);
      diagnosticsToMark.push(diagnostic);
    }
  }
  if (allFiles.length === 0) {
    return [];
  }
  let dedupedFiles;
  try {
    dedupedFiles = deduplicateDiagnosticFiles(allFiles);
  } catch (error) {
    const err = toError(error);
    logError(new Error(`Failed to deduplicate LSP diagnostics: ${err.message}`));
    dedupedFiles = allFiles;
  }
  for (const diagnostic of diagnosticsToMark) {
    diagnostic.attachmentSent = true;
  }
  for (const [id, diagnostic] of pendingDiagnostics) {
    if (diagnostic.attachmentSent) {
      pendingDiagnostics.delete(id);
    }
  }
  const originalCount = allFiles.reduce(
    (sum, f) => sum + f.diagnostics.length,
    0
  );
  const dedupedCount = dedupedFiles.reduce(
    (sum, f) => sum + f.diagnostics.length,
    0
  );
  if (originalCount > dedupedCount) {
    logForDebugging(
      `LSP Diagnostics: Deduplication removed ${originalCount - dedupedCount} duplicate diagnostic(s)`
    );
  }
  let totalDiagnostics = 0;
  let truncatedCount = 0;
  for (const file of dedupedFiles) {
    file.diagnostics.sort(
      (a, b) => severityToNumber(a.severity) - severityToNumber(b.severity)
    );
    if (file.diagnostics.length > MAX_DIAGNOSTICS_PER_FILE) {
      truncatedCount += file.diagnostics.length - MAX_DIAGNOSTICS_PER_FILE;
      file.diagnostics = file.diagnostics.slice(0, MAX_DIAGNOSTICS_PER_FILE);
    }
    const remainingCapacity = MAX_TOTAL_DIAGNOSTICS - totalDiagnostics;
    if (file.diagnostics.length > remainingCapacity) {
      truncatedCount += file.diagnostics.length - remainingCapacity;
      file.diagnostics = file.diagnostics.slice(0, remainingCapacity);
    }
    totalDiagnostics += file.diagnostics.length;
  }
  dedupedFiles = dedupedFiles.filter((f) => f.diagnostics.length > 0);
  if (truncatedCount > 0) {
    logForDebugging(
      `LSP Diagnostics: Volume limiting removed ${truncatedCount} diagnostic(s) (max ${MAX_DIAGNOSTICS_PER_FILE}/file, ${MAX_TOTAL_DIAGNOSTICS} total)`
    );
  }
  for (const file of dedupedFiles) {
    if (!deliveredDiagnostics.has(file.uri)) {
      deliveredDiagnostics.set(file.uri, /* @__PURE__ */ new Set());
    }
    const delivered = deliveredDiagnostics.get(file.uri);
    for (const diag of file.diagnostics) {
      try {
        delivered.add(createDiagnosticKey(diag));
      } catch (error) {
        const err = toError(error);
        const truncatedMessage = diag.message?.substring(0, 100) || "<no message>";
        logError(
          new Error(
            `Failed to track delivered diagnostic in ${file.uri}: ${err.message}. Diagnostic message: ${truncatedMessage}`
          )
        );
      }
    }
  }
  const finalCount = dedupedFiles.reduce(
    (sum, f) => sum + f.diagnostics.length,
    0
  );
  if (finalCount === 0) {
    logForDebugging(
      `LSP Diagnostics: No new diagnostics to deliver (all filtered by deduplication)`
    );
    return [];
  }
  logForDebugging(
    `LSP Diagnostics: Delivering ${dedupedFiles.length} file(s) with ${finalCount} diagnostic(s) from ${serverNames.size} server(s)`
  );
  return [
    {
      serverName: Array.from(serverNames).join(", "),
      files: dedupedFiles
    }
  ];
}

// ../src/utils/sessionActivity.ts
var IDLE_THRESHOLD_MS = 5 * 60 * 1e3;
var SessionActivityTracker = class {
  record;
  lastTurnAt;
  constructor() {
    const now = Date.now();
    this.record = {
      startedAt: now,
      activeMs: 0,
      idleMs: 0,
      turnCount: 0,
      lastActivityAt: now
    };
    this.lastTurnAt = now;
  }
  /** Called when the user submits a message. */
  recordTurn() {
    const now = Date.now();
    const gap = now - this.lastTurnAt;
    if (gap > IDLE_THRESHOLD_MS) {
      this.record.idleMs += gap;
    } else {
      this.record.activeMs += gap;
    }
    this.record.turnCount++;
    this.record.lastActivityAt = now;
    this.lastTurnAt = now;
  }
  /** Get the current activity record (snapshot). */
  getRecord() {
    return { ...this.record };
  }
  /** Total elapsed session time in ms. */
  elapsedMs() {
    return Date.now() - this.record.startedAt;
  }
  /** Format a compact summary for display. */
  summary() {
    const elapsed = this.elapsedMs();
    const active = this.record.activeMs;
    const turns = this.record.turnCount;
    return `${formatDuration(elapsed)} elapsed \xB7 ${turns} turn${turns !== 1 ? "s" : ""} \xB7 ${formatDuration(active)} active`;
  }
};
var _tracker;
function getSessionTracker() {
  return _tracker ??= new SessionActivityTracker();
}
function recordTurn() {
  getSessionTracker().recordTurn();
}
function formatDuration(ms) {
  const s = Math.floor(ms / 1e3);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

// ../src/agent/QueryEngine.ts
var MAX_TOOL_RESULT_CHARS = 32e3;
function truncateToolResult(result) {
  if (result.length <= MAX_TOOL_RESULT_CHARS) return result;
  const kept = result.slice(0, MAX_TOOL_RESULT_CHARS);
  const droppedLines = result.slice(MAX_TOOL_RESULT_CHARS).split("\n").length;
  return kept + `

[...truncated ${droppedLines} more lines. Output exceeded ${MAX_TOOL_RESULT_CHARS} character limit.]`;
}
var QueryEngine = class _QueryEngine {
  messages = [];
  opts;
  abortController = new AbortController();
  fileStateCache = new FileStateCache();
  turnCounter = 0;
  turnToolCalls = [];
  /** Consecutive auto-compact failures — circuit breaker for Phase 20. */
  compactFailures = 0;
  /**
   * Volatile system-prompt content (time, session memory, token budget) rendered
   * as a <system-reminder>. Kept OUT of messages[0] so the system prefix stays
   * byte-identical every turn — otherwise per-turn changes invalidate the
   * provider's KV prefix cache for the whole conversation. Appended at the tail
   * of the API message array at stream time; never persisted in this.messages.
   */
  dynamicReminder = "";
  constructor(opts) {
    this.opts = opts;
    this.messages.push({ role: "system", content: "" });
  }
  get cwd() {
    return this.opts.cwd;
  }
  /** Swap in a fresh conversation; keeps cache and options. */
  resetConversation() {
    this.turnCounter = 0;
    this.compactFailures = 0;
    this.messages = [{ role: "system", content: "" }];
    this.fileStateCache.clear();
  }
  /** Load a previous transcript verbatim. */
  setMessages(msgs) {
    this.messages = [...msgs];
  }
  /** Retrieve the current message history. */
  getMessages() {
    return [...this.messages];
  }
  /** Swap the active model (e.g. from a model picker). */
  setModel(model) {
    this.opts.model = model;
  }
  /** Swap the active provider (e.g. when switching accounts). */
  setProvider(provider) {
    this.opts.provider = provider;
  }
  /** The provider currently in use (for display / quota probing). */
  getProvider() {
    return this.opts.provider;
  }
  /** Attach/replace the permission prompt handler after construction. */
  setRequestPermission(fn) {
    this.opts.requestPermission = fn;
  }
  /** Cancel any in-flight stream + tool execution. Safe to call multiple times. */
  abort() {
    this.abortController.abort();
  }
  /** Called by REPL after resetConversation or abort so new turns get a fresh signal. */
  refreshAbortController() {
    if (this.abortController.signal.aborted) {
      this.abortController = new AbortController();
    }
  }
  /** Helper to broadcast event to onEvent handler if present, before yielding. */
  *yieldEvent(ev) {
    if (this.opts.onEvent) {
      this.opts.onEvent(ev);
    }
    yield ev;
  }
  /**
   * Submit a new user message. Returns an AsyncGenerator of SessionEvents
   * describing the entire turn: streaming text, tool calls, permission prompts,
   * and terminal events.
   */
  async *submitMessage(userText) {
    this.refreshAbortController();
    this.messages.push({ role: "user", content: userText });
    recordTurn();
    const turnId = ++this.turnCounter;
    yield* this.yieldEvent({ type: "turn_start", turnId, at: Date.now() });
    const maxIter = this.opts.maxIterations ?? 25;
    for (let i = 0; i < maxIter; i++) {
      if (this.abortController.signal.aborted) {
        yield* this.yieldEvent({ type: "turn_end", turnId, reason: "aborted" });
        return;
      }
      for await (const ev of this.maybeAutoCompact()) yield* this.yieldEvent(ev);
      const sysPromptBlocks = await this.renderSystemPrompt(this.turnCounter);
      const splitBlocks = splitSysPromptPrefix(sysPromptBlocks);
      const staticText = splitBlocks.find((b) => b.cacheScope !== null)?.text ?? "";
      const dynamicText = splitBlocks.find((b) => b.cacheScope === null)?.text ?? "";
      this.messages[0] = { role: "system", content: staticText };
      this.dynamicReminder = dynamicText ? `<system-reminder>
${dynamicText}
</system-reminder>` : "";
      const toolCalls = [];
      for await (const ev of this.runOneTurn(toolCalls)) yield* this.yieldEvent(ev);
      if (this.abortController.signal.aborted) {
        yield* this.yieldEvent({ type: "turn_end", turnId, reason: "aborted" });
        return;
      }
      if (!toolCalls.length) {
        yield* this.yieldEvent({ type: "checkpoint", messages: this.messages });
        maybeExtractSessionMemory(
          this.messages,
          this.opts.cwd,
          async (prompt, _memoryPath) => {
            const ac = new AbortController();
            const sub = this.createSubEngine(ac);
            for await (const _ev of sub.run(prompt)) {
            }
          }
        );
        yield* this.yieldEvent({ type: "turn_end", turnId, reason: "complete" });
        return;
      }
      for await (const ev of this.runToolCalls(toolCalls)) yield* this.yieldEvent(ev);
      const pendingNotifications = dequeueAll().filter(
        (cmd) => cmd.mode === "task-notification"
      );
      const pendingLsp = checkForLSPDiagnostics();
      if (pendingNotifications.length > 0 || pendingLsp.length > 0) {
        const lines = [];
        if (pendingNotifications.length > 0) {
          lines.push(...pendingNotifications.map((cmd) => cmd.value));
        }
        if (pendingLsp.length > 0) {
          for (const diag of pendingLsp) {
            const files = diag.files.map((f) => `${f.uri}:
${f.diagnostics.map((d) => `  [${d.severity}] Line ${d.range.start.line + 1}: ${d.message}`).join("\n")}`).join("\n\n");
            lines.push(`<lsp_diagnostics server="${diag.serverName}">
${files}
</lsp_diagnostics>`);
          }
        }
        this.messages.push({ role: "user", content: lines.join("\n\n") });
      }
    }
    this.messages.push({
      role: "user",
      content: `[system] Max tool-use iterations (${maxIter}) reached. Summarize progress and stop.`
    });
    for await (const ev of this.runOneTurn([])) yield* this.yieldEvent(ev);
    yield* this.yieldEvent({ type: "turn_end", turnId, reason: "max_iterations" });
  }
  /** Run a compact pass synchronously from REPL (via /compact). */
  async runCompact(focus) {
    const result = await compactMessages(this.messages, {
      provider: this.opts.provider,
      model: this.opts.model,
      cwd: this.opts.cwd,
      focus
    });
    this.messages = result.messages;
    return { droppedCount: result.droppedCount, summary: result.summary };
  }
  /**
   * Create a scoped sub-engine that inherits provider/model/registry/cwd from
   * this engine but starts with a fresh conversation. Used by LocalAgentTask
   * to run background agents without a direct circular import.
   */
  createSubEngine(abortController) {
    const childEngine = new _QueryEngine({
      provider: this.opts.provider,
      model: this.opts.model,
      registry: this.opts.registry,
      permissions: this.opts.permissions,
      stats: this.opts.stats,
      cwd: this.opts.cwd,
      contextLength: this.opts.contextLength,
      autoCompact: this.opts.autoCompact,
      getAppState: this.opts.getAppState,
      setAppState: this.opts.setAppState
    });
    childEngine.abortController = abortController;
    return {
      run: (prompt) => childEngine.submitMessage(prompt),
      getMessages: () => childEngine.getMessages()
    };
  }
  async renderSystemPrompt(turnId) {
    if (this.opts.customSystemPrompt !== void 0) {
      return [this.opts.customSystemPrompt];
    }
    const tokenBudget = this.opts.contextLength ? {
      used: this.opts.stats?.lastPromptTokens ?? 0,
      limit: this.opts.contextLength
    } : void 0;
    return buildSystemPromptSections(this.opts.cwd, this.opts.model, tokenBudget);
  }
  async *maybeAutoCompact() {
    if (this.opts.autoCompact === false) return;
    const ctx = this.opts.contextLength;
    if (!ctx) return;
    const measured = this.opts.stats?.lastPromptTokens ?? 0;
    const sizeNow = () => Math.max(measured, estimateTokens2(this.messages));
    let current = sizeNow();
    if (!current) return;
    const AUTOCOMPACT_BUFFER = 13e3;
    const WARNING_BUFFER = 2e4;
    const ratioThreshold = this.opts.autoCompactThreshold ?? 0.9;
    const absoluteThreshold = ctx - AUTOCOMPACT_BUFFER;
    const effectiveThreshold = Math.min(
      Math.floor(ctx * ratioThreshold),
      absoluteThreshold
    );
    const warningThreshold = ctx - WARNING_BUFFER;
    if (current < warningThreshold) return;
    const pct = () => Math.round(sizeNow() / ctx * 100);
    const MAX_CONSECUTIVE_FAILURES = 3;
    if (this.compactFailures >= MAX_CONSECUTIVE_FAILURES) {
      if (this.compactFailures === MAX_CONSECUTIVE_FAILURES) {
        this.compactFailures++;
        yield {
          type: "notice",
          message: `auto-compact circuit breaker tripped after ${MAX_CONSECUTIVE_FAILURES} failures \u2014 use /compact manually`,
          tone: "error"
        };
      }
      return;
    }
    if (current < effectiveThreshold) {
      yield {
        type: "notice",
        message: `context ${pct()}% full \u2014 approaching compact threshold`,
        tone: "warn"
      };
      return;
    }
    {
      const { messages: snipped, snippedCount } = snipToolOutputs(this.messages);
      if (snippedCount > 0) {
        this.messages = snipped;
        yield {
          type: "notice",
          message: `snipped ${snippedCount} large tool output(s) (context ${pct()}% full)`,
          tone: "warn"
        };
        if ((current = sizeNow()) < effectiveThreshold) return;
      }
    }
    {
      const { messages: compacted, compactedCount } = microcompactToolOutputs(this.messages);
      if (compactedCount > 0) {
        this.messages = compacted;
        yield {
          type: "notice",
          message: `microcompacted ${compactedCount} tool output(s) (context ${pct()}% full)`,
          tone: "warn"
        };
        if ((current = sizeNow()) < effectiveThreshold) return;
      }
    }
    {
      const { messages: collapsed, collapsedGroups } = collapseReadSearchGroups(this.messages);
      if (collapsedGroups > 0) {
        this.messages = collapsed;
        yield {
          type: "notice",
          message: `collapsed ${collapsedGroups} read/search group(s) (context ${pct()}% full)`,
          tone: "warn"
        };
        if ((current = sizeNow()) < effectiveThreshold) return;
      }
    }
    const before = sizeNow();
    yield {
      type: "notice",
      message: `auto-compacting via summarization (context ${pct()}% full)\u2026`,
      tone: "warn"
    };
    try {
      const result = await compactMessages(this.messages, {
        provider: this.opts.provider,
        model: this.opts.model,
        cwd: this.opts.cwd
      });
      if (result.droppedCount > 0) {
        this.messages = result.messages;
        this.compactFailures = 0;
        const freed = Math.max(0, before - estimateTokens2(this.messages));
        yield {
          type: "auto_compact",
          droppedCount: result.droppedCount,
          freedTokens: freed
        };
      }
    } catch (e) {
      this.compactFailures++;
      yield {
        type: "notice",
        message: `auto-compact failed (attempt ${this.compactFailures}/${MAX_CONSECUTIVE_FAILURES}): ${e instanceof Error ? e.message : String(e)}`,
        tone: "error"
      };
    }
  }
  /**
   * Build the message array to send to the provider for this stream. Appends the
   * volatile <system-reminder> at the tail (after all stable content) so it never
   * disturbs the cached prefix. Merges into the latest user turn when present to
   * avoid two consecutive user messages. Does NOT mutate this.messages.
   */
  buildStreamMessages() {
    if (!this.dynamicReminder) return this.messages;
    const msgs = this.messages;
    const last = msgs[msgs.length - 1];
    if (last && last.role === "user") {
      return [
        ...msgs.slice(0, -1),
        { ...last, content: `${last.content}

${this.dynamicReminder}` }
      ];
    }
    return [...msgs, { role: "user", content: this.dynamicReminder }];
  }
  async *runOneTurn(toolCallsOut) {
    const tools = this.opts.registry.toolSchema();
    let text = "";
    let reasoning = "";
    let reasoningEndedAt = 0;
    let promptTokens;
    let completionTokens;
    this.turnToolCalls = [];
    const provider = this.opts.provider;
    const thinkMode = provider.supportsThinking(this.opts.model);
    const startTime = Date.now();
    const doStream = async () => {
      for await (const chunk of provider.streamChat({
        model: this.opts.model,
        messages: this.buildStreamMessages(),
        tools,
        signal: this.abortController.signal,
        options: { temperature: this.opts.temperature },
        think: thinkMode ? true : void 0
      })) {
        if (chunk.message?.thinking) {
          reasoning += chunk.message.thinking;
        }
        if (chunk.message?.content) {
          const delta = thinkMode ? provider.stripThinkingTags(chunk.message.content) : chunk.message.content;
          if (delta) {
            if (reasoning && !reasoningEndedAt) reasoningEndedAt = Date.now();
            text += delta;
          }
        }
        if (chunk.message?.tool_calls?.length) {
          toolCallsOut.push(...chunk.message.tool_calls);
        }
        if (chunk.done) {
          promptTokens = chunk.prompt_eval_count;
          completionTokens = chunk.eval_count;
        }
      }
    };
    try {
      await withRetry(doStream, {
        maxAttempts: 3,
        baseDelayMs: 1e3,
        maxDelayMs: 3e4,
        signal: this.abortController.signal,
        isRetryable: (err) => {
          const kind = classifyApiError(err);
          return kind === "rate_limit" || kind === "network" || kind === "server";
        },
        onRetry: (err, attempt, delayMs) => {
          const kind = classifyApiError(err);
          const msg2 = err instanceof Error ? err.message : String(err);
          process.stderr.write(
            `  \u27F3 ${kind} error (attempt ${attempt}), retrying in ${Math.round(delayMs / 1e3)}s: ${msg2.slice(0, 120)}
`
          );
        }
      });
      if (text) {
        yield { type: "assistant_delta", text };
      }
    } catch (e) {
      if (this.abortController.signal.aborted) {
        return;
      }
      const kind = classifyApiError(e);
      if (kind === "prompt_too_long") {
        yield {
          type: "notice",
          message: "context overflow detected \u2014 auto-compacting and retrying\u2026",
          tone: "warn"
        };
        try {
          const result = await compactMessages(this.messages, {
            provider: this.opts.provider,
            model: this.opts.model,
            cwd: this.opts.cwd
          });
          if (result.droppedCount > 0) {
            this.messages = result.messages;
            yield {
              type: "auto_compact",
              droppedCount: result.droppedCount,
              freedTokens: 0
            };
            text = "";
            toolCallsOut.length = 0;
            for await (const chunk of provider.streamChat({
              model: this.opts.model,
              messages: this.buildStreamMessages(),
              tools,
              signal: this.abortController.signal,
              options: { temperature: this.opts.temperature },
              think: thinkMode ? true : void 0
            })) {
              if (chunk.message?.thinking) {
                reasoning += chunk.message.thinking;
                yield { type: "reasoning_delta", text: chunk.message.thinking };
              }
              if (chunk.message?.content) {
                const delta = thinkMode ? provider.stripThinkingTags(chunk.message.content) : chunk.message.content;
                if (delta) {
                  if (reasoning && !reasoningEndedAt) reasoningEndedAt = Date.now();
                  text += delta;
                  yield { type: "assistant_delta", text: delta };
                }
              }
              if (chunk.message?.tool_calls?.length) {
                toolCallsOut.push(...chunk.message.tool_calls);
              }
              if (chunk.done) {
                promptTokens = chunk.prompt_eval_count;
                completionTokens = chunk.eval_count;
              }
            }
          } else {
            const msg2 = e instanceof Error ? e.message : String(e);
            yield { type: "notice", message: msg2, tone: "error" };
            throw e;
          }
        } catch (compactErr) {
          const msg2 = compactErr instanceof Error ? compactErr.message : String(compactErr);
          yield { type: "notice", message: `auto-compact failed: ${msg2}`, tone: "error" };
          throw e;
        }
      } else {
        const msg2 = e instanceof Error ? e.message : String(e);
        yield { type: "notice", message: msg2, tone: "error" };
        throw e;
      }
    }
    const apiMs = Date.now() - startTime;
    this.messages.push({
      role: "assistant",
      content: text,
      tool_calls: toolCallsOut.length ? toolCallsOut : void 0
    });
    if (reasoning.trim()) {
      yield {
        type: "reasoning_done",
        text: reasoning.trim(),
        durationMs: (reasoningEndedAt || Date.now()) - startTime
      };
    }
    yield { type: "assistant_done", text };
    yield { type: "token_stats", promptTokens, completionTokens };
    if (this.opts.stats) {
      this.opts.stats.recordTurn({
        model: this.opts.model,
        promptTokens: promptTokens ?? 0,
        completionTokens: completionTokens ?? 0,
        apiMs,
        toolCalls: [...this.turnToolCalls]
      });
    }
  }
  async *runToolCalls(calls) {
    const parallel = [];
    const sequential = [];
    for (const call of calls) {
      const id = call.id ?? (0, import_node_crypto2.randomUUID)();
      const tool = this.opts.registry.get(call.function.name);
      if (!tool) {
        this.turnToolCalls.push(call.function.name);
        const msg2 = `Error: unknown tool "${call.function.name}". Available: ${this.opts.registry.list().map((t) => t.name).join(", ")}`;
        this.messages.push({
          role: "tool",
          tool_name: call.function.name,
          tool_call_id: id,
          content: msg2
        });
        yield { type: "tool_start", toolUseId: id, name: call.function.name, args: call.function.arguments ?? {} };
        yield {
          type: "tool_result",
          toolUseId: id,
          name: call.function.name,
          result: msg2,
          isError: true
        };
        continue;
      }
      this.turnToolCalls.push(tool.name);
      const parsed = tool.inputSchema.safeParse(call.function.arguments ?? {});
      if (!parsed.success) {
        const msg2 = `Invalid args for ${tool.name}: ${parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"} \u2014 ${i.message}`
        ).join("; ")}`;
        this.messages.push({
          role: "tool",
          tool_name: tool.name,
          tool_call_id: id,
          content: msg2
        });
        yield { type: "tool_start", toolUseId: id, name: tool.name, args: call.function.arguments ?? {} };
        yield {
          type: "tool_result",
          toolUseId: id,
          name: tool.name,
          result: msg2,
          isError: true
        };
        continue;
      }
      if (tool.isConcurrencySafe(parsed.data)) {
        parallel.push({ call, tool, id });
      } else {
        sequential.push({ call, tool, id });
      }
    }
    if (parallel.length > 0) {
      const promises = parallel.map(async ({ call, tool, id }) => {
        return await this.executeSingle(call, tool, id);
      });
      const results = parallel.map((p, idx) => ({ ...p, promise: promises[idx] }));
      for (const r of results) {
        yield {
          type: "tool_start",
          toolUseId: r.id,
          name: r.tool.name,
          args: r.call.function.arguments ?? {}
        };
      }
      for (const r of results) {
        const p = r.promise;
        if (!p) continue;
        const evts = await p;
        for (const ev of evts) yield ev;
      }
    }
    for (const { call, tool, id } of sequential) {
      yield {
        type: "tool_start",
        toolUseId: id,
        name: tool.name,
        args: call.function.arguments ?? {}
      };
      const evts = await this.executeSingle(call, tool, id);
      for (const ev of evts) yield ev;
    }
  }
  /**
   * Run one tool call end-to-end: permission check → execute → record message.
   * Returns the events to yield (post-start; start is emitted by caller so the
   * parallel batch shows all tools running simultaneously).
   */
  async executeSingle(call, tool, toolUseId) {
    const out = [];
    const input = tool.inputSchema.parse(call.function.arguments ?? {});
    const ctx = {
      abortController: this.abortController,
      fileStateCache: this.fileStateCache,
      getAppState: this.opts.getAppState,
      setAppState: this.opts.setAppState,
      messages: this.messages,
      toolUseId,
      cwd: this.opts.cwd,
      createSubEngine: (ac) => this.createSubEngine(ac),
      registry: this.opts.registry,
      spawnSubAgent: async (task, allowed_tools, context, onProgress) => {
        const subEngine = new _QueryEngine({
          provider: this.opts.provider,
          model: this.opts.model,
          registry: this.opts.registry,
          // Wait, we should probably restrict tools if allowed_tools is provided
          permissions: this.opts.permissions,
          stats: this.opts.stats,
          // share stats or new stats? Share so cost is combined
          cwd: this.opts.cwd,
          contextLength: this.opts.contextLength,
          autoCompact: this.opts.autoCompact,
          getAppState: this.opts.getAppState,
          setAppState: this.opts.setAppState,
          onEvent: (ev) => {
            if (ev.type === "tool_progress") {
              onProgress?.({ type: "status", message: `[sub-agent] ${ev.message}` });
            }
          }
        });
        const prompt = [
          "You are a sub-agent spawned to complete a specific task.",
          "Complete the task efficiently and return a clear summary of what you did.",
          "",
          `# Task`,
          task,
          context ? `
# Additional Context
${context}` : ""
        ].join("\n");
        onProgress?.({ type: "status", message: `spawning sub-agent: ${task.slice(0, 60)}...` });
        let resultSummary = "Sub-agent completed without output.";
        try {
          for await (const ev of subEngine.submitMessage(prompt)) {
          }
          const messages = subEngine.getMessages();
          for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m.role === "assistant" && typeof m.content === "string") {
              resultSummary = m.content;
              break;
            }
          }
        } catch (e) {
          resultSummary = `Sub-agent failed: ${e instanceof Error ? e.message : String(e)}`;
        }
        onProgress?.({ type: "status", message: "sub-agent complete" });
        return resultSummary;
      }
    };
    const { runPreToolUseHooks: runPreToolUseHooks2, runPostToolUseHooks: runPostToolUseHooks2 } = await Promise.resolve().then(() => (init_hooks(), hooks_exports));
    const preHook = await runPreToolUseHooks2({ toolName: tool.name, input, ctx });
    if (preHook.denied) {
      this.messages.push({
        role: "tool",
        tool_name: tool.name,
        tool_call_id: toolUseId,
        content: `Blocked by hook: ${preHook.denied}`
      });
      out.push({
        type: "tool_result",
        toolUseId,
        name: tool.name,
        result: `Blocked by hook: ${preHook.denied}`,
        isError: true
      });
      return out;
    }
    const finalInput = preHook.modifiedInput ?? input;
    const appState = this.opts.getAppState();
    const PLAN_MODE_ALLOWLIST = /* @__PURE__ */ new Set(["EnterPlanMode", "ExitPlanMode"]);
    if (appState.planMode && !PLAN_MODE_ALLOWLIST.has(tool.name) && (!tool.isReadOnly(finalInput) || tool.isDestructive(finalInput))) {
      const msg2 = `Blocked: plan mode is ON. Only read-only tools may run; call ExitPlanMode first.`;
      this.messages.push({
        role: "tool",
        tool_name: tool.name,
        tool_call_id: toolUseId,
        content: msg2
      });
      out.push({
        type: "tool_result",
        toolUseId,
        name: tool.name,
        result: msg2,
        isError: true
      });
      return out;
    }
    if (tool.validateInput) {
      const v = await tool.validateInput(finalInput, ctx);
      if (!v.ok) {
        const msg2 = `Validation failed for ${tool.name}: ${v.message}`;
        this.messages.push({
          role: "tool",
          tool_name: tool.name,
          tool_call_id: toolUseId,
          content: msg2
        });
        out.push({
          type: "tool_result",
          toolUseId,
          name: tool.name,
          result: msg2,
          isError: true
        });
        return out;
      }
    }
    if (tool.requiresPermission || tool.isDestructive(finalInput)) {
      const engine = this.opts.permissions;
      const auto = engine.decide(tool.name, finalInput);
      if (auto.kind === "auto-deny") {
        const msg2 = `Denied \u2014 ${auto.reason}`;
        this.messages.push({
          role: "tool",
          tool_name: tool.name,
          tool_call_id: toolUseId,
          content: msg2
        });
        out.push({
          type: "auto_decision",
          toolUseId,
          name: tool.name,
          decision: "deny",
          reason: auto.reason
        });
        out.push({
          type: "tool_result",
          toolUseId,
          name: tool.name,
          result: msg2,
          isError: true
        });
        return out;
      }
      if (auto.kind === "prompt") {
        if (!this.opts.requestPermission) {
          const msg2 = "Permission required but no handler available; denied.";
          this.messages.push({
            role: "tool",
            tool_name: tool.name,
            tool_call_id: toolUseId,
            content: msg2
          });
          out.push({
            type: "tool_result",
            toolUseId,
            name: tool.name,
            result: msg2,
            isError: true
          });
          return out;
        }
        const suggestedRules = {
          session: engine.suggestRule(tool.name, finalInput, "session"),
          project: engine.suggestRule(tool.name, finalInput, "project")
        };
        out.push({
          type: "permission_request",
          toolUseId,
          name: tool.name,
          args: finalInput,
          suggestedRules
        });
        const choice = await this.opts.requestPermission({
          toolUseId,
          name: tool.name,
          args: finalInput,
          suggestedRules,
          signal: this.abortController.signal
        });
        out.push({ type: "permission_decision", toolUseId, choice });
        if (choice === "no") {
          const msg2 = "User denied this tool call.";
          this.messages.push({
            role: "tool",
            tool_name: tool.name,
            tool_call_id: toolUseId,
            content: msg2
          });
          out.push({
            type: "tool_result",
            toolUseId,
            name: tool.name,
            result: msg2,
            isError: true
          });
          return out;
        }
        if (choice === "session") engine.addSessionAllow(suggestedRules.session);
        if (choice === "project") {
          try {
            await engine.addPersistedRule("project", "allow", suggestedRules.project);
          } catch (e) {
            out.push({
              type: "notice",
              message: `project save failed: ${e instanceof Error ? e.message : String(e)}`,
              tone: "warn"
            });
          }
        }
      } else {
        out.push({
          type: "auto_decision",
          toolUseId,
          name: tool.name,
          decision: "allow",
          reason: auto.reason
        });
      }
    }
    let effectiveInput = input;
    try {
      const { runPreToolUseHooks: runPreToolUseHooks3 } = await Promise.resolve().then(() => (init_hooks(), hooks_exports));
      const hookResult = await runPreToolUseHooks3({ toolName: tool.name, input, ctx });
      if (hookResult.denied) {
        const msg2 = `Hook denied: ${hookResult.denied}`;
        this.messages.push({
          role: "tool",
          tool_name: tool.name,
          tool_call_id: toolUseId,
          content: msg2
        });
        out.push({
          type: "tool_result",
          toolUseId,
          name: tool.name,
          result: msg2,
          isError: true
        });
        return out;
      }
      if (hookResult.modifiedInput) {
        effectiveInput = hookResult.modifiedInput;
      }
    } catch {
    }
    try {
      const rawResult = await tool.call(effectiveInput, ctx, (progress) => {
        out.push({
          type: "tool_progress",
          toolUseId,
          message: progress.message
        });
      });
      const resultStr = typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult);
      let result = truncateToolResult(resultStr);
      try {
        const { runPostToolUseHooks: runPostToolUseHooks3 } = await Promise.resolve().then(() => (init_hooks(), hooks_exports));
        const hookResult = await runPostToolUseHooks3({
          toolName: tool.name,
          input: effectiveInput,
          output: result,
          isError: false,
          ctx
        });
        if (hookResult.modifiedOutput) {
          result = hookResult.modifiedOutput;
        }
      } catch {
      }
      this.messages.push({
        role: "tool",
        tool_name: tool.name,
        tool_call_id: toolUseId,
        content: result
      });
      out.push({
        type: "tool_result",
        toolUseId,
        name: tool.name,
        result,
        isError: false
      });
    } catch (e) {
      const msg2 = `Error: ${e instanceof Error ? e.message : String(e)}`;
      this.messages.push({
        role: "tool",
        tool_name: tool.name,
        tool_call_id: toolUseId,
        content: msg2
      });
      out.push({
        type: "tool_result",
        toolUseId,
        name: tool.name,
        result: msg2,
        isError: true
      });
    }
    return out;
  }
};

// ../node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../node_modules/zod/v3/helpers/util.js
var util;
(function(util3) {
  util3.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util3.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util3.assertNever = assertNever;
  util3.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util3.getValidEnumValues = (obj) => {
    const validKeys = util3.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util3.objectValues(filtered);
  };
  util3.objectValues = (obj) => {
    return util3.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util3.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util3.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util3.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util3.joinValues = joinValues;
  util3.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil3) {
  objectUtil3.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// ../node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path: path17, errorMaps, issueData } = params;
  const fullPath = [...path17, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil3) {
  errorUtil3.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil3.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path17, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path17;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap3, invalid_type_error, required_error, description } = params;
  if (errorMap3 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap3)
    return { errorMap: errorMap3, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema10, params) => {
  return new ZodArray({
    type: schema10,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema10) {
  if (schema10 instanceof ZodObject) {
    const newShape = {};
    for (const key in schema10.shape) {
      const fieldSchema = schema10.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema10._def,
      shape: () => newShape
    });
  } else if (schema10 instanceof ZodArray) {
    return new ZodArray({
      ...schema10._def,
      type: deepPartialify(schema10.element)
    });
  } else if (schema10 instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema10.unwrap()));
  } else if (schema10 instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema10.unwrap()));
  } else if (schema10 instanceof ZodTuple) {
    return ZodTuple.create(schema10.items.map((item) => deepPartialify(item)));
  } else {
    return schema10;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema10) {
    return this.augment({ [key]: schema10 });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema10 = this._def.items[itemIndex] || this._def.rest;
      if (!schema10)
        return null;
      return schema10._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema10, params) => {
  return new ZodPromise({
    type: schema10,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema10, effect, params) => {
  return new ZodEffects({
    schema: schema10,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema10, params) => {
  return new ZodEffects({
    schema: schema10,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind3) {
  ZodFirstPartyTypeKind3["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind3["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind3["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind3["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind3["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind3["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind3["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind3["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind3["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind3["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind3["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind3["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind3["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind3["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind3["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind3["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind3["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind3["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind3["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind3["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind3["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind3["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind3["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind3["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind3["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind3["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind3["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind3["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind3["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind3["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind3["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind3["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind3["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind3["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind3["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind3["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;

// ../src/utils/zodToJsonSchema.ts
function zodToJsonSchema(schema10) {
  return convert(schema10);
}
function convert(schema10) {
  const def = schema10._def;
  const description = schema10.description;
  if (schema10 instanceof external_exports.ZodString) {
    return withDesc({ type: "string" }, description);
  }
  if (schema10 instanceof external_exports.ZodNumber) {
    return withDesc({ type: "number" }, description);
  }
  if (schema10 instanceof external_exports.ZodBoolean) {
    return withDesc({ type: "boolean" }, description);
  }
  if (schema10 instanceof external_exports.ZodEnum) {
    const values = def.values;
    return withDesc({ type: "string", enum: [...values] }, description);
  }
  if (schema10 instanceof external_exports.ZodLiteral) {
    const value = def.value;
    const t = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
    return withDesc({ type: t, enum: [value] }, description);
  }
  if (schema10 instanceof external_exports.ZodArray) {
    const inner = def.type;
    return withDesc({ type: "array", items: convert(inner) }, description);
  }
  if (schema10 instanceof external_exports.ZodObject) {
    const shape = schema10.shape;
    const properties = {};
    const required = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = convert(value);
      if (!isOptional(value)) required.push(key);
    }
    const result = {
      type: "object",
      properties
    };
    if (required.length) result.required = required;
    return withDesc(result, description);
  }
  if (schema10 instanceof external_exports.ZodOptional || schema10 instanceof external_exports.ZodDefault) {
    const inner = def.innerType;
    return convert(inner);
  }
  if (schema10 instanceof external_exports.ZodNullable) {
    const inner = def.innerType;
    const conv = convert(inner);
    if (Array.isArray(conv.type)) return withDesc(conv, description);
    return withDesc({ ...conv, type: [conv.type, "null"] }, description);
  }
  if (schema10 instanceof external_exports.ZodUnion) {
    const options = def.options;
    return withDesc({ anyOf: options.map(convert) }, description);
  }
  if (schema10 instanceof external_exports.ZodRecord) {
    const value = def.valueType;
    return withDesc(
      { type: "object", additionalProperties: convert(value) },
      description
    );
  }
  return withDesc({}, description);
}
function isOptional(schema10) {
  return schema10 instanceof external_exports.ZodOptional || schema10 instanceof external_exports.ZodDefault;
}
function withDesc(obj, description) {
  if (description) return { ...obj, description };
  return obj;
}

// ../src/tools/registry.ts
function normalizeToolName(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
var ToolRegistry = class {
  tools = /* @__PURE__ */ new Map();
  register(tool) {
    this.tools.set(tool.name, tool);
  }
  unregister(name) {
    return this.tools.delete(name);
  }
  get(name) {
    const direct = this.tools.get(name);
    if (direct) return direct;
    const target = normalizeToolName(name);
    for (const [k, v] of this.tools) {
      if (normalizeToolName(k) === target) return v;
    }
    return void 0;
  }
  has(name) {
    return !!this.get(name);
  }
  list() {
    return [...this.tools.values()];
  }
  /** Serialize all enabled tools into the function-calling schema (OpenAI/Ollama shape). */
  toolSchema() {
    return this.list().filter((t) => t.isEnabled()).map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.jsonSchemaOverride ?? zodToJsonSchema(t.inputSchema)
      }
    }));
  }
  /** @deprecated Use `toolSchema()` — same shape, neutral name. */
  ollamaSchema() {
    return this.toolSchema();
  }
};

// ../src/config/permissions.ts
var import_promises2 = __toESM(require("node:fs/promises"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);
var import_node_os2 = __toESM(require("node:os"), 1);
var HARDCODED_DENY = [
  {
    tool: "Bash",
    test: (args) => {
      const cmd = String(args.command ?? "");
      if (/\brm\s+-rf?\s+\/([\s]|$)/.test(cmd)) return { match: true, reason: "rm -rf /" };
      if (/\brm\s+-rf?\s+~\/?([\s]|$)/.test(cmd)) return { match: true, reason: "wiping home" };
      if (/\brm\s+-rf?\s+\*([\s]|$)/.test(cmd)) return { match: true, reason: "wiping with glob" };
      if (/:\s*\(\s*\)\s*\{[^}]*:\s*\|\s*:\s*&\s*\}\s*;/.test(cmd)) return { match: true, reason: "fork bomb" };
      if (/\bmkfs\.[a-z0-9]+\b/.test(cmd)) return { match: true, reason: "format filesystem" };
      if (/\bdd\b[^|]*\bif=[^|]*\bof=\/dev\/(sd|nvme|hd)/.test(cmd))
        return { match: true, reason: "disk overwrite" };
      if (/\bgit\s+push\s+(-f\b|--force(-with-lease)?\b).*\b(main|master)\b/.test(cmd))
        return { match: true, reason: "force push to main/master" };
      if (/\bcurl\b.*\|\s*(sudo\s+)?bash/.test(cmd))
        return { match: true, reason: "pipe-to-bash install" };
      if (/\bchmod\s+[0-7]*777\b/.test(cmd))
        return { match: true, reason: "chmod 777" };
      return { match: false };
    }
  }
];
var ALWAYS_ALLOW_TOOLS = /* @__PURE__ */ new Set(["Read", "Grep", "Glob", "WebSearch", "WebFetch"]);
function projectSettingsPath(cwd) {
  return import_node_path2.default.join(cwd, ".reno", "settings.json");
}
function globalSettingsPath() {
  return import_node_path2.default.join(import_node_os2.default.homedir(), ".reno", "settings.json");
}
async function readJsonSafe(p) {
  try {
    const txt = await import_promises2.default.readFile(p, "utf8");
    return JSON.parse(txt);
  } catch {
    return {};
  }
}
async function writeJson(p, data) {
  await import_promises2.default.mkdir(import_node_path2.default.dirname(p), { recursive: true });
  await import_promises2.default.writeFile(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}
function parseRule(rule) {
  const m = rule.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\((.*)\))?$/);
  if (!m) return { tool: rule };
  return { tool: m[1], pattern: m[2] };
}
function matchBash(pattern, command) {
  if (pattern.startsWith("/") && pattern.endsWith("/")) {
    try {
      return new RegExp(pattern.slice(1, -1)).test(command);
    } catch {
      return false;
    }
  }
  if (pattern.endsWith(":*")) {
    const prefix = pattern.slice(0, -2);
    return command === prefix || command.startsWith(prefix + " ");
  }
  return pattern === command;
}
function matchPath(pattern, p) {
  const normP = p.replace(/\\/g, "/");
  const normPattern = pattern.replace(/\\/g, "/");
  if (normPattern === normP) return true;
  if (normPattern.endsWith("/**")) {
    const pre = normPattern.slice(0, -3);
    return normP === pre || normP.startsWith(pre + "/");
  }
  if (normPattern.endsWith("/*")) {
    const pre = normPattern.slice(0, -2);
    return normP.startsWith(pre + "/") && !normP.slice(pre.length + 1).includes("/");
  }
  if (normPattern.endsWith("*")) {
    return normP.startsWith(normPattern.slice(0, -1));
  }
  if (normPattern.startsWith("*.")) {
    return normP.endsWith(normPattern.slice(1));
  }
  if (normPattern.includes("?")) {
    const regex = new RegExp("^" + normPattern.replace(/\?/g, ".").replace(/\*/g, ".*") + "$");
    return regex.test(normP);
  }
  return false;
}
function matchGrep(pattern, query) {
  if (pattern === "*") return true;
  return query.includes(pattern);
}
function matchRule(rule, tool, args) {
  const parsed = parseRule(rule);
  if (parsed.tool !== tool) return false;
  if (!parsed.pattern) return true;
  if (tool === "Bash") return matchBash(parsed.pattern, String(args.command ?? ""));
  if (tool === "Write" || tool === "Edit" || tool === "Read" || tool === "multi_replace_file_content" || tool === "replace_file_content" || tool === "write_to_file" || tool === "view_file") {
    const file = String(args.file_path ?? args.TargetFile ?? args.AbsolutePath ?? args.TargetFile ?? "");
    return matchPath(parsed.pattern, file);
  }
  if (tool === "Grep") {
    return matchGrep(parsed.pattern, String(args.pattern ?? ""));
  }
  if (tool === "Glob") {
    return matchPath(parsed.pattern, String(args.pattern ?? ""));
  }
  return false;
}
function suggestRule(tool, args, scope, cwd = process.cwd()) {
  if (tool === "Bash") {
    const cmd = String(args.command ?? "").trim();
    const tokens = cmd.split(/\s+/);
    const first = tokens[0] ?? "";
    const multiSub = /* @__PURE__ */ new Set([
      "npm",
      "pnpm",
      "yarn",
      "bun",
      "git",
      "pip",
      "pip3",
      "cargo",
      "docker",
      "kubectl",
      "brew",
      "go",
      "rustup",
      "deno"
    ]);
    if (multiSub.has(first) && tokens[1] && !tokens[1].startsWith("-")) {
      return `Bash(${first} ${tokens[1]}:*)`;
    }
    return `Bash(${first}:*)`;
  }
  if (tool === "Write" || tool === "Edit" || tool === "multi_replace_file_content" || tool === "replace_file_content" || tool === "write_to_file") {
    if (scope === "session") {
      return tool;
    }
    const file = String(args.file_path ?? args.TargetFile ?? "");
    const normFile = file.replace(/\\/g, "/");
    const normCwd = cwd.replace(/\\/g, "/");
    if (scope === "project" && normFile.startsWith(normCwd + "/")) {
      return `${tool}(${normCwd}/**)`;
    }
    return `${tool}(${normFile})`;
  }
  return tool;
}
var PermissionEngine = class {
  cwd;
  session;
  project = {};
  global = {};
  _mode = "normal";
  /**
   * Tools that MUST prompt every invocation, regardless of any session /
   * project / global allow rules. Used for irreversible side-effects like
   * sending mail or posting chats — we never want a user's earlier "yes
   * for the session" to silently dispatch a subsequent send.
   */
  alwaysPrompt = /* @__PURE__ */ new Set();
  constructor(cwd) {
    this.cwd = cwd;
    this.session = { allow: /* @__PURE__ */ new Set(), deny: /* @__PURE__ */ new Set(), bypassAll: false };
  }
  /** Mark a tool as requiring a fresh prompt every call. */
  addAlwaysPromptTool(toolName) {
    this.alwaysPrompt.add(toolName);
  }
  /** Remove a tool from the always-prompt set. */
  removeAlwaysPromptTool(toolName) {
    this.alwaysPrompt.delete(toolName);
  }
  isAlwaysPrompt(toolName) {
    return this.alwaysPrompt.has(toolName);
  }
  get mode() {
    if (this.session.bypassAll || this.project.bypassAll || this.global.bypassAll) return "bypass";
    return this._mode;
  }
  setMode(mode) {
    this._mode = mode;
    this.session.bypassAll = mode === "bypass";
  }
  cycleMode() {
    const order = ["normal", "accept-edits", "bypass"];
    const i = order.indexOf(this.mode);
    const next = order[(i + 1) % order.length];
    this.setMode(next);
    return next;
  }
  async load() {
    this.project = await readJsonSafe(projectSettingsPath(this.cwd));
    this.global = await readJsonSafe(globalSettingsPath());
  }
  get bypassAll() {
    return this.session.bypassAll || !!this.project.bypassAll || !!this.global.bypassAll;
  }
  setSessionBypass(on) {
    this.session.bypassAll = on;
  }
  addSessionAllow(rule) {
    this.session.allow.add(rule);
  }
  addSessionDeny(rule) {
    this.session.deny.add(rule);
  }
  /** Remove a session rule. */
  removeSessionRule(kind, rule) {
    return kind === "allow" ? this.session.allow.delete(rule) : this.session.deny.delete(rule);
  }
  async addPersistedRule(scope, kind, rule) {
    const file = scope === "project" ? projectSettingsPath(this.cwd) : globalSettingsPath();
    const current = scope === "project" ? this.project : this.global;
    current.permissions = current.permissions ?? {};
    const list = current.permissions[kind] = current.permissions[kind] ?? [];
    if (!list.includes(rule)) list.push(rule);
    await writeJson(file, current);
  }
  /** Remove a persisted rule. */
  async removePersistedRule(scope, kind, rule) {
    const file = scope === "project" ? projectSettingsPath(this.cwd) : globalSettingsPath();
    const current = scope === "project" ? this.project : this.global;
    const list = current.permissions?.[kind];
    if (!list) return false;
    const idx = list.indexOf(rule);
    if (idx === -1) return false;
    list.splice(idx, 1);
    await writeJson(file, current);
    return true;
  }
  async setPersistedBypass(scope, on) {
    const file = scope === "project" ? projectSettingsPath(this.cwd) : globalSettingsPath();
    const current = scope === "project" ? this.project : this.global;
    current.bypassAll = on;
    await writeJson(file, current);
  }
  /** Get all rules across all scopes for display. */
  allRules() {
    const out = [];
    for (const r of this.session.allow) out.push({ scope: "session", kind: "allow", rule: r });
    for (const r of this.session.deny) out.push({ scope: "session", kind: "deny", rule: r });
    for (const r of this.project.permissions?.allow ?? []) out.push({ scope: "project", kind: "allow", rule: r });
    for (const r of this.project.permissions?.deny ?? []) out.push({ scope: "project", kind: "deny", rule: r });
    for (const r of this.global.permissions?.allow ?? []) out.push({ scope: "global", kind: "allow", rule: r });
    for (const r of this.global.permissions?.deny ?? []) out.push({ scope: "global", kind: "deny", rule: r });
    return out;
  }
  snapshot() {
    return {
      session: {
        allow: [...this.session.allow],
        deny: [...this.session.deny],
        bypassAll: this.session.bypassAll
      },
      project: this.project,
      global: this.global
    };
  }
  suggestRule(tool, args, scope) {
    return suggestRule(tool, args, scope, this.cwd);
  }
  decide(tool, args) {
    for (const rule of HARDCODED_DENY) {
      if (rule.tool !== tool) continue;
      const r = rule.test(args);
      if (r.match) {
        return { kind: "auto-deny", reason: `safety rule: ${r.reason}`, locked: true };
      }
    }
    if (ALWAYS_ALLOW_TOOLS.has(tool)) {
      return { kind: "auto-allow", reason: "read-only tool" };
    }
    if (this.bypassAll) return { kind: "auto-allow", reason: "bypass mode" };
    if (this._mode === "accept-edits" && (tool === "Write" || tool === "Edit")) {
      return { kind: "auto-allow", reason: "accept-edits mode" };
    }
    const matches = (rules) => !!rules && rules.some((r) => matchRule(r, tool, args));
    if ([...this.session.deny].some((r) => matchRule(r, tool, args)))
      return { kind: "auto-deny", reason: "session deny" };
    if (matches(this.project.permissions?.deny))
      return { kind: "auto-deny", reason: "project deny" };
    if (matches(this.global.permissions?.deny))
      return { kind: "auto-deny", reason: "global deny" };
    if (this.alwaysPrompt.has(tool)) {
      return { kind: "prompt" };
    }
    if ([...this.session.allow].some((r) => matchRule(r, tool, args)))
      return { kind: "auto-allow", reason: "session allow" };
    if (matches(this.project.permissions?.allow))
      return { kind: "auto-allow", reason: "project allow" };
    if (matches(this.global.permissions?.allow))
      return { kind: "auto-allow", reason: "global allow" };
    return { kind: "prompt" };
  }
};

// ../src/session/stats.ts
var import_promises5 = __toESM(require("node:fs/promises"), 1);
var import_node_path5 = __toESM(require("node:path"), 1);
var SessionStats = class {
  id;
  startedAt;
  cwd;
  turns = [];
  requests = 0;
  lastPrompt = 0;
  currentModel;
  constructor(model, cwd) {
    this.currentModel = model;
    this.cwd = cwd;
    this.startedAt = Date.now();
    const iso = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    this.id = `${iso}_${process.pid}`;
  }
  recordTurn(partial) {
    const rec = {
      at: Date.now(),
      model: partial.model,
      promptTokens: partial.promptTokens ?? 0,
      completionTokens: partial.completionTokens ?? 0,
      apiMs: partial.apiMs ?? 0,
      toolCalls: partial.toolCalls ?? []
    };
    this.turns.push(rec);
    this.requests += 1;
    if (rec.promptTokens) this.lastPrompt = rec.promptTokens;
  }
  setLastPromptTokens(n) {
    if (n > 0) this.lastPrompt = n;
  }
  get lastPromptTokens() {
    return this.lastPrompt;
  }
  totals() {
    const toolCounts = {};
    let prompt = 0, completion = 0, apiMs = 0;
    for (const t of this.turns) {
      prompt += t.promptTokens;
      completion += t.completionTokens;
      apiMs += t.apiMs;
      for (const n of t.toolCalls) toolCounts[n] = (toolCounts[n] ?? 0) + 1;
    }
    return {
      turns: this.turns.length,
      requests: this.requests,
      promptTokens: prompt,
      completionTokens: completion,
      apiMs,
      wallMs: Date.now() - this.startedAt,
      toolCounts
    };
  }
  rollup() {
    const t = this.totals();
    return {
      id: this.id,
      model: this.currentModel,
      cwd: this.cwd,
      startedAt: this.startedAt,
      endedAt: Date.now(),
      lastPromptTokens: this.lastPrompt,
      ...t
    };
  }
  async persist() {
    if (this.turns.length === 0) return;
    const { sessionDir: sessionDir2 } = await Promise.resolve().then(() => (init_projectStore(), projectStore_exports));
    const dir = sessionDir2(this.cwd);
    await import_promises5.default.mkdir(dir, { recursive: true });
    await import_promises5.default.writeFile(
      import_node_path5.default.join(dir, `${this.id}.json`),
      JSON.stringify(this.rollup(), null, 2),
      "utf8"
    );
  }
};

// ../src/state/AppState.ts
function createInitialAppState(args) {
  return {
    finalized: [],
    streamingAssistant: "",
    streamingReasoning: "",
    activeTool: null,
    busy: false,
    thinking: { verb: null, startedAt: 0 },
    currentModel: args.model,
    contextLength: void 0,
    promptTokens: 0,
    completionTokens: 0,
    lastPromptTokens: 0,
    bypassAll: args.bypassAll,
    editMode: args.editMode,
    pendingPermission: null,
    overlay: "none",
    planMode: false,
    worktreePath: null,
    tasks: {}
  };
}

// ../src/agent/quota.ts
function fmtNum(n) {
  if (n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return n;
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(v);
}
function fmtReset(secs) {
  if (secs == null) return null;
  const v = Number(secs);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 3600) return `${Math.round(v / 3600)}h`;
  if (v >= 60) return `${Math.round(v / 60)}m`;
  return `${Math.round(v)}s`;
}
function parseRateLimitHeaders(h) {
  const retryAfter = h.get("retry-after");
  const aReq = h.get("anthropic-ratelimit-requests-remaining");
  const aIn = h.get("anthropic-ratelimit-input-tokens-remaining");
  const aOut = h.get("anthropic-ratelimit-output-tokens-remaining");
  const aReset = h.get("anthropic-ratelimit-tokens-reset") ?? h.get("anthropic-ratelimit-requests-reset");
  if (aReq != null || aIn != null || aOut != null) {
    const parts = [];
    if (aReq != null) parts.push(`${fmtNum(aReq)} req`);
    const tok = aIn ?? aOut;
    if (tok != null) parts.push(`${fmtNum(tok)} tok`);
    const reset = fmtReset(aReset);
    let summary = parts.join(" \xB7 ") + " left";
    if (reset) summary += ` \xB7 resets ${reset}`;
    return {
      available: true,
      summary,
      detail: {
        requestsRemaining: aReq ?? "-",
        inputTokensRemaining: aIn ?? "-",
        outputTokensRemaining: aOut ?? "-"
      }
    };
  }
  const xReq = h.get("x-ratelimit-remaining-requests");
  const xTok = h.get("x-ratelimit-remaining-tokens");
  const xReset = h.get("x-ratelimit-reset-tokens") ?? h.get("x-ratelimit-reset-requests");
  if (xReq != null || xTok != null) {
    const parts = [];
    if (xReq != null) parts.push(`${fmtNum(xReq)} req`);
    if (xTok != null) parts.push(`${fmtNum(xTok)} tok`);
    const reset = fmtReset(xReset);
    let summary = parts.join(" \xB7 ") + " left";
    if (reset) summary += ` \xB7 resets ${reset}`;
    return {
      available: true,
      summary,
      detail: {
        requestsRemaining: xReq ?? "-",
        tokensRemaining: xTok ?? "-"
      }
    };
  }
  const oRem = h.get("x-ollama-quota-remaining");
  const oLim = h.get("x-ollama-quota-limit");
  const oReset = h.get("x-ollama-quota-reset");
  if (oRem != null || oLim != null) {
    let summary = oLim != null ? `${fmtNum(oRem)}/${fmtNum(oLim)} left` : `${fmtNum(oRem)} left`;
    const reset = fmtReset(oReset);
    if (reset) summary += ` \xB7 resets ${reset}`;
    return {
      available: true,
      summary,
      detail: { remaining: oRem ?? "-", limit: oLim ?? "-", used: h.get("x-ollama-quota-used") ?? "-" }
    };
  }
  if (retryAfter != null) {
    return { available: true, summary: `rate-limited \xB7 retry in ${fmtReset(retryAfter) ?? retryAfter}` };
  }
  return null;
}

// ../src/agent/quotaCache.ts
var cache = /* @__PURE__ */ new Map();
function quotaKey(host, apiKey) {
  return `${host ?? ""}::${apiKey ? apiKey.slice(-6) : ""}`;
}
function recordQuota(key, status) {
  cache.set(key, status);
}
function clearQuota(key) {
  cache.delete(key);
}
function getRecordedQuota(key) {
  return cache.get(key);
}

// ../src/agent/providers/ollama.ts
var DEFAULT_HOST = "http://localhost:11434";
function buildHeaders(apiKey) {
  const headers = { "Content-Type": "application/json" };
  const key = apiKey ?? process.env.OLLAMA_API_KEY;
  if (key) headers["Authorization"] = `Bearer ${key}`;
  return headers;
}
function cleanMessage(m) {
  const out = { role: m.role, content: m.content };
  if (m.tool_calls && m.tool_calls.length) out.tool_calls = m.tool_calls;
  if (m.tool_name) out.tool_name = m.tool_name;
  return out;
}
var OllamaProvider = class {
  info;
  host;
  apiKey;
  constructor(opts = {}) {
    this.host = opts.host ?? DEFAULT_HOST;
    this.apiKey = opts.apiKey;
    this.info = {
      name: "ollama",
      host: this.host,
      isCloud: this.host.includes("ollama.com")
    };
  }
  async *streamChat(opts) {
    const body = {
      model: opts.model,
      messages: opts.messages.map(cleanMessage),
      tools: opts.tools && opts.tools.length ? opts.tools : void 0,
      stream: true,
      options: opts.options
    };
    if (opts.think !== void 0) body.think = opts.think;
    let res;
    try {
      res = await fetch(`${this.host}/api/chat`, {
        method: "POST",
        headers: buildHeaders(this.apiKey),
        body: JSON.stringify(body),
        signal: opts.signal
      });
    } catch (e) {
      if (opts.signal?.aborted) return;
      const msg2 = e instanceof Error ? e.message : String(e);
      throw new Error(`Cannot reach Ollama at ${this.host}. Is it running? (${msg2})`);
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) {
        let msg2 = text;
        try {
          const j2 = JSON.parse(text);
          if (j2?.error) msg2 = j2.error;
        } catch {
        }
        recordQuota(quotaKey(this.host, this.apiKey), {
          available: false,
          summary: "\u26A0 session limit reached \u2014 upgrade",
          detail: { error: msg2 }
        });
        throw new Error(`Ollama: ${msg2}`);
      }
      throw new Error(`Ollama HTTP ${res.status}: ${text}`);
    }
    clearQuota(quotaKey(this.host, this.apiKey));
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        if (opts.signal?.aborted) {
          await reader.cancel().catch(() => {
          });
          return;
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          try {
            yield JSON.parse(line);
          } catch {
          }
        }
      }
      const tail = buffer.trim();
      if (tail) {
        try {
          yield JSON.parse(tail);
        } catch {
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
      }
    }
  }
  async listModels() {
    const res = await fetch(`${this.host}/api/tags`, {
      headers: buildHeaders(this.apiKey),
      signal: AbortSignal.timeout(5e3)
    });
    if (!res.ok) throw new Error(`Ollama /api/tags returned ${res.status}`);
    const data = await res.json();
    return (data.models ?? []).map((m) => m.name);
  }
  async getModelInfo(model) {
    const res = await fetch(`${this.host}/api/show`, {
      method: "POST",
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(5e3)
    });
    if (!res.ok) throw new Error(`Ollama /api/show returned ${res.status}`);
    const data = await res.json();
    const info = data.model_info ?? {};
    let ctx;
    for (const [k, v] of Object.entries(info)) {
      if (k.endsWith(".context_length") && typeof v === "number") {
        ctx = v;
        break;
      }
    }
    return {
      name: model,
      contextLength: ctx,
      parameterSize: data.details?.parameter_size,
      family: data.details?.family
    };
  }
  async getQuota() {
    if (!this.info.isCloud) return { available: false, summary: "N/A (local)" };
    const recorded = getRecordedQuota(quotaKey(this.host, this.apiKey));
    if (recorded) return recorded;
    try {
      const res = await fetch(`${this.host}/api/tags`, {
        headers: buildHeaders(this.apiKey),
        signal: AbortSignal.timeout(5e3)
      });
      const parsed = parseRateLimitHeaders(res.headers);
      if (parsed) return parsed;
      if (res.status === 401 || res.status === 403) {
        return { available: false, summary: "\u26A0 auth failed" };
      }
      if (!res.ok) return { available: false, summary: `HTTP ${res.status}` };
      return { available: false, summary: "usage \u2192 ollama.com/settings (no API)" };
    } catch {
      return { available: false, summary: "\u26A0 probe failed" };
    }
  }
  supportsThinking(model) {
    const m = model.toLowerCase();
    return m.includes("deepseek-r1") || m.includes("qwen3") || m.includes("qwq") || m.includes("o1") || m.includes("gpt-oss") || m.includes("magistral") || m.includes("glm") || m.includes("reasoning") || m.includes("thinking");
  }
  stripThinkingTags(s) {
    return s.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<think>[\s\S]*$/g, "");
  }
};

// ../src/agent/providers/index.ts
function getProvider(name, opts = {}) {
  switch (name) {
    case "ollama":
      return new OllamaProvider(opts);
    case "openai":
      throw new Error(
        'Provider "openai" not yet implemented. Add src/agent/providers/openai.ts and wire it here.'
      );
    case "gemini":
      throw new Error(
        'Provider "gemini" not yet implemented. Add src/agent/providers/gemini.ts and wire it here.'
      );
    default: {
      const _exhaustive = name;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}

// ../src/tools/read.ts
var import_promises6 = __toESM(require("node:fs/promises"), 1);
var import_node_path6 = __toESM(require("node:path"), 1);

// ../src/tools/Tool.ts
var DEFAULTS = {
  isReadOnly: (_input) => false,
  isConcurrencySafe: (_input) => false,
  isDestructive: (_input) => false,
  isEnabled: () => true
};
function buildTool(def) {
  const isReadOnly = def.isReadOnly ?? DEFAULTS.isReadOnly;
  const isDestructive = def.isDestructive ?? DEFAULTS.isDestructive;
  const isConcurrencySafe = def.isConcurrencySafe ?? ((input) => isReadOnly(input));
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    call: def.call,
    validateInput: def.validateInput,
    checkPermissions: def.checkPermissions,
    getPath: def.getPath,
    getActivityDescription: def.getActivityDescription,
    renderToolUse: def.renderToolUse,
    renderToolResult: def.renderToolResult,
    jsonSchemaOverride: def.jsonSchemaOverride,
    isReadOnly,
    isConcurrencySafe,
    isDestructive,
    isEnabled: def.isEnabled ?? DEFAULTS.isEnabled,
    // Write/Edit/Bash/Delete all require permission by default.
    // Read-only non-destructive tools do not.
    get requiresPermission() {
      return !isReadOnly({}) || isDestructive({});
    }
  };
}

// ../src/tools/read.ts
var schema = external_exports.object({
  file_path: external_exports.string().describe("Absolute path to the file to read"),
  offset: external_exports.number().optional().describe("1-indexed line number to start from (default 1)"),
  limit: external_exports.number().optional().describe("Number of lines to read (default 2000)")
});
var readTool = buildTool({
  name: "Read",
  description: "Read a file from the filesystem. Returns content with line numbers in cat -n style. Use offset/limit for large files.",
  inputSchema: schema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getPath: (input) => input.file_path,
  getActivityDescription: (input) => `Reading ${import_node_path6.default.basename(input.file_path)}`,
  renderToolUse: (input) => `Read ${input.file_path}`,
  async call(input, ctx) {
    const abs = import_node_path6.default.isAbsolute(input.file_path) ? input.file_path : import_node_path6.default.resolve(ctx.cwd, input.file_path);
    const stat2 = await import_promises6.default.stat(abs);
    if (stat2.isDirectory()) {
      const entries = await import_promises6.default.readdir(abs, { withFileTypes: true });
      return entries.map((e) => e.isDirectory() ? `${e.name}/` : e.name).sort().join("\n");
    }
    const content = await import_promises6.default.readFile(abs, "utf8");
    await ctx.fileStateCache.markRead(abs, content);
    const offset = input.offset ?? 1;
    const limit = input.limit ?? 2e3;
    const lines = content.split("\n");
    const start = Math.max(0, offset - 1);
    const end = Math.min(lines.length, start + limit);
    const numbered = lines.slice(start, end).map((line, i) => `${String(start + i + 1).padStart(6)}	${line}`).join("\n");
    const suffix = end < lines.length ? `
... (${lines.length - end} more lines, pass offset=${end + 1})` : "";
    return numbered + suffix;
  }
});

// ../src/tools/grep.ts
var import_node_child_process2 = require("node:child_process");
var MAX_OUTPUT = 3e4;
var IS_WINDOWS = process.platform === "win32";
var schema2 = external_exports.object({
  pattern: external_exports.string().describe("Regex pattern"),
  path: external_exports.string().optional().describe("File or directory to search (default = cwd)"),
  glob: external_exports.string().optional().describe("Glob filter, e.g. '*.ts'"),
  case_insensitive: external_exports.boolean().optional(),
  context: external_exports.number().optional().describe("Lines of context around each match")
});
function runCmd(bin, args, signal) {
  return new Promise((resolve2, reject) => {
    const child = (0, import_node_child_process2.spawn)(bin, args);
    let stdout = "";
    let stderr = "";
    const onAbort = () => child.kill();
    signal.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (d) => stdout += d.toString());
    child.stderr.on("data", (d) => stderr += d.toString());
    child.on("close", (code) => {
      signal.removeEventListener("abort", onAbort);
      resolve2({ code: code ?? 0, stdout, stderr });
    });
    child.on("error", (err) => {
      signal.removeEventListener("abort", onAbort);
      reject(err);
    });
  });
}
function cap(s) {
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + "\n...[truncated]" : s;
}
async function windowsFallback(pattern, target, globFilter, caseI, ctx, signal) {
  const safePattern = pattern.replace(/'/g, "''");
  const safePath = target.replace(/'/g, "''");
  const include = globFilter ? `-Include '${globFilter.replace(/'/g, "''")}'` : "";
  const ciFlag = caseI ? "" : "-CaseSensitive";
  const ctxFlag = ctx > 0 ? `-Context ${ctx},${ctx}` : "";
  const psCmd = `Get-ChildItem -Path '${safePath}' -Recurse -File ${include} | Select-String -Pattern '${safePattern}' ${ciFlag} ${ctxFlag} | ForEach-Object { $_.Path + ':' + $_.LineNumber + ':' + $_.Line } | Select-Object -First 500`;
  const res = await runCmd(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", psCmd],
    signal
  );
  const out = res.stdout.trim();
  return out ? cap(out) : "(no matches)";
}
async function unixFallback(pattern, target, globFilter, caseI, signal) {
  const grArgs = ["-rn", "--color=never"];
  if (caseI) grArgs.push("-i");
  if (globFilter) grArgs.push("--include", globFilter);
  grArgs.push("-e", pattern, target);
  const res = await runCmd("grep", grArgs, signal);
  const out = res.stdout.trim();
  return out ? cap(out) : "(no matches)";
}
var grepTool = buildTool({
  name: "Grep",
  description: "Search file contents with ripgrep. Returns lines as `path:lineno:match`. Prefer this over `Bash grep`. Falls back to PowerShell Select-String (Windows) or grep (Linux/Mac) if rg is missing.",
  inputSchema: schema2,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Grepping ${input.pattern}`,
  renderToolUse: (input) => `Grep ${input.pattern}${input.glob ? ` (${input.glob})` : ""}`,
  async call(input, ctx) {
    const target = input.path ?? ".";
    const caseI = input.case_insensitive ?? false;
    const contextLines = input.context ?? 0;
    const rgArgs = ["--color=never", "-n", "--no-heading"];
    if (caseI) rgArgs.push("-i");
    if (contextLines > 0) rgArgs.push("-C", String(contextLines));
    if (input.glob) rgArgs.push("-g", input.glob);
    rgArgs.push("-e", input.pattern, target);
    try {
      const res = await runCmd("rg", rgArgs, ctx.abortController.signal);
      const out = res.stdout.trim();
      if (out) return cap(out);
      return "(no matches)";
    } catch {
      if (IS_WINDOWS) {
        return windowsFallback(
          input.pattern,
          target,
          input.glob,
          caseI,
          contextLines,
          ctx.abortController.signal
        );
      }
      return unixFallback(
        input.pattern,
        target,
        input.glob,
        caseI,
        ctx.abortController.signal
      );
    }
  }
});

// ../src/tools/glob.ts
var import_promises7 = __toESM(require("node:fs/promises"), 1);
var import_node_path7 = __toESM(require("node:path"), 1);
var schema3 = external_exports.object({
  pattern: external_exports.string().describe("Glob pattern (supports ** recursion)"),
  path: external_exports.string().optional().describe("Directory to search in (default = cwd)")
});
function globToRegex(pattern) {
  const p = pattern.replace(/\\/g, "/");
  let re = "";
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    if (c === "*" && p[i + 1] === "*") {
      re += ".*";
      i += 2;
      if (p[i] === "/") i++;
    } else if (c === "*") {
      re += "[^/]*";
      i++;
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else if (c !== void 0 && /[.+^${}()|[\]\\]/.test(c)) {
      re += "\\" + c;
      i++;
    } else {
      re += c;
      i++;
    }
  }
  return new RegExp("^" + re + "$");
}
var globTool = buildTool({
  name: "Glob",
  description: "Find files matching a glob pattern (supports ** recursion). Returns up to 200 paths, newest first. Example patterns: '**/*.ts', 'src/**/*.tsx', '*.md'.",
  inputSchema: schema3,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Globbing ${input.pattern}`,
  renderToolUse: (input) => `Glob ${input.pattern}`,
  async call(input, ctx) {
    const cwd = input.path ?? ctx.cwd;
    const absCwd = import_node_path7.default.isAbsolute(cwd) ? cwd : import_node_path7.default.resolve(ctx.cwd, cwd);
    const regex = globToRegex(input.pattern);
    try {
      const entries = await import_promises7.default.readdir(absCwd, { recursive: true, withFileTypes: true });
      const matching = [];
      for (const e of entries) {
        if (!e.isFile()) continue;
        const parentDir = e.parentPath ?? e.path ?? absCwd;
        const fullPath = import_node_path7.default.join(parentDir, e.name);
        const relPath = import_node_path7.default.relative(absCwd, fullPath).replace(/\\/g, "/");
        if (regex.test(relPath)) matching.push(fullPath);
      }
      if (matching.length === 0) return "(no matches)";
      const withMtime = await Promise.all(
        matching.slice(0, 500).map(async (p) => {
          try {
            const s = await import_promises7.default.stat(p);
            return { p, mtime: s.mtimeMs };
          } catch {
            return { p, mtime: 0 };
          }
        })
      );
      withMtime.sort((a, b) => b.mtime - a.mtime);
      return withMtime.slice(0, 200).map((x) => {
        const rel = import_node_path7.default.relative(absCwd, x.p).replace(/\\/g, "/");
        return rel && !rel.startsWith("..") ? rel : x.p.replace(/\\/g, "/");
      }).join("\n");
    } catch (e) {
      const msg2 = e instanceof Error ? e.message : String(e);
      return `glob failed: ${msg2}`;
    }
  }
});

// ../src/tools/webFetch.ts
var schema4 = external_exports.object({
  url: external_exports.string().url().describe("Absolute http(s) URL to fetch"),
  format: external_exports.enum(["text", "html", "raw"]).optional().describe("text (default): strip tags + collapse whitespace; html: keep tags; raw: bytes as utf-8"),
  max_chars: external_exports.number().int().positive().optional().describe("Truncate the response body to this many characters (default 50_000)")
});
var DEFAULT_MAX = 5e4;
var TIMEOUT_MS = 2e4;
function htmlToText(html) {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--([\s\S]*?)-->/g, " ");
  s = s.replace(/<\/?(p|br|div|h[1-6]|li|tr|article|section|hr)[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}
var webFetchTool = buildTool({
  name: "WebFetch",
  description: "Fetch a web page over http(s) and return its content. Default format is plain text (HTML stripped). Useful for documentation lookups.",
  inputSchema: schema4,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Fetching ${input.url}`,
  renderToolUse: (input) => `WebFetch ${input.url}`,
  async call(input) {
    const max = input.max_chars ?? DEFAULT_MAX;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(input.url, {
        method: "GET",
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "reno/0.3 (+https://github.com/)",
          Accept: "text/html, text/plain, application/json, */*"
        }
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} from ${input.url}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    let out;
    if (input.format === "raw" || input.format === "html") {
      out = body;
    } else if (contentType.includes("application/json")) {
      try {
        out = JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        out = body;
      }
    } else if (contentType.includes("text/html") || /<html[\s>]/i.test(body)) {
      out = htmlToText(body);
    } else {
      out = body;
    }
    if (out.length > max) {
      out = out.slice(0, max) + `
\u2026[truncated at ${max} chars; full length ${body.length}]`;
    }
    return `${input.url}  (${contentType || "?"})  ${out.length} chars

${out}`;
  }
});

// ../src/tools/webSearch.ts
var schema5 = external_exports.object({
  query: external_exports.string().min(1).describe("Search query"),
  max_results: external_exports.number().int().positive().max(20).optional().describe("Max results to return (default 10, max 20)")
});
async function searchDDG(query, max) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15e3);
  let html;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; reno/0.3; +https://github.com/)",
        Accept: "text/html"
      },
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`DDG returned HTTP ${res.status}`);
    html = await res.text();
  } finally {
    clearTimeout(timeout);
  }
  const hits = [];
  const blockRe = /<div[^>]*class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/g;
  for (const m of html.match(blockRe) ?? []) {
    const titleMatch = m.match(
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
    );
    const snippetMatch = m.match(
      /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/
    );
    if (!titleMatch) continue;
    const rawHref = titleMatch[1];
    let resolvedUrl = rawHref;
    const uddg = rawHref.match(/[?&]uddg=([^&]+)/);
    if (uddg) {
      try {
        resolvedUrl = decodeURIComponent(uddg[1]);
      } catch {
      }
    }
    const title = stripTags(titleMatch[2]).trim();
    const snippet = snippetMatch ? stripTags(snippetMatch[1]).trim() : "";
    if (title && resolvedUrl.startsWith("http")) {
      hits.push({ title, url: resolvedUrl, snippet });
      if (hits.length >= max) break;
    }
  }
  return hits;
}
function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ");
}
var webSearchTool = buildTool({
  name: "WebSearch",
  description: "Search the web. Returns title / URL / snippet for the top matches. Backed by DuckDuckGo HTML; no API key required.",
  inputSchema: schema5,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Searching: ${input.query}`,
  renderToolUse: (input) => `WebSearch ${JSON.stringify(input.query)}`,
  async call(input) {
    const max = input.max_results ?? 10;
    const hits = await searchDDG(input.query, max);
    if (hits.length === 0) return `(no results for ${JSON.stringify(input.query)})`;
    return hits.map((h, i) => `${i + 1}. ${h.title}
   ${h.url}${h.snippet ? `
   ${h.snippet}` : ""}`).join("\n\n");
  }
});

// ../src/tools/sleep.ts
var schema6 = external_exports.object({
  ms: external_exports.number().int().min(0).max(6e4).describe("Milliseconds to sleep (max 60_000)")
});
var sleepTool = buildTool({
  name: "Sleep",
  description: "Pause for the given number of milliseconds. Useful in scripted demos and rate-limited polling.",
  inputSchema: schema6,
  isReadOnly: () => true,
  isConcurrencySafe: () => false,
  getActivityDescription: (input) => `Sleeping ${input.ms}ms`,
  renderToolUse: (input) => `Sleep ${input.ms}ms`,
  async call(input, ctx) {
    await new Promise((resolve2, reject) => {
      const timer = setTimeout(resolve2, input.ms);
      ctx.abortController.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Error("aborted"));
        },
        { once: true }
      );
    });
    return `slept ${input.ms}ms`;
  }
});

// ../src/tools/todo.ts
var itemSchema = external_exports.object({
  content: external_exports.string().describe("Imperative form, e.g. 'Run tests'"),
  activeForm: external_exports.string().optional().describe("Present continuous, e.g. 'Running tests'"),
  status: external_exports.enum(["pending", "in_progress", "completed"])
});
var schema7 = external_exports.object({
  todos: external_exports.array(itemSchema)
});
var state = { todos: [] };
function renderTodos(todos) {
  if (!todos.length) return "(no tasks)";
  return todos.map((t) => {
    const mark = t.status === "completed" ? "[x]" : t.status === "in_progress" ? "[~]" : "[ ]";
    const label = t.status === "in_progress" && t.activeForm ? t.activeForm : t.content;
    return `${mark} ${label}`;
  }).join("\n");
}
var todoTool = buildTool({
  name: "TodoWrite",
  description: "Replace the entire task list. Send the full updated list each time. Keep exactly one item in_progress. Mark items completed immediately after finishing.",
  inputSchema: schema7,
  isReadOnly: () => true,
  // writes in-memory state, not files — safe to parallelize
  isConcurrencySafe: () => false,
  // but not concurrent with itself
  getActivityDescription: () => "Updating task list",
  renderToolUse: (input) => `TodoWrite (${input.todos.length} items)`,
  async call(input) {
    state.todos = input.todos;
    return renderTodos(input.todos);
  }
});

// ../src/tools/planMode.ts
var enterSchema = external_exports.object({
  reason: external_exports.string().optional().describe("Optional one-line explanation of why plan mode is being entered")
});
var exitSchema = external_exports.object({});
var enterPlanModeTool = buildTool({
  name: "EnterPlanMode",
  description: "Enter plan mode. While active, Write/Edit/Bash tools will be blocked \u2014 only read-only exploration tools may run. Use this when you want to research and propose a plan before any mutations.",
  inputSchema: enterSchema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,
  getActivityDescription: () => "Entering plan mode",
  renderToolUse: () => "EnterPlanMode",
  async call(input, ctx) {
    ctx.setAppState((s) => ({ ...s, planMode: true }));
    return `Plan mode ON.${input.reason ? ` Reason: ${input.reason}` : ""} Mutating tools (Write/Edit/Bash) are blocked until ExitPlanMode.`;
  }
});
var exitPlanModeTool = buildTool({
  name: "ExitPlanMode",
  description: "Exit plan mode. Mutating tools become available again. Call this only after the user has approved the plan.",
  inputSchema: exitSchema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,
  getActivityDescription: () => "Exiting plan mode",
  renderToolUse: () => "ExitPlanMode",
  async call(_input, ctx) {
    ctx.setAppState((s) => ({ ...s, planMode: false }));
    return "Plan mode OFF. Mutating tools are available.";
  }
});

// ../src/tools/worktree.ts
var import_node_child_process3 = require("node:child_process");
var import_node_util2 = require("node:util");
var import_node_path8 = __toESM(require("node:path"), 1);
var exec2 = (0, import_node_util2.promisify)(import_node_child_process3.execFile);
var enterSchema2 = external_exports.object({
  branch: external_exports.string().describe("Branch name to check out into the new worktree"),
  path: external_exports.string().optional().describe("Worktree path (default: ../<repo>-<branch> next to current repo)"),
  create_branch: external_exports.boolean().optional().describe("If the branch does not exist, create it (default false)")
});
var exitSchema2 = external_exports.object({
  path: external_exports.string().optional().describe("Worktree path to remove (default: the active one tracked in app state)"),
  force: external_exports.boolean().optional().describe("Pass --force to git worktree remove")
});
async function git(args, cwd) {
  try {
    const { stdout } = await exec2("git", args, { cwd, timeout: 3e4 });
    return stdout.trim();
  } catch (e) {
    const stderr = e.stderr ?? "";
    throw new Error(`git ${args.join(" ")} failed: ${stderr || (e instanceof Error ? e.message : String(e))}`);
  }
}
var enterWorktreeTool = buildTool({
  name: "EnterWorktree",
  description: "Create a git worktree for a separate branch and remember its path in app state. Useful for experiments that should not touch the main checkout. Run from inside a git repo.",
  inputSchema: enterSchema2,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,
  getActivityDescription: (input) => `Creating worktree for ${input.branch}`,
  renderToolUse: (input) => `EnterWorktree ${input.branch}${input.path ? ` at ${input.path}` : ""}`,
  async call(input, ctx) {
    await git(["rev-parse", "--show-toplevel"], ctx.cwd);
    const repoRoot = await git(["rev-parse", "--show-toplevel"], ctx.cwd);
    const repoName = import_node_path8.default.basename(repoRoot);
    const wtPath = input.path ?? import_node_path8.default.resolve(repoRoot, "..", `${repoName}-${input.branch}`);
    const args = ["worktree", "add"];
    if (input.create_branch) args.push("-b", input.branch);
    args.push(wtPath);
    if (!input.create_branch) args.push(input.branch);
    const out = await git(args, ctx.cwd);
    ctx.setAppState((s) => ({ ...s, worktreePath: wtPath }));
    return `worktree at ${wtPath}
${out}`;
  }
});
var exitWorktreeTool = buildTool({
  name: "ExitWorktree",
  description: "Remove a git worktree. By default removes the worktree tracked in app state (set by EnterWorktree).",
  inputSchema: exitSchema2,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => true,
  getActivityDescription: (input) => `Removing worktree ${input.path ?? "(active)"}`,
  renderToolUse: (input) => `ExitWorktree ${input.path ?? "(active)"}`,
  async call(input, ctx) {
    const target = input.path ?? ctx.getAppState().worktreePath;
    if (!target) {
      throw new Error("No active worktree tracked in app state; pass `path` explicitly.");
    }
    const args = ["worktree", "remove"];
    if (input.force) args.push("--force");
    args.push(target);
    const out = await git(args, ctx.cwd);
    ctx.setAppState((s) => ({
      ...s,
      worktreePath: s.worktreePath === target ? null : s.worktreePath
    }));
    return `removed worktree ${target}
${out}`;
  }
});

// ../src/tools/notebookEdit.ts
var import_promises8 = __toESM(require("node:fs/promises"), 1);
var import_node_path9 = __toESM(require("node:path"), 1);
var schema8 = external_exports.object({
  file_path: external_exports.string().describe("Absolute path to a .ipynb file"),
  cell_id: external_exports.string().optional().describe("Existing cell id to target. Omit when mode=insert to append at end."),
  mode: external_exports.enum(["replace", "insert", "delete"]).describe("replace: rewrite cell.source; insert: add a new cell; delete: remove cell"),
  cell_type: external_exports.enum(["code", "markdown", "raw"]).optional().describe("Cell type (only for insert; default: code)"),
  source: external_exports.string().optional().describe("New source for the cell (required for replace/insert)")
});
function genId() {
  return Math.random().toString(36).slice(2, 10);
}
function toSourceArray(s) {
  const lines = s.split("\n");
  return lines.map((l, i) => i === lines.length - 1 ? l : l + "\n");
}
var notebookEditTool = buildTool({
  name: "NotebookEdit",
  description: "Edit cells in a Jupyter (.ipynb) notebook. Supports replace, insert, and delete on a specific cell id (or end-of-notebook for insert with no id).",
  inputSchema: schema8,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: (input) => input.mode === "delete",
  getPath: (input) => input.file_path,
  getActivityDescription: (input) => `${input.mode} cell in ${import_node_path9.default.basename(input.file_path)}`,
  renderToolUse: (input) => `NotebookEdit ${input.mode} ${input.cell_id ?? "(end)"} in ${input.file_path}`,
  async validateInput(input) {
    if (input.mode !== "delete" && input.source === void 0) {
      return { ok: false, message: `mode=${input.mode} requires source` };
    }
    if (input.mode !== "insert" && !input.cell_id) {
      return { ok: false, message: `mode=${input.mode} requires cell_id` };
    }
    return { ok: true };
  },
  async call(input, ctx) {
    const abs = import_node_path9.default.isAbsolute(input.file_path) ? input.file_path : import_node_path9.default.resolve(ctx.cwd, input.file_path);
    const raw = await import_promises8.default.readFile(abs, "utf8");
    let nb;
    try {
      nb = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Could not parse notebook JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!Array.isArray(nb.cells)) throw new Error("Notebook has no cells array");
    const findIdx = () => input.cell_id ? nb.cells.findIndex((c) => c.id === input.cell_id) : -1;
    if (input.mode === "delete") {
      const idx = findIdx();
      if (idx === -1) throw new Error(`cell_id ${input.cell_id} not found`);
      nb.cells.splice(idx, 1);
    } else if (input.mode === "replace") {
      const idx = findIdx();
      if (idx === -1) throw new Error(`cell_id ${input.cell_id} not found`);
      nb.cells[idx].source = toSourceArray(input.source);
      if (nb.cells[idx].cell_type === "code") {
        nb.cells[idx].outputs = [];
        nb.cells[idx].execution_count = null;
      }
    } else {
      const newCell = {
        cell_type: input.cell_type ?? "code",
        source: toSourceArray(input.source),
        metadata: {},
        id: genId()
      };
      if (newCell.cell_type === "code") {
        newCell.outputs = [];
        newCell.execution_count = null;
      }
      const idx = input.cell_id ? findIdx() + 1 : nb.cells.length;
      if (input.cell_id && idx === 0) throw new Error(`cell_id ${input.cell_id} not found`);
      nb.cells.splice(idx, 0, newCell);
    }
    await import_promises8.default.writeFile(abs, JSON.stringify(nb, null, 1) + "\n", "utf8");
    return `${input.mode} OK \u2014 notebook now has ${nb.cells.length} cells`;
  }
});

// ../src/mcp/config.ts
var import_promises9 = __toESM(require("node:fs/promises"), 1);
var import_node_path10 = __toESM(require("node:path"), 1);
var import_node_os4 = __toESM(require("node:os"), 1);
function userMcpPaths() {
  const home = import_node_os4.default.homedir();
  return [
    import_node_path10.default.join(home, ".reno", "mcp.json")
  ];
}
function projectMcpPaths(cwd) {
  return [
    import_node_path10.default.join(cwd, ".reno", "mcp.json")
  ];
}
async function readJsonSafe3(p) {
  try {
    const txt = await import_promises9.default.readFile(p, "utf8");
    return JSON.parse(txt);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw new Error(`MCP config ${p} is invalid: ${e instanceof Error ? e.message : String(e)}`);
  }
}
async function loadMcpConfig(cwd) {
  const merged = {};
  const allPaths = [...userMcpPaths(), ...projectMcpPaths(cwd)];
  for (const p of allPaths) {
    const f = await readJsonSafe3(p);
    if (!f?.servers) continue;
    for (const [name, cfg] of Object.entries(f.servers)) {
      merged[name] = cfg;
    }
  }
  return Object.entries(merged).map(([name, config2]) => ({ name, config: config2 }));
}

// ../src/mcp/client.ts
async function connectMcpServer(server) {
  const sdkClient = await import("@modelcontextprotocol/sdk/client/index.js");
  const ClientCtor = sdkClient.Client;
  const transport = await buildTransport(server.config);
  const client = new ClientCtor(
    { name: "reno", version: "0.3.0-dev" },
    { capabilities: {} }
  );
  const c = client;
  await c.connect(transport);
  let tools = [];
  try {
    const resp = await c.listTools();
    tools = resp.tools ?? [];
  } catch {
    tools = [];
  }
  return {
    serverName: server.name,
    client,
    tools,
    close: () => c.close()
  };
}
async function buildTransport(config2) {
  if (config2.type === "stdio") {
    const stdio = await import("@modelcontextprotocol/sdk/client/stdio.js");
    return new stdio.StdioClientTransport({
      command: config2.command,
      args: config2.args,
      env: { ...process.env, ...config2.env ?? {} },
      cwd: config2.cwd
    });
  }
  const http = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const headers = { ...config2.headers ?? {} };
  if (config2.token) headers.Authorization = `Bearer ${config2.token}`;
  return new http.StreamableHTTPClientTransport(new URL(config2.url), {
    requestInit: { headers }
  });
}
async function callMcpTool(connection, toolName, args) {
  const c = connection.client;
  const resp = await c.callTool({ name: toolName, arguments: args });
  const parts = [];
  for (const item of resp.content ?? []) {
    if (item.type === "text" && item.text) parts.push(item.text);
    else parts.push(`[non-text content: ${item.type}]`);
  }
  const out = parts.join("\n");
  if (resp.isError) throw new Error(out || "MCP tool returned isError without text");
  return out;
}

// ../src/mcp/loader.ts
var connections = [];
async function loadMcpServers(cwd) {
  return loadMcpConfig(cwd);
}
async function registerMcpTools(registry, servers) {
  let count = 0;
  for (const server of servers) {
    try {
      const conn = await connectMcpServer(server);
      connections.push(conn);
      for (const desc of conn.tools) {
        registry.register(buildMcpToolWrapper(conn, desc));
        count++;
      }
    } catch (e) {
      process.stderr.write(
        `  \u26A0 MCP server "${server.name}" failed to connect: ${e instanceof Error ? e.message : String(e)}
`
      );
    }
  }
  return count;
}
function buildMcpToolWrapper(conn, desc) {
  const toolName = `mcp__${conn.serverName}__${desc.name}`;
  return buildTool({
    name: toolName,
    description: desc.description ?? `(MCP) ${desc.name} on ${conn.serverName}`,
    // Permissive zod schema for the runtime parser — the model receives the
    // server's real JSON schema via jsonSchemaOverride below.
    inputSchema: external_exports.record(external_exports.unknown()),
    jsonSchemaOverride: desc.inputSchema ?? { type: "object", additionalProperties: true },
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => false,
    getActivityDescription: () => `Calling ${conn.serverName}/${desc.name}`,
    renderToolUse: () => `${toolName}`,
    async call(input) {
      return callMcpTool(conn, desc.name, input);
    }
  });
}
async function closeAllMcp() {
  await Promise.allSettled(connections.map((c) => c.close()));
  connections.length = 0;
}

// src/runtime/EngineHost.ts
init_transcript();
var import_node_crypto4 = require("node:crypto");

// src/config/vsConfig.ts
var vscode2 = __toESM(require("vscode"));

// src/commands/secretStorage.ts
var vscode = __toESM(require("vscode"));
var OLLAMA_API_KEY = "reno.ollamaApiKey";
function registerSecretCommands(ctx) {
  ctx.subscriptions.push(
    vscode.commands.registerCommand("reno.setOllamaApiKey", async () => {
      const value = await vscode.window.showInputBox({
        title: "reno: set Ollama Cloud API key",
        password: true,
        placeHolder: "ollama_\u2026",
        prompt: "Stored encrypted in VS Code's SecretStorage. Get a key at https://ollama.com/settings/keys"
      });
      if (value === void 0) return;
      if (!value.trim()) {
        await ctx.secrets.delete(OLLAMA_API_KEY);
        vscode.window.showInformationMessage("reno: API key cleared.");
        return;
      }
      await ctx.secrets.store(OLLAMA_API_KEY, value);
      vscode.window.showInformationMessage("reno: API key saved to SecretStorage.");
    }),
    vscode.commands.registerCommand("reno.clearOllamaApiKey", async () => {
      await ctx.secrets.delete(OLLAMA_API_KEY);
      vscode.window.showInformationMessage("reno: API key cleared.");
    })
  );
}
async function readSecretApiKey(ctx) {
  return await ctx.secrets.get(OLLAMA_API_KEY);
}

// src/config/vsConfig.ts
var DEFAULT_LOCAL_HOST = "http://localhost:11434";
var CLOUD_HOST = "https://ollama.com";
async function loadVsConfig(ctx) {
  const cfg = vscode2.workspace.getConfiguration("reno");
  const model = cfg.get("model")?.trim();
  const settingsKey = cfg.get("ollama.apiKey")?.trim();
  const secret = ctx ? await readSecretApiKey(ctx) : void 0;
  const apiKey = secret || settingsKey || void 0;
  const mode = cfg.get("permissionMode") || "normal";
  const rawHost = cfg.get("ollama.host")?.trim();
  const userCustomizedHost = !!rawHost && rawHost !== DEFAULT_LOCAL_HOST;
  const ollamaHost = userCustomizedHost ? rawHost : apiKey ? CLOUD_HOST : DEFAULT_LOCAL_HOST;
  return {
    provider: "ollama",
    model: model ? model : void 0,
    ollamaHost,
    ollamaApiKey: apiKey,
    autoCompact: cfg.get("autoCompact") ?? true,
    permissionMode: ["normal", "accept-edits", "bypass"].includes(mode) ? mode : "normal"
  };
}

// src/runtime/PermissionBridge.ts
var PermissionBridge = class {
  pending = /* @__PURE__ */ new Map();
  notify;
  constructor(notify) {
    this.notify = notify;
  }
  /** Plug into QueryEngine via setRequestPermission. */
  prompt = (req) => {
    return new Promise((resolve2) => {
      const entry = {
        toolUseId: req.toolUseId,
        name: req.name,
        args: req.args,
        suggestedRules: req.suggestedRules,
        resolve: resolve2
      };
      this.pending.set(req.toolUseId, entry);
      this.notify({
        toolUseId: req.toolUseId,
        name: req.name,
        args: req.args,
        suggestedRules: req.suggestedRules
      });
      const onAbort = () => {
        const p = this.pending.get(req.toolUseId);
        if (!p) return;
        this.pending.delete(req.toolUseId);
        p.resolve("no");
      };
      req.signal.addEventListener("abort", onAbort, { once: true });
    });
  };
  /** Webview replied. */
  resolve(toolUseId, choice) {
    const p = this.pending.get(toolUseId);
    if (!p) return;
    this.pending.delete(toolUseId);
    p.resolve(choice);
  }
  /** Resolve any pending requests as "no" (e.g. on view dispose). */
  cancelAll() {
    for (const p of this.pending.values()) p.resolve("no");
    this.pending.clear();
  }
};

// src/runtime/DiffPreviewRegistry.ts
var vscode3 = __toESM(require("vscode"));
var SCHEME = "reno-diff";
var DiffPreviewRegistry = class _DiffPreviewRegistry {
  staged = /* @__PURE__ */ new Map();
  emitter = new vscode3.EventEmitter();
  onDidChange = this.emitter.event;
  static register(ctx) {
    const registry = new _DiffPreviewRegistry();
    ctx.subscriptions.push(
      vscode3.workspace.registerTextDocumentContentProvider(SCHEME, registry)
    );
    return registry;
  }
  provideTextDocumentContent(uri) {
    const [side, toolUseId] = uri.path.split("/");
    if (!toolUseId) return "";
    const e = this.staged.get(toolUseId);
    if (!e) return "";
    return side === "before" ? e.before : e.after;
  }
  stage(toolUseId, filePath, before, after) {
    this.staged.set(toolUseId, { before, after, filePath });
    this.emitter.fire(this.uriFor(toolUseId, "before"));
    this.emitter.fire(this.uriFor(toolUseId, "after"));
  }
  clear(toolUseId) {
    this.staged.delete(toolUseId);
  }
  uriFor(toolUseId, side) {
    const e = this.staged.get(toolUseId);
    const ext = e ? extOf(e.filePath) : "txt";
    return vscode3.Uri.parse(
      `${SCHEME}:/${side}/${toolUseId}/${encodeURIComponent(
        e ? basename2(e.filePath) : "file"
      )}.${ext}`
    );
  }
  async openDiff(toolUseId) {
    const e = this.staged.get(toolUseId);
    if (!e) return;
    const before = this.uriFor(toolUseId, "before");
    const after = this.uriFor(toolUseId, "after");
    await vscode3.commands.executeCommand(
      "vscode.diff",
      before,
      after,
      `reno: ${basename2(e.filePath)} (proposed)`
    );
  }
};
function basename2(p) {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}
function extOf(p) {
  const b = basename2(p);
  const i = b.lastIndexOf(".");
  return i > 0 ? b.slice(i + 1) : "txt";
}

// src/runtime/VsCodeWriteAdapter.ts
var vscode4 = __toESM(require("vscode"));
var fs15 = __toESM(require("node:fs/promises"));
var path15 = __toESM(require("node:path"));

// node_modules/zod/v3/external.js
var external_exports2 = {};
__export(external_exports2, {
  BRAND: () => BRAND2,
  DIRTY: () => DIRTY2,
  EMPTY_PATH: () => EMPTY_PATH2,
  INVALID: () => INVALID2,
  NEVER: () => NEVER2,
  OK: () => OK2,
  ParseStatus: () => ParseStatus2,
  Schema: () => ZodType2,
  ZodAny: () => ZodAny2,
  ZodArray: () => ZodArray2,
  ZodBigInt: () => ZodBigInt2,
  ZodBoolean: () => ZodBoolean2,
  ZodBranded: () => ZodBranded2,
  ZodCatch: () => ZodCatch2,
  ZodDate: () => ZodDate2,
  ZodDefault: () => ZodDefault2,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion2,
  ZodEffects: () => ZodEffects2,
  ZodEnum: () => ZodEnum2,
  ZodError: () => ZodError2,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind2,
  ZodFunction: () => ZodFunction2,
  ZodIntersection: () => ZodIntersection2,
  ZodIssueCode: () => ZodIssueCode2,
  ZodLazy: () => ZodLazy2,
  ZodLiteral: () => ZodLiteral2,
  ZodMap: () => ZodMap2,
  ZodNaN: () => ZodNaN2,
  ZodNativeEnum: () => ZodNativeEnum2,
  ZodNever: () => ZodNever2,
  ZodNull: () => ZodNull2,
  ZodNullable: () => ZodNullable2,
  ZodNumber: () => ZodNumber2,
  ZodObject: () => ZodObject2,
  ZodOptional: () => ZodOptional2,
  ZodParsedType: () => ZodParsedType2,
  ZodPipeline: () => ZodPipeline2,
  ZodPromise: () => ZodPromise2,
  ZodReadonly: () => ZodReadonly2,
  ZodRecord: () => ZodRecord2,
  ZodSchema: () => ZodType2,
  ZodSet: () => ZodSet2,
  ZodString: () => ZodString2,
  ZodSymbol: () => ZodSymbol2,
  ZodTransformer: () => ZodEffects2,
  ZodTuple: () => ZodTuple2,
  ZodType: () => ZodType2,
  ZodUndefined: () => ZodUndefined2,
  ZodUnion: () => ZodUnion2,
  ZodUnknown: () => ZodUnknown2,
  ZodVoid: () => ZodVoid2,
  addIssueToContext: () => addIssueToContext2,
  any: () => anyType2,
  array: () => arrayType2,
  bigint: () => bigIntType2,
  boolean: () => booleanType2,
  coerce: () => coerce2,
  custom: () => custom2,
  date: () => dateType2,
  datetimeRegex: () => datetimeRegex2,
  defaultErrorMap: () => en_default2,
  discriminatedUnion: () => discriminatedUnionType2,
  effect: () => effectsType2,
  enum: () => enumType2,
  function: () => functionType2,
  getErrorMap: () => getErrorMap2,
  getParsedType: () => getParsedType2,
  instanceof: () => instanceOfType2,
  intersection: () => intersectionType2,
  isAborted: () => isAborted2,
  isAsync: () => isAsync2,
  isDirty: () => isDirty2,
  isValid: () => isValid2,
  late: () => late2,
  lazy: () => lazyType2,
  literal: () => literalType2,
  makeIssue: () => makeIssue2,
  map: () => mapType2,
  nan: () => nanType2,
  nativeEnum: () => nativeEnumType2,
  never: () => neverType2,
  null: () => nullType2,
  nullable: () => nullableType2,
  number: () => numberType2,
  object: () => objectType2,
  objectUtil: () => objectUtil2,
  oboolean: () => oboolean2,
  onumber: () => onumber2,
  optional: () => optionalType2,
  ostring: () => ostring2,
  pipeline: () => pipelineType2,
  preprocess: () => preprocessType2,
  promise: () => promiseType2,
  quotelessJson: () => quotelessJson2,
  record: () => recordType2,
  set: () => setType2,
  setErrorMap: () => setErrorMap2,
  strictObject: () => strictObjectType2,
  string: () => stringType2,
  symbol: () => symbolType2,
  transformer: () => effectsType2,
  tuple: () => tupleType2,
  undefined: () => undefinedType2,
  union: () => unionType2,
  unknown: () => unknownType2,
  util: () => util2,
  void: () => voidType2
});

// node_modules/zod/v3/helpers/util.js
var util2;
(function(util3) {
  util3.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util3.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util3.assertNever = assertNever;
  util3.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util3.getValidEnumValues = (obj) => {
    const validKeys = util3.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util3.objectValues(filtered);
  };
  util3.objectValues = (obj) => {
    return util3.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util3.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util3.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util3.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util3.joinValues = joinValues;
  util3.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util2 || (util2 = {}));
var objectUtil2;
(function(objectUtil3) {
  objectUtil3.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil2 || (objectUtil2 = {}));
var ZodParsedType2 = util2.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType2 = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType2.undefined;
    case "string":
      return ZodParsedType2.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType2.nan : ZodParsedType2.number;
    case "boolean":
      return ZodParsedType2.boolean;
    case "function":
      return ZodParsedType2.function;
    case "bigint":
      return ZodParsedType2.bigint;
    case "symbol":
      return ZodParsedType2.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType2.array;
      }
      if (data === null) {
        return ZodParsedType2.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType2.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType2.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType2.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType2.date;
      }
      return ZodParsedType2.object;
    default:
      return ZodParsedType2.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode2 = util2.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson2 = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError2 = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util2.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError2.create = (issues) => {
  const error = new ZodError2(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap2 = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode2.invalid_type:
      if (issue.received === ZodParsedType2.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode2.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util2.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode2.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util2.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode2.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode2.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util2.joinValues(issue.options)}`;
      break;
    case ZodIssueCode2.invalid_enum_value:
      message = `Invalid enum value. Expected ${util2.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode2.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode2.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode2.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode2.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util2.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode2.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode2.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode2.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode2.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode2.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode2.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util2.assertNever(issue);
  }
  return { message };
};
var en_default2 = errorMap2;

// node_modules/zod/v3/errors.js
var overrideErrorMap2 = en_default2;
function setErrorMap2(map) {
  overrideErrorMap2 = map;
}
function getErrorMap2() {
  return overrideErrorMap2;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue2 = (params) => {
  const { data, path: path17, errorMaps, issueData } = params;
  const fullPath = [...path17, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH2 = [];
function addIssueToContext2(ctx, issueData) {
  const overrideMap = getErrorMap2();
  const issue = makeIssue2({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default2 ? void 0 : en_default2
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus2 = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID2;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID2;
      if (value.status === "aborted")
        return INVALID2;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID2 = Object.freeze({
  status: "aborted"
});
var DIRTY2 = (value) => ({ status: "dirty", value });
var OK2 = (value) => ({ status: "valid", value });
var isAborted2 = (x) => x.status === "aborted";
var isDirty2 = (x) => x.status === "dirty";
var isValid2 = (x) => x.status === "valid";
var isAsync2 = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil2;
(function(errorUtil3) {
  errorUtil3.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil3.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil2 || (errorUtil2 = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath2 = class {
  constructor(parent, value, path17, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path17;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult2 = (ctx, result) => {
  if (isValid2(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError2(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams2(params) {
  if (!params)
    return {};
  const { errorMap: errorMap3, invalid_type_error, required_error, description } = params;
  if (errorMap3 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap3)
    return { errorMap: errorMap3, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType2 = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType2(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType2(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus2(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType2(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync2(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType2(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult2(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType2(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid2(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid2(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType2(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync2(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult2(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode2.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects2({
      schema: this,
      typeName: ZodFirstPartyTypeKind2.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional2.create(this, this._def);
  }
  nullable() {
    return ZodNullable2.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray2.create(this);
  }
  promise() {
    return ZodPromise2.create(this, this._def);
  }
  or(option) {
    return ZodUnion2.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection2.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects2({
      ...processCreateParams2(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind2.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault2({
      ...processCreateParams2(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind2.ZodDefault
    });
  }
  brand() {
    return new ZodBranded2({
      typeName: ZodFirstPartyTypeKind2.ZodBranded,
      type: this,
      ...processCreateParams2(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch2({
      ...processCreateParams2(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind2.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline2.create(this, target);
  }
  readonly() {
    return ZodReadonly2.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex2 = /^c[^\s-]{8,}$/i;
var cuid2Regex2 = /^[0-9a-z]+$/;
var ulidRegex2 = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex2 = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex2 = /^[a-z0-9_-]{21}$/i;
var jwtRegex2 = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex2 = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex2 = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex2 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex2;
var ipv4Regex2 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex2 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex2 = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex2 = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex2 = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex2 = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource2 = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex2 = new RegExp(`^${dateRegexSource2}$`);
function timeRegexSource2(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex2(args) {
  return new RegExp(`^${timeRegexSource2(args)}$`);
}
function datetimeRegex2(args) {
  let regex = `${dateRegexSource2}T${timeRegexSource2(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP2(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex2.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex2.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT2(jwt, alg) {
  if (!jwtRegex2.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr2(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex2.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex2.test(ip)) {
    return true;
  }
  return false;
}
var ZodString2 = class _ZodString extends ZodType2 {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext2(ctx2, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.string,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    const status = new ParseStatus2();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext2(ctx, {
              code: ZodIssueCode2.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext2(ctx, {
              code: ZodIssueCode2.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "email",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex2) {
          emojiRegex2 = new RegExp(_emojiRegex2, "u");
        }
        if (!emojiRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "emoji",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "uuid",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "nanoid",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "cuid",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "cuid2",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "ulid",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "url",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "regex",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex2(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex2;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex2(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "duration",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP2(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "ip",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT2(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "jwt",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr2(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "cidr",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "base64",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "base64url",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode2.invalid_string,
      ...errorUtil2.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil2.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil2.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil2.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil2.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil2.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil2.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil2.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil2.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil2.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil2.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil2.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil2.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil2.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil2.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil2.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil2.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil2.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil2.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil2.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil2.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil2.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil2.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil2.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil2.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString2.create = (params) => {
  return new ZodString2({
    checks: [],
    typeName: ZodFirstPartyTypeKind2.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams2(params)
  });
};
function floatSafeRemainder2(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber2 = class _ZodNumber extends ZodType2 {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext2(ctx2, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.number,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    let ctx = void 0;
    const status = new ParseStatus2();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util2.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder2(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil2.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil2.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil2.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil2.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil2.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil2.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil2.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil2.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil2.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil2.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil2.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil2.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil2.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil2.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util2.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber2.create = (params) => {
  return new ZodNumber2({
    checks: [],
    typeName: ZodFirstPartyTypeKind2.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams2(params)
  });
};
var ZodBigInt2 = class _ZodBigInt extends ZodType2 {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus2();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext2(ctx, {
      code: ZodIssueCode2.invalid_type,
      expected: ZodParsedType2.bigint,
      received: ctx.parsedType
    });
    return INVALID2;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil2.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil2.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil2.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil2.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil2.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil2.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil2.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil2.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil2.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil2.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt2.create = (params) => {
  return new ZodBigInt2({
    checks: [],
    typeName: ZodFirstPartyTypeKind2.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams2(params)
  });
};
var ZodBoolean2 = class extends ZodType2 {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.boolean,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
};
ZodBoolean2.create = (params) => {
  return new ZodBoolean2({
    typeName: ZodFirstPartyTypeKind2.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams2(params)
  });
};
var ZodDate2 = class _ZodDate extends ZodType2 {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext2(ctx2, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.date,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext2(ctx2, {
        code: ZodIssueCode2.invalid_date
      });
      return INVALID2;
    }
    const status = new ParseStatus2();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil2.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil2.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate2.create = (params) => {
  return new ZodDate2({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind2.ZodDate,
    ...processCreateParams2(params)
  });
};
var ZodSymbol2 = class extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.symbol,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
};
ZodSymbol2.create = (params) => {
  return new ZodSymbol2({
    typeName: ZodFirstPartyTypeKind2.ZodSymbol,
    ...processCreateParams2(params)
  });
};
var ZodUndefined2 = class extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.undefined,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
};
ZodUndefined2.create = (params) => {
  return new ZodUndefined2({
    typeName: ZodFirstPartyTypeKind2.ZodUndefined,
    ...processCreateParams2(params)
  });
};
var ZodNull2 = class extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.null,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
};
ZodNull2.create = (params) => {
  return new ZodNull2({
    typeName: ZodFirstPartyTypeKind2.ZodNull,
    ...processCreateParams2(params)
  });
};
var ZodAny2 = class extends ZodType2 {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK2(input.data);
  }
};
ZodAny2.create = (params) => {
  return new ZodAny2({
    typeName: ZodFirstPartyTypeKind2.ZodAny,
    ...processCreateParams2(params)
  });
};
var ZodUnknown2 = class extends ZodType2 {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK2(input.data);
  }
};
ZodUnknown2.create = (params) => {
  return new ZodUnknown2({
    typeName: ZodFirstPartyTypeKind2.ZodUnknown,
    ...processCreateParams2(params)
  });
};
var ZodNever2 = class extends ZodType2 {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext2(ctx, {
      code: ZodIssueCode2.invalid_type,
      expected: ZodParsedType2.never,
      received: ctx.parsedType
    });
    return INVALID2;
  }
};
ZodNever2.create = (params) => {
  return new ZodNever2({
    typeName: ZodFirstPartyTypeKind2.ZodNever,
    ...processCreateParams2(params)
  });
};
var ZodVoid2 = class extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.void,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
};
ZodVoid2.create = (params) => {
  return new ZodVoid2({
    typeName: ZodFirstPartyTypeKind2.ZodVoid,
    ...processCreateParams2(params)
  });
};
var ZodArray2 = class _ZodArray extends ZodType2 {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType2.array) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.array,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext2(ctx, {
          code: tooBig ? ZodIssueCode2.too_big : ZodIssueCode2.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext2(ctx, {
          code: ZodIssueCode2.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext2(ctx, {
          code: ZodIssueCode2.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath2(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus2.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath2(ctx, item, ctx.path, i));
    });
    return ParseStatus2.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil2.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil2.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil2.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray2.create = (schema10, params) => {
  return new ZodArray2({
    type: schema10,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind2.ZodArray,
    ...processCreateParams2(params)
  });
};
function deepPartialify2(schema10) {
  if (schema10 instanceof ZodObject2) {
    const newShape = {};
    for (const key in schema10.shape) {
      const fieldSchema = schema10.shape[key];
      newShape[key] = ZodOptional2.create(deepPartialify2(fieldSchema));
    }
    return new ZodObject2({
      ...schema10._def,
      shape: () => newShape
    });
  } else if (schema10 instanceof ZodArray2) {
    return new ZodArray2({
      ...schema10._def,
      type: deepPartialify2(schema10.element)
    });
  } else if (schema10 instanceof ZodOptional2) {
    return ZodOptional2.create(deepPartialify2(schema10.unwrap()));
  } else if (schema10 instanceof ZodNullable2) {
    return ZodNullable2.create(deepPartialify2(schema10.unwrap()));
  } else if (schema10 instanceof ZodTuple2) {
    return ZodTuple2.create(schema10.items.map((item) => deepPartialify2(item)));
  } else {
    return schema10;
  }
}
var ZodObject2 = class _ZodObject extends ZodType2 {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util2.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext2(ctx2, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.object,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever2 && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath2(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever2) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath2(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus2.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus2.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil2.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil2.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind2.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema10) {
    return this.augment({ [key]: schema10 });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util2.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util2.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify2(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util2.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util2.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional2) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum2(util2.objectKeys(this.shape));
  }
};
ZodObject2.create = (shape, params) => {
  return new ZodObject2({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever2.create(),
    typeName: ZodFirstPartyTypeKind2.ZodObject,
    ...processCreateParams2(params)
  });
};
ZodObject2.strictCreate = (shape, params) => {
  return new ZodObject2({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever2.create(),
    typeName: ZodFirstPartyTypeKind2.ZodObject,
    ...processCreateParams2(params)
  });
};
ZodObject2.lazycreate = (shape, params) => {
  return new ZodObject2({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever2.create(),
    typeName: ZodFirstPartyTypeKind2.ZodObject,
    ...processCreateParams2(params)
  });
};
var ZodUnion2 = class extends ZodType2 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError2(result.ctx.common.issues));
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_union,
        unionErrors
      });
      return INVALID2;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError2(issues2));
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_union,
        unionErrors
      });
      return INVALID2;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion2.create = (types, params) => {
  return new ZodUnion2({
    options: types,
    typeName: ZodFirstPartyTypeKind2.ZodUnion,
    ...processCreateParams2(params)
  });
};
var getDiscriminator2 = (type) => {
  if (type instanceof ZodLazy2) {
    return getDiscriminator2(type.schema);
  } else if (type instanceof ZodEffects2) {
    return getDiscriminator2(type.innerType());
  } else if (type instanceof ZodLiteral2) {
    return [type.value];
  } else if (type instanceof ZodEnum2) {
    return type.options;
  } else if (type instanceof ZodNativeEnum2) {
    return util2.objectValues(type.enum);
  } else if (type instanceof ZodDefault2) {
    return getDiscriminator2(type._def.innerType);
  } else if (type instanceof ZodUndefined2) {
    return [void 0];
  } else if (type instanceof ZodNull2) {
    return [null];
  } else if (type instanceof ZodOptional2) {
    return [void 0, ...getDiscriminator2(type.unwrap())];
  } else if (type instanceof ZodNullable2) {
    return [null, ...getDiscriminator2(type.unwrap())];
  } else if (type instanceof ZodBranded2) {
    return getDiscriminator2(type.unwrap());
  } else if (type instanceof ZodReadonly2) {
    return getDiscriminator2(type.unwrap());
  } else if (type instanceof ZodCatch2) {
    return getDiscriminator2(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion2 = class _ZodDiscriminatedUnion extends ZodType2 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.object) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.object,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID2;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator2(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind2.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams2(params)
    });
  }
};
function mergeValues2(a, b) {
  const aType = getParsedType2(a);
  const bType = getParsedType2(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType2.object && bType === ZodParsedType2.object) {
    const bKeys = util2.objectKeys(b);
    const sharedKeys = util2.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues2(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType2.array && bType === ZodParsedType2.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues2(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType2.date && bType === ZodParsedType2.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection2 = class extends ZodType2 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted2(parsedLeft) || isAborted2(parsedRight)) {
        return INVALID2;
      }
      const merged = mergeValues2(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext2(ctx, {
          code: ZodIssueCode2.invalid_intersection_types
        });
        return INVALID2;
      }
      if (isDirty2(parsedLeft) || isDirty2(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection2.create = (left, right, params) => {
  return new ZodIntersection2({
    left,
    right,
    typeName: ZodFirstPartyTypeKind2.ZodIntersection,
    ...processCreateParams2(params)
  });
};
var ZodTuple2 = class _ZodTuple extends ZodType2 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.array) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.array,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID2;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema10 = this._def.items[itemIndex] || this._def.rest;
      if (!schema10)
        return null;
      return schema10._parse(new ParseInputLazyPath2(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus2.mergeArray(status, results);
      });
    } else {
      return ParseStatus2.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple2.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple2({
    items: schemas,
    typeName: ZodFirstPartyTypeKind2.ZodTuple,
    rest: null,
    ...processCreateParams2(params)
  });
};
var ZodRecord2 = class _ZodRecord extends ZodType2 {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.object) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.object,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath2(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath2(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus2.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus2.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType2) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind2.ZodRecord,
        ...processCreateParams2(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString2.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind2.ZodRecord,
      ...processCreateParams2(second)
    });
  }
};
var ZodMap2 = class extends ZodType2 {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.map) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.map,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath2(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath2(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID2;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID2;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap2.create = (keyType, valueType, params) => {
  return new ZodMap2({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind2.ZodMap,
    ...processCreateParams2(params)
  });
};
var ZodSet2 = class _ZodSet extends ZodType2 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.set) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.set,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext2(ctx, {
          code: ZodIssueCode2.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext2(ctx, {
          code: ZodIssueCode2.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID2;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath2(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil2.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil2.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet2.create = (valueType, params) => {
  return new ZodSet2({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind2.ZodSet,
    ...processCreateParams2(params)
  });
};
var ZodFunction2 = class _ZodFunction extends ZodType2 {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.function) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.function,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    function makeArgsIssue(args, error) {
      return makeIssue2({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap2(), en_default2].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode2.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue2({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap2(), en_default2].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode2.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise2) {
      const me = this;
      return OK2(async function(...args) {
        const error = new ZodError2([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK2(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError2([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError2([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple2.create(items).rest(ZodUnknown2.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple2.create([]).rest(ZodUnknown2.create()),
      returns: returns || ZodUnknown2.create(),
      typeName: ZodFirstPartyTypeKind2.ZodFunction,
      ...processCreateParams2(params)
    });
  }
};
var ZodLazy2 = class extends ZodType2 {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy2.create = (getter, params) => {
  return new ZodLazy2({
    getter,
    typeName: ZodFirstPartyTypeKind2.ZodLazy,
    ...processCreateParams2(params)
  });
};
var ZodLiteral2 = class extends ZodType2 {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        received: ctx.data,
        code: ZodIssueCode2.invalid_literal,
        expected: this._def.value
      });
      return INVALID2;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral2.create = (value, params) => {
  return new ZodLiteral2({
    value,
    typeName: ZodFirstPartyTypeKind2.ZodLiteral,
    ...processCreateParams2(params)
  });
};
function createZodEnum2(values, params) {
  return new ZodEnum2({
    values,
    typeName: ZodFirstPartyTypeKind2.ZodEnum,
    ...processCreateParams2(params)
  });
}
var ZodEnum2 = class _ZodEnum extends ZodType2 {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext2(ctx, {
        expected: util2.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode2.invalid_type
      });
      return INVALID2;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext2(ctx, {
        received: ctx.data,
        code: ZodIssueCode2.invalid_enum_value,
        options: expectedValues
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum2.create = createZodEnum2;
var ZodNativeEnum2 = class extends ZodType2 {
  _parse(input) {
    const nativeEnumValues = util2.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType2.string && ctx.parsedType !== ZodParsedType2.number) {
      const expectedValues = util2.objectValues(nativeEnumValues);
      addIssueToContext2(ctx, {
        expected: util2.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode2.invalid_type
      });
      return INVALID2;
    }
    if (!this._cache) {
      this._cache = new Set(util2.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util2.objectValues(nativeEnumValues);
      addIssueToContext2(ctx, {
        received: ctx.data,
        code: ZodIssueCode2.invalid_enum_value,
        options: expectedValues
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum2.create = (values, params) => {
  return new ZodNativeEnum2({
    values,
    typeName: ZodFirstPartyTypeKind2.ZodNativeEnum,
    ...processCreateParams2(params)
  });
};
var ZodPromise2 = class extends ZodType2 {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.promise && ctx.common.async === false) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.promise,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const promisified = ctx.parsedType === ZodParsedType2.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK2(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise2.create = (schema10, params) => {
  return new ZodPromise2({
    type: schema10,
    typeName: ZodFirstPartyTypeKind2.ZodPromise,
    ...processCreateParams2(params)
  });
};
var ZodEffects2 = class extends ZodType2 {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind2.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext2(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID2;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID2;
          if (result.status === "dirty")
            return DIRTY2(result.value);
          if (status.value === "dirty")
            return DIRTY2(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID2;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID2;
        if (result.status === "dirty")
          return DIRTY2(result.value);
        if (status.value === "dirty")
          return DIRTY2(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID2;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID2;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid2(base))
          return INVALID2;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid2(base))
            return INVALID2;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util2.assertNever(effect);
  }
};
ZodEffects2.create = (schema10, effect, params) => {
  return new ZodEffects2({
    schema: schema10,
    typeName: ZodFirstPartyTypeKind2.ZodEffects,
    effect,
    ...processCreateParams2(params)
  });
};
ZodEffects2.createWithPreprocess = (preprocess, schema10, params) => {
  return new ZodEffects2({
    schema: schema10,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind2.ZodEffects,
    ...processCreateParams2(params)
  });
};
var ZodOptional2 = class extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType2.undefined) {
      return OK2(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional2.create = (type, params) => {
  return new ZodOptional2({
    innerType: type,
    typeName: ZodFirstPartyTypeKind2.ZodOptional,
    ...processCreateParams2(params)
  });
};
var ZodNullable2 = class extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType2.null) {
      return OK2(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable2.create = (type, params) => {
  return new ZodNullable2({
    innerType: type,
    typeName: ZodFirstPartyTypeKind2.ZodNullable,
    ...processCreateParams2(params)
  });
};
var ZodDefault2 = class extends ZodType2 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType2.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault2.create = (type, params) => {
  return new ZodDefault2({
    innerType: type,
    typeName: ZodFirstPartyTypeKind2.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams2(params)
  });
};
var ZodCatch2 = class extends ZodType2 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync2(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError2(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError2(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch2.create = (type, params) => {
  return new ZodCatch2({
    innerType: type,
    typeName: ZodFirstPartyTypeKind2.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams2(params)
  });
};
var ZodNaN2 = class extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.nan,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN2.create = (params) => {
  return new ZodNaN2({
    typeName: ZodFirstPartyTypeKind2.ZodNaN,
    ...processCreateParams2(params)
  });
};
var BRAND2 = Symbol("zod_brand");
var ZodBranded2 = class extends ZodType2 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline2 = class _ZodPipeline extends ZodType2 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID2;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY2(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID2;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind2.ZodPipeline
    });
  }
};
var ZodReadonly2 = class extends ZodType2 {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid2(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync2(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly2.create = (type, params) => {
  return new ZodReadonly2({
    innerType: type,
    typeName: ZodFirstPartyTypeKind2.ZodReadonly,
    ...processCreateParams2(params)
  });
};
function cleanParams2(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom2(check, _params = {}, fatal) {
  if (check)
    return ZodAny2.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams2(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams2(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny2.create();
}
var late2 = {
  object: ZodObject2.lazycreate
};
var ZodFirstPartyTypeKind2;
(function(ZodFirstPartyTypeKind3) {
  ZodFirstPartyTypeKind3["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind3["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind3["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind3["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind3["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind3["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind3["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind3["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind3["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind3["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind3["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind3["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind3["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind3["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind3["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind3["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind3["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind3["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind3["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind3["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind3["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind3["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind3["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind3["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind3["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind3["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind3["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind3["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind3["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind3["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind3["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind3["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind3["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind3["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind3["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind3["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind2 || (ZodFirstPartyTypeKind2 = {}));
var instanceOfType2 = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom2((data) => data instanceof cls, params);
var stringType2 = ZodString2.create;
var numberType2 = ZodNumber2.create;
var nanType2 = ZodNaN2.create;
var bigIntType2 = ZodBigInt2.create;
var booleanType2 = ZodBoolean2.create;
var dateType2 = ZodDate2.create;
var symbolType2 = ZodSymbol2.create;
var undefinedType2 = ZodUndefined2.create;
var nullType2 = ZodNull2.create;
var anyType2 = ZodAny2.create;
var unknownType2 = ZodUnknown2.create;
var neverType2 = ZodNever2.create;
var voidType2 = ZodVoid2.create;
var arrayType2 = ZodArray2.create;
var objectType2 = ZodObject2.create;
var strictObjectType2 = ZodObject2.strictCreate;
var unionType2 = ZodUnion2.create;
var discriminatedUnionType2 = ZodDiscriminatedUnion2.create;
var intersectionType2 = ZodIntersection2.create;
var tupleType2 = ZodTuple2.create;
var recordType2 = ZodRecord2.create;
var mapType2 = ZodMap2.create;
var setType2 = ZodSet2.create;
var functionType2 = ZodFunction2.create;
var lazyType2 = ZodLazy2.create;
var literalType2 = ZodLiteral2.create;
var enumType2 = ZodEnum2.create;
var nativeEnumType2 = ZodNativeEnum2.create;
var promiseType2 = ZodPromise2.create;
var effectsType2 = ZodEffects2.create;
var optionalType2 = ZodOptional2.create;
var nullableType2 = ZodNullable2.create;
var preprocessType2 = ZodEffects2.createWithPreprocess;
var pipelineType2 = ZodPipeline2.create;
var ostring2 = () => stringType2().optional();
var onumber2 = () => numberType2().optional();
var oboolean2 = () => booleanType2().optional();
var coerce2 = {
  string: (arg) => ZodString2.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber2.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean2.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt2.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate2.create({ ...arg, coerce: true })
};
var NEVER2 = INVALID2;

// src/runtime/VsCodeWriteAdapter.ts
var editSchema = external_exports2.object({
  file_path: external_exports2.string(),
  old_string: external_exports2.string(),
  new_string: external_exports2.string(),
  replace_all: external_exports2.boolean().optional()
});
var writeSchema = external_exports2.object({
  file_path: external_exports2.string(),
  content: external_exports2.string()
});
function buildVsCodeEditTool(deps) {
  return buildTool({
    name: "Edit",
    description: "Replace an exact string in a file. old_string must appear exactly once unless replace_all is true. Read the file first so old_string matches exactly including whitespace.",
    inputSchema: editSchema,
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => true,
    getPath: (input) => input.file_path,
    getActivityDescription: (input) => `Editing ${path15.basename(input.file_path)}`,
    async validateInput(input) {
      if (input.old_string === input.new_string) {
        return { ok: false, message: "old_string and new_string are identical" };
      }
      return { ok: true };
    },
    async call(input, ctx) {
      const abs = path15.isAbsolute(input.file_path) ? input.file_path : path15.resolve(ctx.cwd, input.file_path);
      if (ctx.fileStateCache.has(abs) && await ctx.fileStateCache.isStale(abs)) {
        throw new Error(
          `File ${abs} changed on disk since last read. Re-read before editing.`
        );
      }
      const before = await fs15.readFile(abs, "utf8");
      if (!before.includes(input.old_string)) {
        throw new Error(
          `old_string not found in ${abs}. Read the file and copy the exact text including whitespace.`
        );
      }
      const occurrences = before.split(input.old_string).length - 1;
      const replaceAll = input.replace_all ?? false;
      if (!replaceAll && occurrences > 1) {
        throw new Error(
          `old_string appears ${occurrences} times in ${abs}. Provide a larger unique snippet or set replace_all=true.`
        );
      }
      const after = replaceAll ? before.split(input.old_string).join(input.new_string) : before.replace(input.old_string, input.new_string);
      await applyEdit({
        toolUseId: ctx.toolUseId,
        op: "Edit",
        absPath: abs,
        before,
        after,
        input,
        deps
      });
      await ctx.fileStateCache.markWritten(abs, after);
      return `Edited ${abs} (${occurrences} replacement${occurrences === 1 ? "" : "s"})`;
    }
  });
}
function buildVsCodeWriteTool(deps) {
  return buildTool({
    name: "Write",
    description: "Write content to a file, creating parent directories if needed. Overwrites existing files. Use Edit for modifying existing files.",
    inputSchema: writeSchema,
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => true,
    getPath: (input) => input.file_path,
    getActivityDescription: (input) => `Writing ${path15.basename(input.file_path)}`,
    async validateInput(input) {
      if (!input.file_path.trim()) {
        return { ok: false, message: "file_path must not be empty" };
      }
      return { ok: true };
    },
    async call(input, ctx) {
      const abs = path15.isAbsolute(input.file_path) ? input.file_path : path15.resolve(ctx.cwd, input.file_path);
      if (ctx.fileStateCache.has(abs) && await ctx.fileStateCache.isStale(abs)) {
        throw new Error(
          `File ${abs} changed on disk since last read. Re-read before writing.`
        );
      }
      let before = "";
      try {
        before = await fs15.readFile(abs, "utf8");
      } catch {
        before = "";
      }
      await fs15.mkdir(path15.dirname(abs), { recursive: true });
      await applyEdit({
        toolUseId: ctx.toolUseId,
        op: "Write",
        absPath: abs,
        before,
        after: input.content,
        input,
        deps
      });
      await ctx.fileStateCache.markWritten(abs, input.content);
      return `Wrote ${Buffer.byteLength(input.content, "utf8")} bytes to ${abs}`;
    }
  });
}
async function applyEdit(args) {
  const { toolUseId, op, absPath, before, after, input, deps } = args;
  deps.registry.stage(toolUseId, absPath, before, after);
  let decision = "apply";
  if (!deps.shouldAutoApply(op, input)) {
    decision = await deps.requestDecision({
      toolUseId,
      op,
      filePath: absPath,
      before,
      after
    });
  }
  if (decision === "reject") {
    deps.registry.clear(toolUseId);
    throw new Error("User rejected the proposed edit.");
  }
  const uri = vscode4.Uri.file(absPath);
  let applied = false;
  try {
    await fs15.mkdir(path15.dirname(absPath), { recursive: true });
    if (op === "Write" && !before) {
      await fs15.writeFile(absPath, after, "utf8");
      applied = true;
    } else {
      const we = new vscode4.WorkspaceEdit();
      const doc = await vscode4.workspace.openTextDocument(uri);
      const fullRange = new vscode4.Range(
        doc.positionAt(0),
        doc.positionAt(doc.getText().length)
      );
      we.replace(uri, fullRange, after);
      applied = await vscode4.workspace.applyEdit(we);
      if (applied) {
        const updated = await vscode4.workspace.openTextDocument(uri);
        await updated.save();
      }
    }
  } catch {
    applied = false;
  }
  if (!applied) {
    await fs15.writeFile(absPath, after, "utf8");
  }
  deps.registry.clear(toolUseId);
}

// src/runtime/TerminalBashAdapter.ts
var vscode5 = __toESM(require("vscode"));
var import_node_child_process4 = require("node:child_process");

// src/runtime/BackgroundShellRegistry.ts
var MAX_BUFFER_LINES = 500;
var BackgroundShellRegistry = class {
  shells = /* @__PURE__ */ new Map();
  nextId = 1;
  register(child, command) {
    const id = `bash-${this.nextId++}`;
    const entry = {
      id,
      command,
      pid: child.pid,
      child,
      status: "running",
      exitCode: void 0,
      startedAt: Date.now(),
      buffer: [],
      cursor: 0,
      errorMessage: void 0
    };
    this.shells.set(id, entry);
    const append = (chunk) => {
      const lines = chunk.replace(/\r/g, "").split("\n");
      for (const line of lines) {
        if (!line && lines.length === 1) continue;
        entry.buffer.push(line);
      }
      if (entry.buffer.length > MAX_BUFFER_LINES) {
        const drop = entry.buffer.length - MAX_BUFFER_LINES;
        entry.buffer.splice(0, drop);
        entry.cursor = Math.max(0, entry.cursor - drop);
      }
    };
    child.stdout?.on("data", (d) => append(d.toString()));
    child.stderr?.on("data", (d) => append(d.toString()));
    child.on("close", (code) => {
      entry.exitCode = code ?? void 0;
      if (entry.status === "running") {
        entry.status = "exited";
      }
    });
    child.on("error", (e) => {
      entry.status = "error";
      entry.errorMessage = e instanceof Error ? e.message : String(e);
    });
    return snapshot2(entry);
  }
  /** Used to initialize a shell entry's buffer with output already captured before registration. */
  seedBuffer(id, lines) {
    const entry = this.shells.get(id);
    if (!entry) return;
    entry.buffer.unshift(...lines);
  }
  get(id) {
    const e = this.shells.get(id);
    return e ? snapshot2(e) : void 0;
  }
  getNewOutput(id) {
    const e = this.shells.get(id);
    if (!e) return void 0;
    const lines = e.buffer.slice(e.cursor);
    e.cursor = e.buffer.length;
    return { lines, status: e.status, exitCode: e.exitCode };
  }
  kill(id) {
    const e = this.shells.get(id);
    if (!e) return false;
    if (e.status !== "running") return true;
    e.status = "killed";
    try {
      e.child.kill("SIGTERM");
    } catch {
    }
    setTimeout(() => {
      try {
        if (e.child.exitCode === null && e.child.killed === false) {
          e.child.kill("SIGKILL");
        }
      } catch {
      }
    }, 2e3);
    return true;
  }
  killAll() {
    for (const id of this.shells.keys()) this.kill(id);
  }
  list() {
    return [...this.shells.values()].map(snapshot2);
  }
};
function snapshot2(e) {
  return {
    id: e.id,
    command: e.command,
    pid: e.pid,
    status: e.status,
    exitCode: e.exitCode,
    startedAt: e.startedAt
  };
}
var backgroundShells = new BackgroundShellRegistry();

// src/runtime/TerminalBashAdapter.ts
var MAX_OUTPUT_BYTES = 3e4;
var DEFAULT_IDLE_TIMEOUT_MS = 5 * 6e4;
var MAX_IDLE_TIMEOUT_MS = 30 * 6e4;
var ABSOLUTE_MAX_MS = 60 * 6e4;
var BG_FIRST_OUTPUT_WAIT_MS = 2e3;
var BG_FIRST_OUTPUT_LINES = 8;
var IS_WINDOWS2 = process.platform === "win32";
var schema9 = external_exports2.object({
  command: external_exports2.string(),
  timeout: external_exports2.number().optional().describe(
    "Optional absolute wall-clock cap in ms. Most commands should NOT set this \u2014 the tool kills only on prolonged silence. Use only when you need a hard upper bound (e.g. ping, polling)."
  ),
  cwd: external_exports2.string().optional(),
  run_in_background: external_exports2.boolean().optional().describe(
    "Set true ONLY for processes whose intent is to keep running (dev servers, watchers, daemons). Returns immediately with a bash_id; the process keeps running. Use BashOutput(bash_id) to read new output, KillBash(bash_id) to stop. For installs/builds/tests use foreground \u2014 the tool tolerates long durations as long as output keeps flowing."
  )
});
function truncate(s) {
  if (s.length <= MAX_OUTPUT_BYTES) return s;
  const head = s.slice(0, 5e3);
  const tail = s.slice(-MAX_OUTPUT_BYTES + 5e3);
  return `${head}
...[truncated ${s.length - MAX_OUTPUT_BYTES} bytes]...
${tail}`;
}
var hostState = { terminal: void 0, pty: void 0 };
var BashPty = class {
  writeEmitter = new vscode5.EventEmitter();
  closeEmitter = new vscode5.EventEmitter();
  onDidWrite = this.writeEmitter.event;
  onDidClose = this.closeEmitter.event;
  open() {
    this.writeEmitter.fire(
      "\x1B[2m[reno terminal \u2014 agent commands stream here]\x1B[0m\r\n"
    );
  }
  close() {
    hostState.terminal = void 0;
    hostState.pty = void 0;
  }
  write(s) {
    this.writeEmitter.fire(s.replace(/\n/g, "\r\n"));
  }
};
function getOrCreateTerminal() {
  if (hostState.pty && hostState.terminal) {
    return { pty: hostState.pty, terminal: hostState.terminal };
  }
  const pty = new BashPty();
  const terminal = vscode5.window.createTerminal({
    name: "reno",
    pty,
    iconPath: new vscode5.ThemeIcon("comment-discussion")
  });
  hostState.pty = pty;
  hostState.terminal = terminal;
  return { pty, terminal };
}
function shellArgsFor(command) {
  return IS_WINDOWS2 ? ["cmd.exe", ["/c", command]] : [process.env.SHELL ?? "/bin/sh", ["-c", command]];
}
function buildTerminalBashTool() {
  return buildTool({
    name: "Bash",
    description: "Execute a shell command. By default runs in the foreground and tolerates long durations as long as output keeps flowing (idle timeout: 5 minutes of silence). Set run_in_background=true for dev servers, watchers, or daemons that should keep running after the call returns. Avoid for file read/edit \u2014 use Read/Edit/Write instead.",
    inputSchema: schema9,
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => false,
    getActivityDescription: (input) => {
      const first = input.command.trim().split(/\s+/)[0] ?? "shell";
      const tag = input.run_in_background ? " (bg)" : "";
      return `Running ${first}${tag}`;
    },
    async call(input, ctx, onProgress) {
      const workdir = input.cwd ?? ctx.cwd;
      const { pty, terminal } = getOrCreateTerminal();
      terminal.show(true);
      const [shell, args] = shellArgsFor(input.command);
      pty.write(`\x1B[36m$ ${input.command}\x1B[0m
`);
      const child = (0, import_node_child_process4.spawn)(shell, args, {
        cwd: workdir,
        env: { ...process.env, CI: "1", DEBIAN_FRONTEND: "noninteractive" },
        stdio: ["ignore", "pipe", "pipe"]
        // detached: false on purpose — we still want the parent's job control,
        // but the registry holds the reference so it survives the tool turn.
      });
      if (input.run_in_background) {
        return await runBackground({
          input,
          child,
          pty,
          ctx
        });
      }
      return await runForeground({
        input,
        child,
        pty,
        onProgress,
        ctx
      });
    }
  });
}
async function runForeground(args) {
  const { input, child, pty, onProgress, ctx } = args;
  const idleTimeoutMs = clampIdle(input.timeout ?? DEFAULT_IDLE_TIMEOUT_MS);
  return await new Promise((resolve2, reject) => {
    let stdout = "";
    let stderr = "";
    let killed = false;
    let killReason;
    let lastFlush = 0;
    const absoluteTimer = setTimeout(() => {
      killed = true;
      killReason = "absolute";
      try {
        child.kill();
      } catch {
      }
      if (!IS_WINDOWS2) setTimeout(() => safeKill(child, "SIGKILL"), 2e3);
    }, ABSOLUTE_MAX_MS);
    let idleTimer;
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        killed = true;
        killReason = "idle";
        try {
          child.kill();
        } catch {
        }
        if (!IS_WINDOWS2) setTimeout(() => safeKill(child, "SIGKILL"), 2e3);
      }, idleTimeoutMs);
    };
    resetIdleTimer();
    const onAbort = () => {
      killed = true;
      killReason = "abort";
      try {
        child.kill("SIGTERM");
      } catch {
      }
      if (!IS_WINDOWS2) {
        setTimeout(() => safeKill(child, "SIGKILL"), 1e3);
      }
    };
    ctx.abortController.signal.addEventListener("abort", onAbort, { once: true });
    const flushProgress = (force = false) => {
      if (!onProgress) return;
      const now = Date.now();
      if (!force && now - lastFlush < 200) return;
      lastFlush = now;
      const tail = (stdout + (stderr ? `
${stderr}` : "")).split("\n").slice(-5).join("\n");
      onProgress({ type: "output", message: tail });
    };
    child.stdout?.on("data", (d) => {
      const text = d.toString();
      stdout += text;
      pty.write(text);
      resetIdleTimer();
      flushProgress();
    });
    child.stderr?.on("data", (d) => {
      const text = d.toString();
      stderr += text;
      pty.write(text);
      resetIdleTimer();
      flushProgress();
    });
    child.on("close", (code) => {
      clearTimeout(absoluteTimer);
      if (idleTimer) clearTimeout(idleTimer);
      ctx.abortController.signal.removeEventListener("abort", onAbort);
      const combined = stdout + (stderr ? `
[stderr]
${stderr}` : "");
      const body = truncate(combined);
      pty.write(`
\x1B[2m[exit ${code}]\x1B[0m
`);
      if (killed) {
        if (killReason === "abort") return reject(new Error("Command aborted"));
        if (killReason === "idle") {
          return reject(
            new Error(
              `Command killed \u2014 no output for ${Math.round(idleTimeoutMs / 1e3)}s (assumed stuck).
${body}`
            )
          );
        }
        if (killReason === "absolute") {
          return reject(
            new Error(
              `Command killed \u2014 exceeded absolute ${Math.round(ABSOLUTE_MAX_MS / 6e4)}min wall-clock limit.
${body}`
            )
          );
        }
      }
      resolve2(`exit_code=${code}
${body}`);
    });
    child.on("error", (e) => {
      clearTimeout(absoluteTimer);
      if (idleTimer) clearTimeout(idleTimer);
      ctx.abortController.signal.removeEventListener("abort", onAbort);
      reject(e);
    });
  });
}
async function runBackground(args) {
  const { input, child, pty } = args;
  const earlyLines = [];
  let earlyDone = false;
  const earlyHandler = (d) => {
    if (earlyDone) return;
    const text = d.toString();
    pty.write(text);
    for (const ln of text.replace(/\r/g, "").split("\n")) {
      earlyLines.push(ln);
      if (earlyLines.length >= BG_FIRST_OUTPUT_LINES) earlyDone = true;
    }
  };
  child.stdout?.on("data", earlyHandler);
  child.stderr?.on("data", earlyHandler);
  await new Promise((resolve2) => {
    const t = setTimeout(() => resolve2(), BG_FIRST_OUTPUT_WAIT_MS);
    const check = () => {
      if (earlyDone) {
        clearTimeout(t);
        resolve2();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
  child.stdout?.off("data", earlyHandler);
  child.stderr?.off("data", earlyHandler);
  const snap = backgroundShells.register(child, input.command);
  backgroundShells.seedBuffer(snap.id, earlyLines.filter((l) => l.length > 0));
  child.stdout?.on("data", (d) => pty.write(d.toString()));
  child.stderr?.on("data", (d) => pty.write(d.toString()));
  child.on("close", (code) => {
    pty.write(`
\x1B[2m[${snap.id} exited with code ${code}]\x1B[0m
`);
  });
  const preview = earlyLines.filter((l) => l.length > 0).slice(0, BG_FIRST_OUTPUT_LINES).join("\n");
  return [
    `Started in background: bash_id=${snap.id} pid=${snap.pid ?? "?"}`,
    preview ? "First output:\n" + preview : "(no output yet)",
    `Use BashOutput({"bash_id":"${snap.id}"}) to fetch new output, or KillBash to stop.`
  ].join("\n");
}
function safeKill(child, signal) {
  try {
    child.kill(signal);
  } catch {
  }
}
function clampIdle(v) {
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_IDLE_TIMEOUT_MS;
  return Math.min(Math.max(v, 5e3), MAX_IDLE_TIMEOUT_MS);
}
function disposeBashTerminal() {
  hostState.terminal?.dispose();
  hostState.terminal = void 0;
  hostState.pty = void 0;
  backgroundShells.killAll();
}

// src/runtime/BashCompanionTools.ts
var outputSchema = external_exports2.object({
  bash_id: external_exports2.string().describe("The bash_id returned from a Bash call with run_in_background=true.")
});
var killSchema = external_exports2.object({
  bash_id: external_exports2.string()
});
var bashOutputTool = buildTool({
  name: "BashOutput",
  description: "Read new stdout/stderr from a background bash process started with run_in_background=true. Returns lines emitted since the previous BashOutput call (or since start, on first call). Also reports current status (running/exited/killed) and exit code if available.",
  inputSchema: outputSchema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Reading ${input.bash_id} output`,
  async call(input) {
    const result = backgroundShells.getNewOutput(input.bash_id);
    if (!result) {
      return `Unknown bash_id: ${input.bash_id}. Use the bash_id returned from a Bash call with run_in_background=true.`;
    }
    const status = result.status === "running" ? "running" : result.status === "exited" ? `exited (code=${result.exitCode ?? "?"})` : result.status;
    if (result.lines.length === 0) {
      return `[${input.bash_id} status=${status}] (no new output)`;
    }
    return [
      `[${input.bash_id} status=${status}] +${result.lines.length} line(s):`,
      ...result.lines
    ].join("\n");
  }
});
var killBashTool = buildTool({
  name: "KillBash",
  description: "Stop a background bash process started with run_in_background=true. Sends SIGTERM, then SIGKILL after 2 seconds.",
  inputSchema: killSchema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => true,
  getActivityDescription: (input) => `Killing ${input.bash_id}`,
  async call(input) {
    const ok = backgroundShells.kill(input.bash_id);
    if (!ok) return `Unknown bash_id: ${input.bash_id}`;
    return `Killed ${input.bash_id}`;
  }
});

// src/runtime/EngineHost.ts
var EngineHost = class {
  engine;
  provider;
  resolvedConfig;
  state;
  busy = false;
  events;
  cwd;
  permissions;
  permissionBridge;
  diffRegistry;
  diffWaiters = /* @__PURE__ */ new Map();
  /**
   * toolUseIds whose permission the user just approved (any choice except "no").
   * When the corresponding tool stages a diff for review, we auto-apply instead
   * of asking again — the permission approval already covered that intent.
   */
  recentlyApproved = /* @__PURE__ */ new Set();
  lastPlanMode = false;
  registry;
  stats;
  transcript;
  outputChannel;
  extensionContext;
  model = "";
  constructor(ctx, events) {
    this.events = events;
    this.extensionContext = ctx;
    this.resolvedConfig = {
      provider: "ollama",
      model: void 0,
      ollamaHost: "http://localhost:11434",
      ollamaApiKey: void 0,
      autoCompact: true,
      permissionMode: "normal"
    };
    this.state = createInitialAppState({
      model: "",
      bypassAll: false,
      editMode: "normal"
    });
    this.cwd = vscode6.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    this.permissionBridge = new PermissionBridge(
      (req) => this.events.onPermissionRequest(req)
    );
    this.diffRegistry = DiffPreviewRegistry.register(ctx);
  }
  get permissionsEngine() {
    return this.permissions;
  }
  get cwdPath() {
    return this.cwd;
  }
  get currentEditMode() {
    return this.state.editMode;
  }
  get planMode() {
    return this.state.planMode;
  }
  get appState() {
    return this.state;
  }
  async init() {
    this.cwd = vscode6.workspace.workspaceFolders?.[0]?.uri.fsPath ?? this.cwd;
    this.resolvedConfig = await loadVsConfig(this.extensionContext);
    this.provider = getProvider("ollama", {
      host: this.resolvedConfig.ollamaHost,
      apiKey: this.resolvedConfig.ollamaApiKey
    });
    this.model = await this.pickModel(this.resolvedConfig.model);
    this.state = {
      ...this.state,
      currentModel: this.model,
      editMode: this.resolvedConfig.permissionMode,
      bypassAll: this.resolvedConfig.permissionMode === "bypass"
    };
    if (this.registry) {
      try {
        await closeAllMcp();
      } catch {
      }
    }
    const registry = new ToolRegistry();
    this.registry = registry;
    const writeDeps = {
      registry: this.diffRegistry,
      requestDecision: (req) => this.requestDiffDecision(req),
      shouldAutoApply: (op, input) => {
        if (this.state.editMode === "accept-edits") return true;
        if (this.state.editMode === "bypass") return true;
        if (this.permissions?.bypassAll) return true;
        if (this.permissions) {
          const decision = this.permissions.decide(op, input);
          if (decision.kind === "auto-allow") return true;
        }
        return false;
      }
    };
    for (const t of [
      readTool,
      grepTool,
      globTool,
      webFetchTool,
      webSearchTool,
      sleepTool,
      todoTool,
      enterPlanModeTool,
      exitPlanModeTool,
      enterWorktreeTool,
      exitWorktreeTool,
      notebookEditTool,
      buildVsCodeEditTool(writeDeps),
      buildVsCodeWriteTool(writeDeps),
      buildTerminalBashTool(),
      bashOutputTool,
      killBashTool
    ]) {
      registry.register(t);
    }
    this.permissions = new PermissionEngine(this.cwd);
    await this.permissions.load();
    if (this.state.bypassAll) this.permissions.setSessionBypass(true);
    try {
      const servers = await loadMcpServers(this.cwd);
      if (servers.length) {
        const count = await registerMcpTools(registry, servers);
        this.log(
          `MCP: ${count} tool(s) loaded from ${servers.length} server(s)`
        );
      }
    } catch (e) {
      this.log(`MCP init failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    const stats = new SessionStats(this.model, this.cwd);
    this.stats = stats;
    if (this.transcript) {
      try {
        await this.transcript.close();
      } catch {
      }
    }
    this.transcript = new TranscriptWriter((0, import_node_crypto4.randomUUID)(), this.cwd, this.model);
    try {
      await this.transcript.open();
    } catch (e) {
      this.log(`transcript open failed: ${e instanceof Error ? e.message : String(e)}`);
      this.transcript = void 0;
    }
    this.engine = new QueryEngine({
      provider: this.provider,
      model: this.model,
      registry,
      permissions: this.permissions,
      stats,
      cwd: this.cwd,
      autoCompact: this.resolvedConfig.autoCompact,
      getAppState: () => this.state,
      setAppState: (updater) => {
        const prev = this.state;
        const next = updater(prev);
        this.state = next;
        if (prev.planMode !== next.planMode) {
          this.lastPlanMode = next.planMode;
          this.events.onPlanModeChanged(next.planMode);
        }
      },
      requestPermission: this.permissionBridge.prompt
    });
  }
  async pickModel(explicit) {
    if (!this.provider) throw new Error("provider not built");
    let installed = [];
    try {
      installed = await this.provider.listModels();
    } catch {
      return explicit || "gpt-oss:20b-cloud";
    }
    if (explicit) {
      const isCloud = /-cloud(?::|$)/.test(explicit) || explicit.endsWith("-cloud");
      if (installed.length && !installed.includes(explicit) && !isCloud) {
        const fallback = pickToolCapable(installed);
        this.events.onError(
          `Model "${explicit}" not installed; using "${fallback}".`
        );
        return fallback;
      }
      return explicit;
    }
    return pickToolCapable(installed);
  }
  isBusy() {
    return this.busy;
  }
  resetConversation() {
    this.engine?.resetConversation();
  }
  cancel() {
    this.engine?.abort();
    for (const [id, waiter] of this.diffWaiters) {
      waiter.resolve("reject");
      this.diffRegistry.clear(id);
    }
    this.diffWaiters.clear();
    this.recentlyApproved.clear();
    this.permissionBridge.cancelAll();
  }
  async submit(text) {
    if (!this.engine) {
      throw new Error("EngineHost.init() not called");
    }
    if (this.busy) {
      this.events.onError("Engine is busy with a previous turn.");
      return;
    }
    this.busy = true;
    this.events.onStatus(true);
    void this.transcript?.append({ type: "user", content: text, at: Date.now() });
    try {
      for await (const ev of this.engine.submitMessage(text)) {
        this.events.onEvent(ev);
        this.recordTranscriptEvent(ev);
      }
      if (this.transcript && this.stats) {
        const t = this.stats.totals();
        await this.transcript.updateMeta({
          turns: t.turns,
          promptTokens: t.promptTokens,
          completionTokens: t.completionTokens
        });
      }
    } catch (e) {
      this.events.onError(friendlyError(e, this.model));
    } finally {
      this.busy = false;
      this.events.onStatus(false);
    }
  }
  recordTranscriptEvent(ev) {
    const t = this.transcript;
    if (!t) return;
    const at = Date.now();
    switch (ev.type) {
      case "assistant_done":
        void t.append({ type: "assistant", content: ev.text, at });
        break;
      case "tool_start":
        void t.append({
          type: "tool_call",
          name: ev.name,
          args: ev.args,
          at
        });
        break;
      case "tool_result":
        void t.append({
          type: "tool_result",
          name: ev.name,
          result: ev.result,
          isError: ev.isError,
          at
        });
        break;
      case "notice":
        void t.append({
          type: "system",
          content: ev.message,
          tone: ev.tone,
          at
        });
        break;
      case "checkpoint":
        void t.checkpoint(ev.messages);
        break;
    }
  }
  async refreshConfig() {
    await this.init();
  }
  setPermissionMode(mode) {
    this.state = {
      ...this.state,
      editMode: mode,
      bypassAll: mode === "bypass"
    };
    if (this.permissions) this.permissions.setSessionBypass(mode === "bypass");
  }
  togglePlanMode() {
    const next = !this.state.planMode;
    this.state = { ...this.state, planMode: next };
    this.lastPlanMode = next;
    return next;
  }
  /** Webview replied to a permission request. */
  resolvePermission(toolUseId, choice) {
    if (choice !== "no") {
      this.recentlyApproved.add(toolUseId);
    }
    this.permissionBridge.resolve(toolUseId, choice);
    this.events.onPermissionResolved(toolUseId);
  }
  /** Webview replied to a staged diff. */
  resolveDiff(toolUseId, decision) {
    const waiter = this.diffWaiters.get(toolUseId);
    if (!waiter) return;
    this.diffWaiters.delete(toolUseId);
    waiter.resolve(decision);
    this.events.onDiffResolved(
      toolUseId,
      decision === "apply" ? "applied" : "rejected"
    );
  }
  async openDiff(toolUseId) {
    await this.diffRegistry.openDiff(toolUseId);
  }
  requestDiffDecision(req) {
    const { addedLines, removedLines, preview } = summarizeDiff(
      req.before,
      req.after
    );
    this.events.onDiffStaged({
      toolUseId: req.toolUseId,
      op: req.op,
      filePath: req.filePath,
      beforeBytes: Buffer.byteLength(req.before, "utf8"),
      afterBytes: Buffer.byteLength(req.after, "utf8"),
      addedLines,
      removedLines,
      preview
    });
    if (this.recentlyApproved.has(req.toolUseId)) {
      this.recentlyApproved.delete(req.toolUseId);
      this.events.onDiffResolved(req.toolUseId, "applied");
      return Promise.resolve("apply");
    }
    return new Promise((resolve2) => {
      this.diffWaiters.set(req.toolUseId, { resolve: resolve2 });
    });
  }
  dispose() {
    this.permissionBridge.cancelAll();
    for (const w of this.diffWaiters.values()) w.resolve("reject");
    this.diffWaiters.clear();
    this.recentlyApproved.clear();
    disposeBashTerminal();
    this.transcript?.close().catch(() => {
    });
    closeAllMcp().catch(() => {
    });
    this.outputChannel?.dispose();
  }
  /* ───────── slash-dispatcher / status-bar surface ───────── */
  get engineRef() {
    if (!this.registry) throw new Error("engine not initialized");
    return { tools: this.registry.list() };
  }
  get providerName() {
    return this.provider?.info.name ?? "ollama";
  }
  setModel(model) {
    this.model = model;
    this.engine?.setModel(model);
    this.state = { ...this.state, currentModel: model };
    if (this.stats) this.stats.currentModel = model;
  }
  async listModels() {
    if (!this.provider) return [];
    return await this.provider.listModels();
  }
  async runCompact(focus) {
    if (!this.engine) throw new Error("engine not initialized");
    return await this.engine.runCompact(focus);
  }
  setMessages(messages) {
    this.engine?.setMessages(messages);
  }
  statsTotals() {
    if (!this.stats) {
      return {
        turns: 0,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        apiMs: 0,
        wallMs: 0
      };
    }
    return this.stats.totals();
  }
  log(msg2) {
    if (!this.outputChannel) {
      this.outputChannel = vscode6.window.createOutputChannel("reno");
    }
    this.outputChannel.appendLine(msg2);
  }
};
function friendlyError(e, model) {
  const raw = e instanceof Error ? e.message : String(e);
  if (/does not support tools/i.test(raw)) {
    return `Model "${model}" does not support tools (function calling). Switch to a tool-capable model \u2014 try \`qwen2.5-coder\`, \`llama3.1\`, or \`gpt-oss\`. Run \`ollama pull qwen2.5-coder\` and then click the model name in the status bar (or type /model qwen2.5-coder).`;
  }
  if (/ECONNREFUSED|fetch failed/i.test(raw)) {
    return `Can't reach Ollama. Make sure \`ollama serve\` is running, or set reno.ollama.host in settings.`;
  }
  return raw;
}
var TOOL_CAPABLE_PREFERENCE = [
  "qwen3-next:80b-cloud",
  "qwen3-coder:480b-cloud",
  "qwen3-coder:480b",
  "gpt-oss:20b-cloud",
  "gpt-oss:20b",
  "gpt-oss:120b-cloud",
  "qwen2.5-coder:latest",
  "qwen2.5-coder",
  "llama3.1:8b",
  "llama3.1",
  "llama3.2",
  "mistral"
];
var TOOL_INCAPABLE_PATTERNS = [/^llama2(:|$)/i, /^codellama(:|$)/i];
function isLikelyToolCapable(model) {
  return !TOOL_INCAPABLE_PATTERNS.some((re) => re.test(model));
}
function pickToolCapable(installed) {
  if (installed.length === 0) return "gpt-oss:20b-cloud";
  for (const pref of TOOL_CAPABLE_PREFERENCE) {
    if (installed.includes(pref)) return pref;
  }
  for (const pref of TOOL_CAPABLE_PREFERENCE) {
    const base = pref.split(":")[0];
    const hit = installed.find((m) => m.startsWith(base + ":") || m === base);
    if (hit) return hit;
  }
  const safe = installed.find((m) => isLikelyToolCapable(m));
  if (safe) return safe;
  return installed[0];
}
function summarizeDiff(before, after) {
  const beforeLines = before ? before.split(/\r?\n/) : [];
  const afterLines = after ? after.split(/\r?\n/) : [];
  const beforeSet = /* @__PURE__ */ new Map();
  for (const l of beforeLines) beforeSet.set(l, (beforeSet.get(l) ?? 0) + 1);
  let added = 0;
  let removed = 0;
  for (const l of afterLines) {
    const n = beforeSet.get(l) ?? 0;
    if (n > 0) beforeSet.set(l, n - 1);
    else added += 1;
  }
  for (const n of beforeSet.values()) removed += n;
  const previewLines = [];
  const beforeAvail = /* @__PURE__ */ new Map();
  for (const l of beforeLines) beforeAvail.set(l, (beforeAvail.get(l) ?? 0) + 1);
  for (const l of afterLines) {
    const n = beforeAvail.get(l) ?? 0;
    if (n > 0) {
      beforeAvail.set(l, n - 1);
    } else {
      previewLines.push("+ " + l);
      if (previewLines.length >= 12) break;
    }
  }
  if (previewLines.length < 12) {
    const remaining = /* @__PURE__ */ new Map();
    for (const l of beforeLines)
      remaining.set(l, (remaining.get(l) ?? 0) + 1);
    for (const l of afterLines) {
      const n = remaining.get(l) ?? 0;
      if (n > 0) remaining.set(l, n - 1);
    }
    for (const [l, n] of remaining) {
      for (let i = 0; i < n && previewLines.length < 12; i++)
        previewLines.push("- " + l);
    }
  }
  return { addedLines: added, removedLines: removed, preview: previewLines.join("\n") };
}

// src/commands/slash.ts
var vscode7 = __toESM(require("vscode"));
init_transcript();
init_projectStore();

// ../src/session/pricing.ts
var import_promises11 = __toESM(require("node:fs/promises"), 1);
var import_node_path12 = __toESM(require("node:path"), 1);
init_globalConfig();
var BUILTIN_PRICING = {
  // Ollama Cloud (legacy unprefixed keys)
  "qwen3-coder:480b-cloud": { inPer1M: 3, outPer1M: 9 },
  "gpt-oss:120b-cloud": { inPer1M: 1.5, outPer1M: 4.5 },
  "deepseek-v3.1:671b-cloud": { inPer1M: 2, outPer1M: 6 },
  "qwen3:235b-cloud": { inPer1M: 2.5, outPer1M: 7.5 },
  "llama4:scout-cloud": { inPer1M: 0.8, outPer1M: 2.4 },
  "llama4:maverick-cloud": { inPer1M: 1.2, outPer1M: 3.6 },
  // Common local Ollama models — free
  "qwen2.5-coder:7b": { inPer1M: 0, outPer1M: 0 },
  "qwen2.5-coder:14b": { inPer1M: 0, outPer1M: 0 },
  "qwen2.5-coder:32b": { inPer1M: 0, outPer1M: 0 },
  "llama3.1:8b": { inPer1M: 0, outPer1M: 0 },
  "llama3.1:70b": { inPer1M: 0, outPer1M: 0 },
  "mistral-nemo": { inPer1M: 0, outPer1M: 0 },
  "codestral:latest": { inPer1M: 0, outPer1M: 0 }
  // Future provider entries will use "openai/gpt-4o", "gemini/gemini-2.5-pro", etc.
};
async function loadPricing() {
  const userFile = import_node_path12.default.join(renoDir(), "pricing.json");
  let userPricing = {};
  try {
    userPricing = JSON.parse(await import_promises11.default.readFile(userFile, "utf8"));
  } catch {
  }
  return { ...BUILTIN_PRICING, ...userPricing };
}
function costFor(providerOrModel, modelOrPrompt, promptOrCompletion, completionOrTable, table) {
  let provider;
  let model;
  let prompt;
  let completion;
  let pricing;
  if (typeof modelOrPrompt === "number") {
    model = providerOrModel;
    prompt = modelOrPrompt;
    completion = promptOrCompletion;
    pricing = completionOrTable;
  } else {
    provider = providerOrModel;
    model = modelOrPrompt;
    prompt = promptOrCompletion;
    completion = completionOrTable;
    pricing = table;
  }
  const key1 = provider ? `${provider}/${model}` : null;
  const key2 = model;
  const entry = (key1 && pricing[key1]) ?? pricing[key2] ?? pricing[Object.keys(pricing).find((k) => model.startsWith(k.split(":")[0])) ?? ""] ?? null;
  if (!entry) return null;
  const inCost = prompt / 1e6 * entry.inPer1M;
  const outCost = completion / 1e6 * entry.outPer1M;
  return inCost + outCost;
}
function formatCost(n) {
  if (n === 0) return "free";
  if (n < 1e-3) return "<$0.001";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

// src/commands/slash.ts
init_globalConfig();
async function runSlash(host, cmd, rest) {
  switch (cmd) {
    case "help":
      return { notice: { text: HELP_TEXT, tone: "info" } };
    case "tools":
      return {
        notice: {
          text: host.engineRef.tools.map((t) => `${t.name} \u2014 ${t.description}`).join("\n"),
          tone: "info"
        }
      };
    case "clear":
      host.resetConversation();
      return { notice: { text: "conversation cleared", tone: "info" } };
    case "compact": {
      if (host.isBusy()) {
        return {
          notice: {
            text: "can't compact while a turn is running",
            tone: "warn"
          }
        };
      }
      const focus = rest.join(" ").trim() || void 0;
      try {
        const r = await host.runCompact(focus);
        return {
          notice: {
            text: r.droppedCount === 0 ? "nothing to compact" : `compacted ${r.droppedCount} messages into summary`,
            tone: "info"
          }
        };
      } catch (e) {
        return {
          notice: {
            text: `compact failed: ${msg(e)}`,
            tone: "error"
          }
        };
      }
    }
    case "plan": {
      const arg = rest[0];
      let next;
      if (arg === "on") next = true;
      else if (arg === "off") next = false;
      else next = !host.planMode;
      while (host.planMode !== next) host.togglePlanMode();
      return {
        notice: {
          text: `plan mode ${next ? "ON \u2014 writes/edits/bash blocked" : "OFF"}`,
          tone: next ? "warn" : "info"
        }
      };
    }
    case "bypass": {
      const v = rest[0];
      if (v === "on" || v === "true") {
        host.setPermissionMode("bypass");
        return {
          notice: {
            text: "\u26A0 bypass ON \u2014 all tool calls auto-approved",
            tone: "warn"
          }
        };
      } else if (v === "off" || v === "false") {
        host.setPermissionMode("normal");
        return { notice: { text: "bypass OFF", tone: "info" } };
      }
      return {
        notice: {
          text: `bypass is ${host.currentEditMode === "bypass" ? "ON" : "OFF"}. usage: /bypass on|off`,
          tone: "info"
        }
      };
    }
    case "permissions": {
      const eng = host.permissionsEngine;
      if (!eng) return { notice: { text: "permissions not initialized", tone: "warn" } };
      const snap = eng.snapshot();
      const text = [
        `bypass: session=${snap.session.bypassAll} \xB7 project=${!!snap.project.bypassAll} \xB7 global=${!!snap.global.bypassAll}`,
        "\u2500\u2500 session \u2500\u2500",
        `  allow: ${snap.session.allow.join(", ") || "(none)"}`,
        `  deny:  ${snap.session.deny.join(", ") || "(none)"}`,
        "\u2500\u2500 project \u2500\u2500",
        `  allow: ${(snap.project.permissions?.allow ?? []).join(", ") || "(none)"}`,
        `  deny:  ${(snap.project.permissions?.deny ?? []).join(", ") || "(none)"}`,
        "\u2500\u2500 global \u2500\u2500",
        `  allow: ${(snap.global.permissions?.allow ?? []).join(", ") || "(none)"}`,
        `  deny:  ${(snap.global.permissions?.deny ?? []).join(", ") || "(none)"}`
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
          `\u2500\u2500 ${cmd} \u2500\u2500`,
          `session: ${snap.session[cmd].join(", ") || "(none)"}`,
          `project: ${(snap.project.permissions?.[cmd] ?? []).join(", ") || "(none)"}`,
          `global:  ${(snap.global.permissions?.[cmd] ?? []).join(", ") || "(none)"}`
        ].join("\n");
        return { notice: { text, tone: "info" } };
      }
      let scope = "session";
      let rule;
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
            tone: "warn"
          }
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
          notice: { text: `${scope} ${cmd}: ${rule} (saved)`, tone: "info" }
        };
      } catch (e) {
        return { notice: { text: `save failed: ${msg(e)}`, tone: "error" } };
      }
    }
    case "model":
      if (rest[0]) {
        host.setModel(rest[0]);
        return {
          notice: { text: `model \u2192 ${rest[0]}`, tone: "info" }
        };
      }
      await vscode7.commands.executeCommand("reno.pickModel");
      return {};
    case "models": {
      try {
        const list = await host.listModels();
        return {
          notice: {
            text: list.length ? list.join("\n") : "(no models installed)",
            tone: "info"
          }
        };
      } catch (e) {
        return { notice: { text: msg(e), tone: "error" } };
      }
    }
    case "todos": {
      const todos = host.appState.finalized;
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
        pricing
      );
      const text = [
        `turns: ${t.turns} \xB7 requests: ${t.requests}`,
        `tokens: ${t.promptTokens.toLocaleString()} in / ${t.completionTokens.toLocaleString()} out`,
        `api time: ${(t.apiMs / 1e3).toFixed(1)}s \xB7 wall: ${(t.wallMs / 1e3).toFixed(1)}s`,
        c === null ? "cost: $\u2014 (add pricing to ~/.ig/pricing.json)" : `cost: ${formatCost(c)}`
      ].join("\n");
      return { notice: { text, tone: "info" } };
    }
    case "sessions": {
      try {
        const all = rest.includes("--all");
        const metas = all ? await listAllSessionMetas(30) : await listSessionMetas(host.cwdPath);
        return {
          sessions: metas,
          notice: { text: formatSessionList(metas), tone: "info" }
        };
      } catch (e) {
        return { notice: { text: `sessions failed: ${msg(e)}`, tone: "error" } };
      }
    }
    case "resume": {
      if (host.isBusy()) {
        return {
          notice: { text: "can't resume while a turn is running", tone: "warn" }
        };
      }
      const sessionId = rest[0];
      try {
        const dir = sessionDir(host.cwdPath);
        let filePath;
        if (sessionId) filePath = `${dir}/${sessionId}.jsonl`;
        else {
          const metas = await listSessionMetas(host.cwdPath);
          if (!metas.length) {
            return {
              notice: {
                text: "no sessions found for this project",
                tone: "warn"
              }
            };
          }
          filePath = `${dir}/${metas[0].id}.jsonl`;
        }
        const messages = await messagesFromTranscript(filePath);
        if (!messages) {
          return {
            notice: {
              text: "could not load session (no checkpoint found)",
              tone: "warn"
            }
          };
        }
        host.setMessages(messages);
        return {
          notice: {
            text: `\u2714 loaded ${messages.length} messages from previous session`,
            tone: "info"
          }
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
        const cfg2 = await listConfig();
        return {
          notice: {
            text: `${key} = ${cfg2[key] ?? "(not set)"}`,
            tone: "info"
          }
        };
      }
      if (sub === "set") {
        const key = rest[1];
        const value = rest.slice(2).join(" ");
        if (!key || !value) {
          return {
            notice: { text: "usage: /config set <key> <value>", tone: "warn" }
          };
        }
        try {
          const { file, key: nk } = await setConfigKey(key, value);
          return { notice: { text: `\u2714 ${nk} saved to ${file}`, tone: "info" } };
        } catch (e) {
          return {
            notice: { text: `config set failed: ${msg(e)}`, tone: "error" }
          };
        }
      }
      const cfg = await listConfig();
      const entries = Object.entries(cfg);
      return {
        notice: {
          text: entries.length === 0 ? "(no config set \u2014 use /config set <key> <value>)" : entries.map(([k, v]) => `  ${k.padEnd(18)} ${v}`).join("\n"),
          tone: "info"
        }
      };
    }
    case "init":
      return {
        submit: "Read the most important files in this project (package.json, README, top-level source dirs) and create a concise IG.md at the project root. Include: project purpose, tech stack, key directories, build/test commands, any conventions. Keep it under 60 lines."
      };
    case "mcp": {
      const mcpTools = host.engineRef.tools.filter(
        (t) => t.name.startsWith("mcp__")
      );
      if (!mcpTools.length) {
        return {
          notice: {
            text: "No MCP servers connected. Configure servers in ~/.reno/mcp.json or .reno/mcp.json.",
            tone: "info"
          }
        };
      }
      const byServer = /* @__PURE__ */ new Map();
      for (const t of mcpTools) {
        const parts = t.name.split("__");
        const server = parts[1] ?? "unknown";
        const tool = parts.slice(2).join("__");
        const list = byServer.get(server) ?? [];
        list.push(tool);
        byServer.set(server, list);
      }
      const lines = [...byServer].map(
        ([server, tools]) => `${server} (${tools.length} tools): ${tools.join(", ")}`
      );
      return { notice: { text: lines.join("\n"), tone: "info" } };
    }
    case "worktree":
      return {
        notice: {
          text: host.appState.worktreePath ? `active worktree: ${host.appState.worktreePath}` : "no active worktree (use the EnterWorktree tool to create one)",
          tone: "info"
        }
      };
    case "exit":
    case "quit":
      return {
        notice: { text: "(close the reno panel to end the session)", tone: "info" }
      };
    default:
      return { notice: { text: `unknown command: /${cmd}`, tone: "warn" } };
  }
}
var HELP_TEXT = [
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
  "/mcp                  list MCP servers and tools"
].join("\n");
function msg(e) {
  return e instanceof Error ? e.message : String(e);
}

// src/chat/SettingsBackend.ts
var vscode8 = __toESM(require("vscode"));
var SettingsBackend = class {
  constructor(ctx, getHost) {
    this.ctx = ctx;
    this.getHost = getHost;
  }
  outputChannel;
  /**
   * Returns true if the message was handled by this backend.
   * Lets ChatViewProvider/SettingsPanel keep one big switch.
   */
  async handle(msg2, post) {
    switch (msg2.type) {
      case "settings_get":
        post({
          type: "settings_snapshot",
          settings: await this.readSnapshot()
        });
        return true;
      case "settings_update":
        await this.applyUpdate(msg2.key, msg2.value, post);
        return true;
      case "settings_test_connection":
        await this.testConnection(post);
        return true;
      case "settings_open_native":
        await vscode8.commands.executeCommand(
          "workbench.action.openSettings",
          "@ext:reno.reno"
        );
        return true;
      case "list_models": {
        const host = this.getHost();
        if (!host) {
          post({ type: "models_list", models: [] });
          return true;
        }
        try {
          const models = await host.listModels();
          post({ type: "models_list", models });
        } catch {
          post({ type: "models_list", models: [] });
        }
        return true;
      }
      default:
        return false;
    }
  }
  async readSnapshot() {
    const cfg = vscode8.workspace.getConfiguration("reno");
    const secret = await readSecretApiKey(this.ctx);
    const settingsKey = cfg.get("ollama.apiKey")?.trim() || "";
    const ext = vscode8.extensions.getExtension("reno.reno");
    const version = ext?.packageJSON?.version ?? "0.0.0";
    return {
      provider: "ollama",
      model: cfg.get("model") ?? "",
      ollamaHost: cfg.get("ollama.host") ?? "http://localhost:11434",
      hasApiKey: !!(secret || settingsKey),
      autoCompact: cfg.get("autoCompact") ?? true,
      permissionMode: cfg.get("permissionMode") ?? "normal",
      customInstructions: cfg.get("customInstructions") ?? "",
      version
    };
  }
  async applyUpdate(key, value, post) {
    const cfg = vscode8.workspace.getConfiguration("reno");
    const Global = vscode8.ConfigurationTarget.Global;
    const host = this.getHost();
    try {
      switch (key) {
        case "model":
          await cfg.update("model", String(value), Global);
          host?.setModel(String(value));
          break;
        case "ollamaHost":
          await cfg.update("ollama.host", String(value), Global);
          break;
        case "apiKey": {
          const v = String(value);
          if (v.trim()) {
            await this.ctx.secrets.store(OLLAMA_API_KEY, v);
          } else {
            await this.ctx.secrets.delete(OLLAMA_API_KEY);
          }
          break;
        }
        case "autoCompact":
          await cfg.update("autoCompact", !!value, Global);
          break;
        case "permissionMode": {
          const v = String(value);
          await cfg.update("permissionMode", v, Global);
          host?.setPermissionMode(v);
          break;
        }
        case "customInstructions":
          await cfg.update("customInstructions", String(value), Global);
          break;
      }
      post({ type: "settings_saved", key });
      post({
        type: "settings_snapshot",
        settings: await this.readSnapshot()
      });
    } catch (e) {
      post({
        type: "error",
        message: e instanceof Error ? e.message : String(e)
      });
    }
  }
  async testConnection(post) {
    const host = this.getHost();
    if (!host) {
      post({
        type: "engine_event",
        ev: {
          type: "notice",
          message: "Engine not initialized yet \u2014 open a chat first.",
          tone: "warn"
        }
      });
      return;
    }
    try {
      const models = await host.listModels();
      const tone = models.length > 0 ? "info" : "error";
      const message = models.length > 0 ? `\u2713 Connected \u2014 ${models.length} model${models.length === 1 ? "" : "s"} available` : "Connected but no models found.";
      post({
        type: "engine_event",
        ev: { type: "notice", message, tone }
      });
    } catch (e) {
      post({
        type: "error",
        message: e instanceof Error ? e.message : String(e)
      });
    }
  }
};

// src/chat/ChatViewProvider.ts
var ChatViewProvider = class {
  static viewType = "reno.chatView";
  view;
  host;
  ctx;
  initPromise;
  settings;
  constructor(ctx) {
    this.ctx = ctx;
    this.settings = new SettingsBackend(ctx, () => this.host);
    this.host = new EngineHost(ctx, {
      onEvent: (ev) => this.post({ type: "engine_event", ev }),
      onStatus: (busy) => this.post({ type: "status", busy }),
      onError: (message) => this.post({ type: "error", message }),
      onDiffStaged: (diff) => this.post({ type: "diff_staged", diff }),
      onDiffResolved: (toolUseId, decision) => this.post({ type: "diff_resolved", toolUseId, decision }),
      onPermissionRequest: (req) => this.post({ type: "permission_request", req }),
      onPermissionResolved: (toolUseId) => this.post({ type: "permission_resolved", toolUseId }),
      onPlanModeChanged: (planMode) => this.post({ type: "plan_mode_changed", planMode })
    });
  }
  resolveWebviewView(view) {
    this.view = view;
    this.initPromise = void 0;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode9.Uri.joinPath(this.ctx.extensionUri, "out"),
        vscode9.Uri.joinPath(this.ctx.extensionUri, "media")
      ]
    };
    view.webview.html = this.render(view.webview);
    view.webview.onDidReceiveMessage(async (msg2) => {
      try {
        if (await this.settings.handle(msg2, (m) => this.post(m))) return;
      } catch {
      }
      switch (msg2.type) {
        case "ready": {
          this.initPromise ??= this.host.init();
          try {
            await this.initPromise;
          } catch (e) {
            this.initPromise = void 0;
            this.post({
              type: "error",
              message: e instanceof Error ? e.message : String(e)
            });
            return;
          }
          this.post({
            type: "init",
            model: this.host.model,
            provider: "ollama",
            cwd: vscode9.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "",
            planMode: this.host.planMode,
            permissionMode: this.host.currentEditMode
          });
          break;
        }
        case "submit":
          await this.host.submit(msg2.text);
          break;
        case "cancel":
          this.host.cancel();
          break;
        case "new_chat":
          this.host.resetConversation();
          break;
        case "open_file":
          await openFile(msg2.filePath, msg2.line);
          break;
        case "open_diff":
          await this.host.openDiff(msg2.toolUseId);
          break;
        case "diff_decision":
          this.host.resolveDiff(msg2.toolUseId, msg2.decision);
          break;
        case "permission_decision":
          this.host.resolvePermission(msg2.toolUseId, msg2.choice);
          break;
        case "toggle_plan_mode": {
          const next = this.host.togglePlanMode();
          this.post({ type: "plan_mode_changed", planMode: next });
          break;
        }
        case "set_permission_mode":
          this.host.setPermissionMode(msg2.mode);
          this.post({ type: "permission_mode_changed", mode: msg2.mode });
          break;
        case "slash": {
          await this.dispatchSlash(msg2.cmd, msg2.args);
          break;
        }
        case "request_session_list":
          await this.sendSessionList(msg2.all);
          break;
        case "resume_session":
          await this.resumeSession(msg2.sessionId);
          break;
        case "find_files":
          await this.findFiles(msg2.query, msg2.reqId);
          break;
        case "list_models": {
          try {
            const models = await this.host.listModels();
            this.post({ type: "models_list", models });
          } catch {
            this.post({ type: "models_list", models: [] });
          }
          break;
        }
        case "set_model": {
          this.host.setModel(msg2.model);
          await vscode9.workspace.getConfiguration("reno").update("model", msg2.model, vscode9.ConfigurationTarget.Global);
          this.post({ type: "model_changed", model: msg2.model });
          break;
        }
      }
    });
  }
  async findFiles(query, reqId) {
    const trimmed = query.trim();
    if (!trimmed) {
      this.post({ type: "files_found", reqId, files: [] });
      return;
    }
    try {
      const include = new vscode9.RelativePattern(
        vscode9.workspace.workspaceFolders?.[0] ?? "",
        `**/*${trimmed}*`
      );
      const found = await vscode9.workspace.findFiles(
        include,
        "**/{node_modules,dist,out,build,.git}/**",
        20
      );
      const files = found.map((u3) => {
        const rel = vscode9.workspace.asRelativePath(u3);
        const basename4 = rel.split(/[\\/]/).pop() ?? rel;
        return { relPath: rel, basename: basename4 };
      });
      this.post({ type: "files_found", reqId, files });
    } catch (e) {
      this.post({ type: "files_found", reqId, files: [] });
    }
  }
  async dispatchSlash(cmd, args) {
    try {
      const out = await runSlash(this.host, cmd, args);
      if (out.notice) {
        this.post({
          type: "engine_event",
          ev: {
            type: "notice",
            message: out.notice.text,
            tone: out.notice.tone
          }
        });
      }
      if (out.sessions) {
        this.post({ type: "session_list", sessions: out.sessions });
      }
      if (out.submit) {
        await this.host.submit(out.submit);
      }
    } catch (e) {
      this.post({
        type: "error",
        message: e instanceof Error ? e.message : String(e)
      });
    }
  }
  async sendSessionList(all) {
    const { listSessionMetas: listSessionMetas2, listAllSessionMetas: listAllSessionMetas2 } = await Promise.resolve().then(() => (init_transcript(), transcript_exports));
    try {
      const sessions = all ? await listAllSessionMetas2(30) : await listSessionMetas2(this.host.cwdPath);
      this.post({ type: "session_list", sessions });
    } catch (e) {
      this.post({
        type: "error",
        message: e instanceof Error ? e.message : String(e)
      });
    }
  }
  async resumeSession(sessionId) {
    const { sessionDir: sessionDir2 } = await Promise.resolve().then(() => (init_projectStore(), projectStore_exports));
    const { messagesFromTranscript: messagesFromTranscript2 } = await Promise.resolve().then(() => (init_transcript(), transcript_exports));
    const filePath = `${sessionDir2(this.host.cwdPath)}/${sessionId}.jsonl`;
    const messages = await messagesFromTranscript2(filePath);
    if (!messages) {
      this.post({
        type: "error",
        message: "Could not load session (no checkpoint found)."
      });
      return;
    }
    this.host.setMessages(messages);
    this.post({
      type: "engine_event",
      ev: {
        type: "notice",
        message: `\u2714 resumed: loaded ${messages.length} messages`,
        tone: "info"
      }
    });
  }
  async reveal() {
    if (this.view) {
      this.view.show?.(true);
      return;
    }
    await vscode9.commands.executeCommand("reno.chatView.focus");
  }
  attachSelection(selection) {
    this.post({ type: "selection_attached", selection });
  }
  prefill(text, autosend = false) {
    this.post({ type: "prefill", text, autosend });
  }
  cancel() {
    this.host.cancel();
  }
  newChat() {
    this.host.resetConversation();
  }
  async refreshConfig() {
    await this.host.refreshConfig();
    this.post({ type: "model_changed", model: this.host.model });
  }
  dispose() {
    try {
      this.host.dispose();
    } catch {
    }
  }
  /** Used by status-bar etc to read current state without a round-trip. */
  get hostRef() {
    return this.host;
  }
  post(msg2) {
    this.view?.webview.postMessage(msg2);
  }
  render(webview) {
    const scriptUri = webview.asWebviewUri(
      vscode9.Uri.joinPath(this.ctx.extensionUri, "out", "webview.js")
    );
    const nonce = randomNonce();
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`
    ].join("; ");
    return (
      /* html */
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>reno</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`
    );
  }
};
async function openFile(filePath, line) {
  const ws = vscode9.workspace.workspaceFolders?.[0];
  const uri = filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath) ? vscode9.Uri.file(filePath) : ws ? vscode9.Uri.joinPath(ws.uri, filePath) : vscode9.Uri.file(filePath);
  const doc = await vscode9.workspace.openTextDocument(uri);
  const editor = await vscode9.window.showTextDocument(doc, {
    preview: false,
    viewColumn: vscode9.ViewColumn.Active
  });
  if (typeof line === "number" && line > 0) {
    const pos = new vscode9.Position(Math.max(0, line - 1), 0);
    editor.selection = new vscode9.Selection(pos, pos);
    editor.revealRange(
      new vscode9.Range(pos, pos),
      vscode9.TextEditorRevealType.InCenter
    );
  }
}
function randomNonce() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let n = "";
  for (let i = 0; i < 32; i++)
    n += chars[Math.floor(Math.random() * chars.length)];
  return n;
}

// src/commands/selection.ts
var vscode10 = __toESM(require("vscode"));
function captureActiveSelection() {
  const editor = vscode10.window.activeTextEditor;
  if (!editor) return void 0;
  const sel = editor.selection;
  if (sel.isEmpty) return void 0;
  const range = new vscode10.Range(sel.start, sel.end);
  const text = editor.document.getText(range);
  return {
    uri: editor.document.uri.toString(),
    filePath: vscode10.workspace.asRelativePath(editor.document.uri),
    language: editor.document.languageId,
    text,
    startLine: sel.start.line + 1,
    endLine: sel.end.line + 1
  };
}
async function sendSelectionToChat(provider) {
  const sel = captureActiveSelection();
  if (!sel) {
    vscode10.window.showInformationMessage(
      "reno: no editor selection. Highlight some code first."
    );
    return;
  }
  await provider.reveal();
  provider.attachSelection(sel);
}
async function explainSelection(provider) {
  const sel = captureActiveSelection();
  if (!sel) {
    vscode10.window.showInformationMessage(
      "reno: select code in the editor first."
    );
    return;
  }
  await provider.reveal();
  provider.attachSelection(sel);
  provider.prefill(`Explain this code from \`${sel.filePath}\`.`, true);
}
function captureDiagnosticAt(uri, range) {
  const diags = vscode10.languages.getDiagnostics(uri);
  const hit = diags.find((d) => d.range.intersection(range));
  if (!hit) return void 0;
  const editor = vscode10.window.activeTextEditor;
  const doc = editor?.document.uri.toString() === uri.toString() ? editor.document : void 0;
  if (!doc) return void 0;
  const expanded = new vscode10.Range(
    new vscode10.Position(Math.max(0, hit.range.start.line - 2), 0),
    new vscode10.Position(
      Math.min(doc.lineCount - 1, hit.range.end.line + 2),
      Number.MAX_SAFE_INTEGER
    )
  );
  const text = doc.getText(expanded);
  return {
    selection: {
      uri: doc.uri.toString(),
      filePath: vscode10.workspace.asRelativePath(doc.uri),
      language: doc.languageId,
      text,
      startLine: expanded.start.line + 1,
      endLine: expanded.end.line + 1
    },
    diagnostic: hit
  };
}

// src/codeActions/diagnostics.ts
var vscode11 = __toESM(require("vscode"));
var COMMAND = "reno.fixDiagnostic";
var DiagnosticCodeActionProvider = class {
  static providedKinds = [vscode11.CodeActionKind.QuickFix];
  provideCodeActions(document, range, ctx) {
    if (!ctx.diagnostics.length) return [];
    return ctx.diagnostics.map((diag) => {
      const action = new vscode11.CodeAction(
        `reno: Fix "${truncate2(diag.message, 60)}"`,
        vscode11.CodeActionKind.QuickFix
      );
      action.command = {
        command: COMMAND,
        title: "Fix with reno",
        arguments: [document.uri, diag.range]
      };
      action.diagnostics = [diag];
      return action;
    });
  }
};
function registerDiagnosticActions(ctx, provider) {
  ctx.subscriptions.push(
    vscode11.languages.registerCodeActionsProvider(
      "*",
      new DiagnosticCodeActionProvider(),
      { providedCodeActionKinds: DiagnosticCodeActionProvider.providedKinds }
    ),
    vscode11.commands.registerCommand(
      COMMAND,
      async (uri, range) => {
        const captured = captureDiagnosticAt(uri, range);
        if (!captured) return;
        await provider.reveal();
        provider.attachSelection(captured.selection);
        provider.prefill(
          `Fix this error: ${captured.diagnostic.message}`,
          true
        );
      }
    )
  );
}
function truncate2(s, n) {
  return s.length <= n ? s : s.slice(0, n - 1) + "\u2026";
}

// src/codeActions/explain.ts
var vscode12 = __toESM(require("vscode"));
var COMMAND2 = "reno.explainRange";
var ExplainCodeActionProvider = class {
  static providedKinds = [vscode12.CodeActionKind.RefactorExtract];
  provideCodeActions(document, range) {
    if (range.isEmpty) return [];
    const action = new vscode12.CodeAction(
      "reno: Explain this",
      vscode12.CodeActionKind.RefactorExtract
    );
    action.command = {
      command: COMMAND2,
      title: "Explain with reno",
      arguments: [document.uri, range]
    };
    return [action];
  }
};
function registerExplainAction(ctx, provider) {
  ctx.subscriptions.push(
    vscode12.languages.registerCodeActionsProvider(
      "*",
      new ExplainCodeActionProvider(),
      { providedCodeActionKinds: ExplainCodeActionProvider.providedKinds }
    ),
    vscode12.commands.registerCommand(
      COMMAND2,
      async (uri, range) => {
        const editor = await vscode12.window.showTextDocument(uri);
        editor.selection = new vscode12.Selection(range.start, range.end);
        const sel = captureActiveSelection();
        if (!sel) return;
        await provider.reveal();
        provider.attachSelection(sel);
        provider.prefill(`Explain this code from \`${sel.filePath}\`.`, true);
      }
    )
  );
}

// src/commands/statusBar.ts
var vscode13 = __toESM(require("vscode"));
function registerStatusBar(ctx, provider) {
  const item = vscode13.window.createStatusBarItem(
    vscode13.StatusBarAlignment.Right,
    100
  );
  item.command = "reno.pickModel";
  item.tooltip = "reno: click to switch model";
  item.text = "$(comment-discussion) reno";
  item.show();
  ctx.subscriptions.push(item);
  const update = () => {
    const host = provider.hostRef;
    const model = host.model || "(no model)";
    const t = host.statsTotals();
    const tokens = t.promptTokens + t.completionTokens;
    const tokStr = tokens > 0 ? tokens >= 1e3 ? `${(tokens / 1e3).toFixed(1)}k` : `${tokens}` : "\u2014";
    const planTag = host.planMode ? " \xB7 plan" : "";
    const modeTag = host.currentEditMode === "bypass" ? " \xB7 bypass" : "";
    item.text = `$(comment-discussion) ${shortModel(model)} \xB7 ${tokStr}${planTag}${modeTag}`;
  };
  const interval = setInterval(update, 1e3);
  ctx.subscriptions.push({
    dispose: () => clearInterval(interval)
  });
  update();
  return item;
}
function shortModel(m) {
  return m.split(":")[0];
}

// src/extension.ts
var chatProvider;
function activate(ctx) {
  const provider = new ChatViewProvider(ctx);
  chatProvider = provider;
  ctx.subscriptions.push(
    { dispose: () => provider.dispose() },
    vscode14.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode14.commands.registerCommand("reno.newChat", () => provider.newChat()),
    vscode14.commands.registerCommand("reno.cancelTurn", () => provider.cancel()),
    vscode14.commands.registerCommand(
      "reno.useSelection",
      () => sendSelectionToChat(provider)
    ),
    vscode14.commands.registerCommand(
      "reno.explainSelection",
      () => explainSelection(provider)
    ),
    vscode14.commands.registerCommand("reno.pickModel", async () => {
      let installed = [];
      try {
        installed = await provider.hostRef.listModels();
      } catch {
      }
      let pick;
      if (installed.length > 0) {
        pick = await vscode14.window.showQuickPick(installed, {
          title: "reno: pick model",
          placeHolder: provider.hostRef.model
        });
      } else {
        pick = await vscode14.window.showInputBox({
          title: "reno: model name",
          placeHolder: "e.g. qwen2.5-coder:latest",
          value: provider.hostRef.model
        });
      }
      if (!pick) return;
      provider.hostRef.setModel(pick);
      await vscode14.workspace.getConfiguration("reno").update("model", pick, vscode14.ConfigurationTarget.Global);
    }),
    vscode14.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("reno")) {
        await provider.refreshConfig();
      }
    }),
    vscode14.workspace.onDidChangeWorkspaceFolders(async () => {
      try {
        await provider.refreshConfig();
      } catch {
      }
    })
  );
  registerDiagnosticActions(ctx, provider);
  registerExplainAction(ctx, provider);
  registerStatusBar(ctx, provider);
  registerSecretCommands(ctx);
}
function deactivate() {
  chatProvider?.dispose();
  chatProvider = void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
/*! Bundled license information:

lodash-es/lodash.js:
  (**
   * @license
   * Lodash (Custom Build) <https://lodash.com/>
   * Build: `lodash modularize exports="es" --repo lodash/lodash#4.18.1 -o ./`
   * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
   * Released under MIT license <https://lodash.com/license>
   * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
   * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   *)
*/
//# sourceMappingURL=extension.js.map
