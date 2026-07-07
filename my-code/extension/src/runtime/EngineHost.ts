import * as vscode from "vscode";
import { QueryEngine } from "../../../src/agent/QueryEngine.js";
import { ToolRegistry } from "../../../src/tools/registry.js";
import {
  PermissionEngine,
  type EditMode,
} from "../../../src/config/permissions.js";
import { SessionStats } from "../../../src/session/stats.js";
import {
  createInitialAppState,
  type AppState,
} from "../../../src/state/AppState.js";
import { getProvider } from "../../../src/agent/providers/index.js";
import type { ChatProvider } from "../../../src/agent/provider.js";
import type { SessionEvent } from "../../../src/agent/events.js";
import { readTool } from "../../../src/tools/read.js";
import { grepTool } from "../../../src/tools/grep.js";
import { globTool } from "../../../src/tools/glob.js";
import { webFetchTool } from "../../../src/tools/webFetch.js";
import { webSearchTool } from "../../../src/tools/webSearch.js";
import { sleepTool } from "../../../src/tools/sleep.js";
import { todoTool } from "../../../src/tools/todo.js";
import {
  enterPlanModeTool,
  exitPlanModeTool,
} from "../../../src/tools/planMode.js";
import {
  enterWorktreeTool,
  exitWorktreeTool,
} from "../../../src/tools/worktree.js";
import { notebookEditTool } from "../../../src/tools/notebookEdit.js";
import {
  closeAllMcp,
  loadMcpServers,
  registerMcpTools,
} from "../../../src/mcp/loader.js";
import {
  TranscriptWriter,
  type TranscriptEvent,
} from "../../../src/session/transcript.js";
import { randomUUID } from "node:crypto";
import { loadVsConfig, type VsResolvedConfig } from "../config/vsConfig.js";
import { PermissionBridge } from "./PermissionBridge.js";
import { DiffPreviewRegistry } from "./DiffPreviewRegistry.js";
import {
  buildVsCodeEditTool,
  buildVsCodeWriteTool,
  type DiffDecision,
} from "./VsCodeWriteAdapter.js";
import {
  buildTerminalBashTool,
  disposeBashTerminal,
} from "./TerminalBashAdapter.js";
import { bashOutputTool, killBashTool } from "./BashCompanionTools.js";
import type {
  DiffStaged,
  PermissionRequest,
} from "../chat/protocol.js";

export interface EngineHostEvents {
  onEvent: (ev: SessionEvent) => void;
  onStatus: (busy: boolean) => void;
  onError: (message: string) => void;
  onDiffStaged: (diff: DiffStaged) => void;
  onDiffResolved: (toolUseId: string, decision: "applied" | "rejected") => void;
  onPermissionRequest: (req: PermissionRequest) => void;
  onPermissionResolved: (toolUseId: string) => void;
  onPlanModeChanged: (planMode: boolean) => void;
}

interface DiffWaiter {
  resolve: (d: DiffDecision) => void;
}

export class EngineHost {
  private engine: QueryEngine | undefined;
  private provider: ChatProvider | undefined;
  private resolvedConfig: VsResolvedConfig;
  private state: AppState;
  private busy = false;
  private events: EngineHostEvents;
  private cwd: string;
  private permissions: PermissionEngine | undefined;
  private permissionBridge: PermissionBridge;
  private diffRegistry: DiffPreviewRegistry;
  private diffWaiters = new Map<string, DiffWaiter>();
  /**
   * toolUseIds whose permission the user just approved (any choice except "no").
   * When the corresponding tool stages a diff for review, we auto-apply instead
   * of asking again — the permission approval already covered that intent.
   */
  private recentlyApproved = new Set<string>();
  private lastPlanMode = false;
  private registry: ToolRegistry | undefined;
  private stats: SessionStats | undefined;
  private transcript: TranscriptWriter | undefined;
  private outputChannel: vscode.OutputChannel | undefined;
  private extensionContext: vscode.ExtensionContext;
  model = "";

  constructor(ctx: vscode.ExtensionContext, events: EngineHostEvents) {
    this.events = events;
    this.extensionContext = ctx;
    // Synchronous default; init() reloads with secrets before connecting.
    this.resolvedConfig = {
      provider: "ollama",
      model: undefined,
      ollamaHost: "http://localhost:11434",
      ollamaApiKey: undefined,
      autoCompact: true,
      permissionMode: "normal",
    };
    this.state = createInitialAppState({
      model: "",
      bypassAll: false,
      editMode: "normal",
    });
    this.cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    this.permissionBridge = new PermissionBridge((req) =>
      this.events.onPermissionRequest(req),
    );
    this.diffRegistry = DiffPreviewRegistry.register(ctx);
  }

  get permissionsEngine(): PermissionEngine | undefined {
    return this.permissions;
  }

  get cwdPath(): string {
    return this.cwd;
  }

  get currentEditMode(): EditMode {
    return this.state.editMode;
  }

  get planMode(): boolean {
    return this.state.planMode;
  }

  get appState(): AppState {
    return this.state;
  }

  async init(): Promise<void> {
    // Re-read cwd in case the workspace folder changed since construction.
    this.cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? this.cwd;
    this.resolvedConfig = await loadVsConfig(this.extensionContext);
    this.provider = getProvider("ollama", {
      host: this.resolvedConfig.ollamaHost,
      apiKey: this.resolvedConfig.ollamaApiKey,
    });
    this.model = await this.pickModel(this.resolvedConfig.model);
    this.state = {
      ...this.state,
      currentModel: this.model,
      editMode: this.resolvedConfig.permissionMode,
      bypassAll: this.resolvedConfig.permissionMode === "bypass",
    };

    // Close any prior MCP connections (in case of refreshConfig).
    if (this.registry) {
      try {
        await closeAllMcp();
      } catch {
        /* ignore */
      }
    }
    const registry = new ToolRegistry();
    this.registry = registry;
    const writeDeps = {
      registry: this.diffRegistry,
      requestDecision: (req: {
        toolUseId: string;
        op: "Edit" | "Write";
        filePath: string;
        before: string;
        after: string;
      }) => this.requestDiffDecision(req),
      shouldAutoApply: (op: "Edit" | "Write", input: Record<string, unknown>) => {
        if (this.state.editMode === "accept-edits") return true;
        if (this.state.editMode === "bypass") return true;
        if (this.permissions?.bypassAll) return true;
        // If a saved permission rule already auto-allows this exact call (e.g.
        // user picked "Yes, don't ask again for Write"), skip the diff prompt
        // too — the permission approval already covered the intent.
        if (this.permissions) {
          const decision = this.permissions.decide(op, input);
          if (decision.kind === "auto-allow") return true;
        }
        return false;
      },
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
      killBashTool,
    ]) {
      registry.register(t);
    }

    this.permissions = new PermissionEngine(this.cwd);
    await this.permissions.load();
    if (this.state.bypassAll) this.permissions.setSessionBypass(true);

    // MCP servers (best-effort).
    try {
      const servers = await loadMcpServers(this.cwd);
      if (servers.length) {
        const count = await registerMcpTools(registry, servers);
        this.log(
          `MCP: ${count} tool(s) loaded from ${servers.length} server(s)`,
        );
      }
    } catch (e: unknown) {
      this.log(`MCP init failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    const stats = new SessionStats(this.model, this.cwd);
    this.stats = stats;

    // Open a fresh transcript.
    if (this.transcript) {
      try {
        await this.transcript.close();
      } catch {
        /* ignore */
      }
    }
    this.transcript = new TranscriptWriter(randomUUID(), this.cwd, this.model);
    try {
      await this.transcript.open();
    } catch (e: unknown) {
      this.log(`transcript open failed: ${e instanceof Error ? e.message : String(e)}`);
      this.transcript = undefined;
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
      requestPermission: this.permissionBridge.prompt,
    });
  }

  private async pickModel(explicit: string | undefined): Promise<string> {
    if (!this.provider) throw new Error("provider not built");
    let installed: string[] = [];
    try {
      installed = await this.provider.listModels();
    } catch {
      return explicit || "gpt-oss:20b-cloud";
    }
    if (explicit) {
      // Cloud models often aren't returned by /api/tags; trust the user's choice.
      const isCloud = /-cloud(?::|$)/.test(explicit) || explicit.endsWith("-cloud");
      if (installed.length && !installed.includes(explicit) && !isCloud) {
        const fallback = pickToolCapable(installed);
        this.events.onError(
          `Model "${explicit}" not installed; using "${fallback}".`,
        );
        return fallback;
      }
      return explicit;
    }
    // Auto-pick: prefer models known to support function calling.
    return pickToolCapable(installed);
  }

  isBusy(): boolean {
    return this.busy;
  }

  resetConversation(): void {
    this.engine?.resetConversation();
  }

  cancel(): void {
    this.engine?.abort();
    // Auto-reject any in-flight diff prompts
    for (const [id, waiter] of this.diffWaiters) {
      waiter.resolve("reject");
      this.diffRegistry.clear(id);
    }
    this.diffWaiters.clear();
    this.recentlyApproved.clear();
    this.permissionBridge.cancelAll();
  }

  async submit(text: string): Promise<void> {
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
          completionTokens: t.completionTokens,
        });
      }
    } catch (e: unknown) {
      this.events.onError(friendlyError(e, this.model));
    } finally {
      this.busy = false;
      this.events.onStatus(false);
    }
  }

  private recordTranscriptEvent(ev: SessionEvent): void {
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
          at,
        });
        break;
      case "tool_result":
        void t.append({
          type: "tool_result",
          name: ev.name,
          result: ev.result,
          isError: ev.isError,
          at,
        });
        break;
      case "notice":
        void t.append({
          type: "system",
          content: ev.message,
          tone: ev.tone,
          at,
        });
        break;
      case "checkpoint":
        void t.checkpoint(ev.messages);
        break;
    }
  }

  async refreshConfig(): Promise<void> {
    await this.init();
  }

  setPermissionMode(mode: EditMode): void {
    this.state = {
      ...this.state,
      editMode: mode,
      bypassAll: mode === "bypass",
    };
    if (this.permissions) this.permissions.setSessionBypass(mode === "bypass");
  }

  togglePlanMode(): boolean {
    const next = !this.state.planMode;
    this.state = { ...this.state, planMode: next };
    this.lastPlanMode = next;
    return next;
  }

  /** Webview replied to a permission request. */
  resolvePermission(
    toolUseId: string,
    choice: import("../../../src/config/permissions.js").PermissionChoice,
  ): void {
    if (choice !== "no") {
      // User approved — auto-apply any diff this tool subsequently stages.
      this.recentlyApproved.add(toolUseId);
    }
    this.permissionBridge.resolve(toolUseId, choice);
    this.events.onPermissionResolved(toolUseId);
  }

  /** Webview replied to a staged diff. */
  resolveDiff(toolUseId: string, decision: "apply" | "reject"): void {
    const waiter = this.diffWaiters.get(toolUseId);
    if (!waiter) return;
    this.diffWaiters.delete(toolUseId);
    waiter.resolve(decision);
    this.events.onDiffResolved(
      toolUseId,
      decision === "apply" ? "applied" : "rejected",
    );
  }

  async openDiff(toolUseId: string): Promise<void> {
    await this.diffRegistry.openDiff(toolUseId);
  }

  private requestDiffDecision(req: {
    toolUseId: string;
    op: "Edit" | "Write";
    filePath: string;
    before: string;
    after: string;
  }): Promise<DiffDecision> {
    const { addedLines, removedLines, preview } = summarizeDiff(
      req.before,
      req.after,
    );
    this.events.onDiffStaged({
      toolUseId: req.toolUseId,
      op: req.op,
      filePath: req.filePath,
      beforeBytes: Buffer.byteLength(req.before, "utf8"),
      afterBytes: Buffer.byteLength(req.after, "utf8"),
      addedLines,
      removedLines,
      preview,
    });
    if (this.recentlyApproved.has(req.toolUseId)) {
      // Permission already granted for this tool call — apply without asking.
      // The diff still appears in the conversation as a record of what changed.
      this.recentlyApproved.delete(req.toolUseId);
      this.events.onDiffResolved(req.toolUseId, "applied");
      return Promise.resolve("apply");
    }
    return new Promise<DiffDecision>((resolve) => {
      this.diffWaiters.set(req.toolUseId, { resolve });
    });
  }

  dispose(): void {
    this.permissionBridge.cancelAll();
    for (const w of this.diffWaiters.values()) w.resolve("reject");
    this.diffWaiters.clear();
    this.recentlyApproved.clear();
    disposeBashTerminal();
    this.transcript?.close().catch(() => {});
    closeAllMcp().catch(() => {});
    this.outputChannel?.dispose();
  }

  /* ───────── slash-dispatcher / status-bar surface ───────── */

  get engineRef() {
    if (!this.registry) throw new Error("engine not initialized");
    return { tools: this.registry.list() };
  }

  get providerName(): string {
    return this.provider?.info.name ?? "ollama";
  }

  setModel(model: string): void {
    this.model = model;
    this.engine?.setModel(model);
    this.state = { ...this.state, currentModel: model };
    if (this.stats) this.stats.currentModel = model;
  }

  async listModels(): Promise<string[]> {
    if (!this.provider) return [];
    return await this.provider.listModels();
  }

  async runCompact(focus?: string): Promise<{ droppedCount: number; summary: string }> {
    if (!this.engine) throw new Error("engine not initialized");
    return await this.engine.runCompact(focus);
  }

  setMessages(
    messages: Parameters<NonNullable<typeof this.engine>["setMessages"]>[0],
  ): void {
    this.engine?.setMessages(messages);
  }

  statsTotals(): {
    turns: number;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    apiMs: number;
    wallMs: number;
  } {
    if (!this.stats) {
      return {
        turns: 0,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        apiMs: 0,
        wallMs: 0,
      };
    }
    return this.stats.totals();
  }

  private log(msg: string): void {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel("reno");
    }
    this.outputChannel.appendLine(msg);
  }
}

function friendlyError(e: unknown, model: string): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/does not support tools/i.test(raw)) {
    return `Model "${model}" does not support tools (function calling). Switch to a tool-capable model — try \`qwen2.5-coder\`, \`llama3.1\`, or \`gpt-oss\`. Run \`ollama pull qwen2.5-coder\` and then click the model name in the status bar (or type /model qwen2.5-coder).`;
  }
  if (/ECONNREFUSED|fetch failed/i.test(raw)) {
    return `Can't reach Ollama. Make sure \`ollama serve\` is running, or set reno.ollama.host in settings.`;
  }
  return raw;
}

// Models known to support tool calls (function calling). Order = preference.
// Models known to NOT support tools (e.g. base llama2/llama3) get filtered out
// of auto-selection.
const TOOL_CAPABLE_PREFERENCE = [
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
  "mistral",
];

const TOOL_INCAPABLE_PATTERNS = [/^llama2(:|$)/i, /^codellama(:|$)/i];

function isLikelyToolCapable(model: string): boolean {
  return !TOOL_INCAPABLE_PATTERNS.some((re) => re.test(model));
}

function pickToolCapable(installed: string[]): string {
  if (installed.length === 0) return "gpt-oss:20b-cloud";
  // First, try exact preference matches.
  for (const pref of TOOL_CAPABLE_PREFERENCE) {
    if (installed.includes(pref)) return pref;
  }
  // Then any installed model whose family is known to support tools.
  for (const pref of TOOL_CAPABLE_PREFERENCE) {
    const base = pref.split(":")[0]!;
    const hit = installed.find((m) => m.startsWith(base + ":") || m === base);
    if (hit) return hit;
  }
  // Then anything not in the deny-list.
  const safe = installed.find((m) => isLikelyToolCapable(m));
  if (safe) return safe;
  // Last resort: the first installed (will likely error on tools).
  return installed[0]!;
}

function summarizeDiff(
  before: string,
  after: string,
): { addedLines: number; removedLines: number; preview: string } {
  const beforeLines = before ? before.split(/\r?\n/) : [];
  const afterLines = after ? after.split(/\r?\n/) : [];
  // Cheap line-set diff for header counts (real diff is rendered in vscode.diff).
  const beforeSet = new Map<string, number>();
  for (const l of beforeLines) beforeSet.set(l, (beforeSet.get(l) ?? 0) + 1);
  let added = 0;
  let removed = 0;
  for (const l of afterLines) {
    const n = beforeSet.get(l) ?? 0;
    if (n > 0) beforeSet.set(l, n - 1);
    else added += 1;
  }
  for (const n of beforeSet.values()) removed += n;

  // Mini preview: first up-to-12 changed lines marked with +/-.
  const previewLines: string[] = [];
  const beforeAvail = new Map<string, number>();
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
    const remaining = new Map<string, number>();
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
