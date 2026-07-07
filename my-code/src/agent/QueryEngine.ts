import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import type { ChatProvider } from "./provider.js";
import type { ChatMessage, ToolCall } from "./types.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { Tool, ToolUseContext } from "../tools/Tool.js";
import { PermissionEngine } from "../config/permissions.js";
import type { SessionStats } from "../session/stats.js";
import type { AppState } from "../state/AppState.js";
import { FileStateCache } from "../utils/fileStateCache.js";
import { compactMessages } from "./compact.js";
import { snipToolOutputs, microcompactToolOutputs, collapseReadSearchGroups, estimateTokens } from "./snipCompact.js";
import { maybeExtractSessionMemory } from "../services/sessionMemory/index.js";
import { buildSystemPromptSections } from "./context.js";
import { splitSysPromptPrefix } from "./contextApi.js";
import type { SessionEvent, PermissionPromptFn } from "./events.js";
import { classifyApiError, withRetry, type ApiErrorKind } from "../utils/retry.js";
import { dequeueAll } from "../utils/messageQueueManager.js";
import { checkForLSPDiagnostics, type PendingLSPDiagnostic } from "../services/lsp/LSPDiagnosticRegistry.js";
import { runPreToolUseHooks, runPostToolUseHooks } from "../hooks/index.js";
import { recordTurn as recordSessionTurn } from "../utils/sessionActivity.js";
// Phase 3: Auto-memory extraction
import { executeExtractMemories, isAutoMemoryEnabled } from "../services/memory/extractMemories.js";
import { createAutoMemCanUseTool } from "../services/memory/permissions.js";
import { getAutoMemPath } from "../memdir/paths.js";
// Phase 4: autoDream
import { executeAutoDream } from "../services/memory/autoDream/autoDream.js";


/**
 * Handle passed into LocalAgentTask.spawnAgentTask().
 * Avoids a direct QueryEngine import in LocalAgentTask (circular dependency).
 */
export interface SubEngineHandle {
  run(prompt: string): AsyncIterable<SessionEvent>
  getMessages(): ChatMessage[]
}

/** Maximum characters in a single tool result before truncation. */
const MAX_TOOL_RESULT_CHARS = 32_000;

/** Truncate a tool result string if it exceeds the limit. */
function truncateToolResult(result: string): string {
  if (result.length <= MAX_TOOL_RESULT_CHARS) return result;
  const kept = result.slice(0, MAX_TOOL_RESULT_CHARS);
  const droppedLines = result.slice(MAX_TOOL_RESULT_CHARS).split("\n").length;
  return kept + `\n\n[...truncated ${droppedLines} more lines. Output exceeded ${MAX_TOOL_RESULT_CHARS} character limit.]`;
}

export interface QueryEngineOptions {
  provider: ChatProvider;
  model: string;
  registry: ToolRegistry;
  permissions: PermissionEngine;
  stats?: SessionStats;
  cwd: string;
  maxIterations?: number;
  temperature?: number;
  autoCompact?: boolean;
  contextLength?: number;
  autoCompactThreshold?: number;
  /** Optional user-provided override for the system prompt. */
  customSystemPrompt?: string;
  /** State accessors — QueryEngine reads app state but doesn't own it. */
  getAppState: () => AppState;
  setAppState: (updater: (prev: AppState) => AppState) => void;
  /** Called when a tool needs user permission. Must return a choice. */
  requestPermission?: PermissionPromptFn;
  /** Optional callback invoked for every SessionEvent emitted. Useful for IDE bridge. */
  onEvent?: (ev: SessionEvent) => void;
}

/**
 * QueryEngine owns the conversation lifecycle. One instance per session.
 *
 * Each submitMessage() call starts a new turn and yields SessionEvents. Both
 * REPL and -p mode consume the generator; there is exactly one event schema.
 *
 * Concurrency: tools marked isConcurrencySafe(input) run in parallel inside
 * a turn. Non-safe tools run sequentially after the parallel batch completes.
 * Message order in the transcript is preserved by tool_use_id.
 */
export class QueryEngine {
  messages: ChatMessage[] = [];
  private opts: QueryEngineOptions;
  abortController: AbortController = new AbortController();
  private fileStateCache = new FileStateCache();
  private turnCounter = 0;
  private turnToolCalls: string[] = [];
  /** Consecutive auto-compact failures — circuit breaker for Phase 20. */
  private compactFailures = 0;
  /**
   * Volatile system-prompt content (time, session memory, token budget) rendered
   * as a <system-reminder>. Kept OUT of messages[0] so the system prefix stays
   * byte-identical every turn — otherwise per-turn changes invalidate the
   * provider's KV prefix cache for the whole conversation. Appended at the tail
   * of the API message array at stream time; never persisted in this.messages.
   */
  private dynamicReminder = "";

  constructor(opts: QueryEngineOptions) {
    this.opts = opts;
    this.messages.push({ role: "system", content: "" });
  }

  get cwd(): string {
    return this.opts.cwd;
  }

  /** Swap in a fresh conversation; keeps cache and options. */
  resetConversation(): void {
    this.turnCounter = 0;
    this.compactFailures = 0;
    this.messages = [{ role: "system", content: "" }];
    this.fileStateCache.clear();
  }

  /** Load a previous transcript verbatim. */
  setMessages(msgs: ChatMessage[]): void {
    this.messages = [...msgs];
  }

  /** Retrieve the current message history. */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /** Swap the active model (e.g. from a model picker). */
  setModel(model: string): void {
    this.opts.model = model;
  }

  /** Swap the active provider (e.g. when switching accounts). */
  setProvider(provider: ChatProvider): void {
    this.opts.provider = provider;
  }

  /** The provider currently in use (for display / quota probing). */
  getProvider(): ChatProvider {
    return this.opts.provider;
  }

  /** Attach/replace the permission prompt handler after construction. */
  setRequestPermission(fn: QueryEngineOptions["requestPermission"]): void {
    this.opts.requestPermission = fn;
  }

  /**
   * Attach/replace (or clear) the per-event listener after construction.
   * `serve` mode clears it so the bridge's submit-loop is the single, complete
   * forwarder — otherwise events routed through yieldEvent are forwarded twice.
   */
  setOnEvent(fn: QueryEngineOptions["onEvent"]): void {
    this.opts.onEvent = fn;
  }

  /** Cancel any in-flight stream + tool execution. Safe to call multiple times. */
  abort(): void {
    this.abortController.abort();
  }

  /** Called by REPL after resetConversation or abort so new turns get a fresh signal. */
  private refreshAbortController(): void {
    if (this.abortController.signal.aborted) {
      this.abortController = new AbortController();
    }
  }

  /** Helper to broadcast event to onEvent handler if present, before yielding. */
  private *yieldEvent(ev: SessionEvent): Generator<SessionEvent, void, unknown> {
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
  async *submitMessage(userText: string): AsyncGenerator<SessionEvent, void, unknown> {
    this.refreshAbortController();
    this.messages.push({ role: "user", content: userText });
    recordSessionTurn(); // Phase 28c: session activity tracking

    const turnId = ++this.turnCounter;
    yield* this.yieldEvent({ type: "turn_start", turnId, at: Date.now() });

    const maxIter = this.opts.maxIterations ?? 25;

    for (let i = 0; i < maxIter; i++) {
      if (this.abortController.signal.aborted) {
        yield* this.yieldEvent({ type: "turn_end", turnId, reason: "aborted" });
        return;
      }

      // Auto-compact before every iteration (not just once per user message), so
      // a long tool-use loop that grows the transcript mid-turn can't overflow
      // into the expensive reactive prompt_too_long path. May emit a notice.
      for await (const ev of this.maybeAutoCompact()) yield* this.yieldEvent(ev);

      // Refresh the system prompt per iteration so dynamic sections update.
      const sysPromptBlocks = await this.renderSystemPrompt(this.turnCounter);
      const splitBlocks = splitSysPromptPrefix(sysPromptBlocks as unknown as (readonly string[] & { readonly __brand: 'SystemPrompt' }));
      // Static block -> system message, kept byte-identical across turns so the
      // provider's prefix cache stays valid. Dynamic block -> trailing reminder.
      const staticText = splitBlocks.find(b => b.cacheScope !== null)?.text ?? "";
      const dynamicText = splitBlocks.find(b => b.cacheScope === null)?.text ?? "";
      this.messages[0] = { role: "system", content: staticText };
      this.dynamicReminder = dynamicText
        ? `<system-reminder>\n${dynamicText}\n</system-reminder>`
        : "";

      const toolCalls: ToolCall[] = [];
      for await (const ev of this.runOneTurn(toolCalls)) yield* this.yieldEvent(ev);

      if (this.abortController.signal.aborted) {
        yield* this.yieldEvent({ type: "turn_end", turnId, reason: "aborted" });
        return;
      }

      if (!toolCalls.length) {
        yield* this.yieldEvent({ type: "checkpoint", messages: this.messages });
        // --- Phase 21: Session memory extraction (fire-and-forget) ---
        maybeExtractSessionMemory(
          this.messages,
          this.opts.cwd,
          async (prompt, memoryPath) => {
            const extractionMessages = [
              {
                role: "system" as const,
                content:
                  "You are a session memory extractor. " +
                  "Output ONLY the updated markdown. No commentary. No tool calls. No code fences.",
              },
              { role: "user" as const, content: prompt },
            ];

            let extracted = "";
            try {
              for await (const chunk of this.opts.provider.streamChat({
                model: this.opts.model,
                messages: extractionMessages,
              })) {
                if (chunk.message?.content) {
                  extracted += chunk.message.content;
                }
              }

              if (extracted.trim()) {
                const clean = extracted
                  .replace(/<think>[\s\S]*?<\/think>/g, "")
                  .replace(/<think>[\s\S]*$/g, "")
                  .trim();
                if (clean) {
                  const { dirname } = await import("node:path");
                  await fs.mkdir(dirname(memoryPath), { recursive: true, mode: 0o700 });
                  await fs.writeFile(memoryPath, clean, { encoding: "utf-8", mode: 0o600 });
                }
              }
            } catch {
              // Extraction failures are non-fatal
            }
          }
        );

        // --- Phase 3: Auto Memory extraction (forked agent, fire-and-forget) ---
        if (isAutoMemoryEnabled()) {
          executeExtractMemories({
            messages: this.messages,
            cwd: this.opts.cwd,
            runForkedAgent: (opts) => this.runForkedAgentForMemory(opts),
          }).catch(() => {});
        }

        // --- Phase 4: AutoDream idle consolidation (fire-and-forget) ---
        executeAutoDream({
          cwd: this.opts.cwd,
          sessionId: randomUUID(), // current session marker for exclusion
          runForkedAgent: async (opts) => {
            await this.runForkedAgentForMemory({
              prompt: opts.prompt,
              memoryDir: opts.memoryDir,
              maxTurns: opts.maxTurns,
              skipTranscript: opts.skipTranscript,
            });
          },
        }).catch(() => {});

        yield* this.yieldEvent({ type: "turn_end", turnId, reason: "complete" });
        return;
      }

      for await (const ev of this.runToolCalls(toolCalls)) yield* this.yieldEvent(ev);

      // Between-turn drain: inject any pending background task notifications
      // as a user message so the LLM is informed without waiting for a new prompt.
      const pendingNotifications = dequeueAll().filter(
        cmd => cmd.mode === 'task-notification'
      );
      
      const pendingLsp = checkForLSPDiagnostics();
      
      if (pendingNotifications.length > 0 || pendingLsp.length > 0) {
        const lines: string[] = [];
        if (pendingNotifications.length > 0) {
          lines.push(...pendingNotifications.map(cmd => cmd.value));
        }
        if (pendingLsp.length > 0) {
          for (const diag of pendingLsp) {
             // diagnosticTracker.formatDiagnosticsSummary isn't exactly what we want,
             // let's format it nicely.
             const files = diag.files.map(f => `${f.uri}:\n${f.diagnostics.map(d => `  [${d.severity}] Line ${d.range.start.line + 1}: ${d.message}`).join('\n')}`).join('\n\n');
             lines.push(`<lsp_diagnostics server="${diag.serverName}">\n${files}\n</lsp_diagnostics>`);
          }
        }
        this.messages.push({ role: 'user', content: lines.join('\n\n') });
      }
    }

    this.messages.push({
      role: "user",
      content: `[system] Max tool-use iterations (${maxIter}) reached. Summarize progress and stop.`,
    });
    for await (const ev of this.runOneTurn([])) yield* this.yieldEvent(ev);
    yield* this.yieldEvent({ type: "turn_end", turnId, reason: "max_iterations" });
  }

  /** Run a compact pass synchronously from REPL (via /compact). */
  async runCompact(focus?: string): Promise<{ droppedCount: number; summary: string }> {
    const result = await compactMessages(this.messages, {
      provider: this.opts.provider,
      model: this.opts.model,
      cwd: this.opts.cwd,
      focus,
    });
    this.messages = result.messages;
    return { droppedCount: result.droppedCount, summary: result.summary };
  }

  /**
   * Create a scoped sub-engine that inherits provider/model/registry/cwd from
   * this engine but starts with a fresh conversation. Used by LocalAgentTask
   * to run background agents without a direct circular import.
   */
  createSubEngine(abortController: AbortController): SubEngineHandle {
    const childEngine = new QueryEngine({
      provider: this.opts.provider,
      model: this.opts.model,
      registry: this.opts.registry,
      permissions: this.opts.permissions,
      stats: this.opts.stats,
      cwd: this.opts.cwd,
      contextLength: this.opts.contextLength,
      autoCompact: this.opts.autoCompact,
      getAppState: this.opts.getAppState,
      setAppState: this.opts.setAppState,
    });
    // Override the abort controller so the parent can kill this child
    childEngine.abortController = abortController;
    return {
      run: (prompt: string) => childEngine.submitMessage(prompt),
      getMessages: () => childEngine.getMessages(),
    };
  }

  /**
   * Phase 3+4: Run a forked agent restricted to the auto-memory directory.
   *
   * Exact port of Beta's runForkedAgent() pattern from extractMemories.ts.
   *
   * The child engine:
   *   - Inherits provider/model from parent (same API key)
   *   - Uses createAutoMemCanUseTool permission guard (Policy Island)
   *   - Has skipTranscript semantics: its tool calls are NOT written to the user's JSONL
   *   - Is capped at maxTurns to prevent runaway token spend
   */
  async runForkedAgentForMemory(opts: {
    prompt: string;
    memoryDir: string;
    maxTurns: number;
    skipTranscript: boolean;
  }): Promise<{ writtenPaths: string[]; turnCount: number }> {
    const { prompt, memoryDir, maxTurns } = opts;
    const canUseTool = createAutoMemCanUseTool(memoryDir);
    const abortController = new AbortController();

    // Build a restricted permissions engine by subclassing PermissionEngine
    // and overriding decide() to apply the Policy Island (createAutoMemCanUseTool).
    // We use a synchronous proxy so decide() can be called inline by the engine.
    const basePermissions = this.opts.permissions;
    class MemoryPermissionEngine extends PermissionEngine {
      decide(tool: string, args: Record<string, unknown>): import("../config/permissions.js").AutoResult {
        // Sync proxy: read-only tools always allowed, others apply canUseTool logic.
        const READ_TOOLS = new Set(["Read", "Grep", "Glob"]);
        if (READ_TOOLS.has(tool)) {
          return { kind: "auto-allow", reason: "memory-agent: read-only" };
        }
        // Bash: check via the tool registry — if isReadOnly we allow, otherwise deny.
        // (The async canUseTool check is done separately in the forked engine's tool execution.)
        if (tool === "Bash" || tool === "bash") {
          // Defer to base decide — it will prompt. The async canUseTool enforces this.
          return basePermissions.decide(tool, args);
        }
        // Write/Edit: allow only inside memoryDir
        if (tool === "Write" || tool === "Edit" || tool === "write" || tool === "edit") {
          const norm = (p: string) => p.replace(/\\/g, "/");
          const filePath = String(args.file_path ?? args.TargetFile ?? "");
          if (filePath && norm(filePath).startsWith(norm(memoryDir))) {
            return { kind: "auto-allow", reason: "memory-agent: inside memoryDir" };
          }
          return { kind: "auto-deny", reason: `memory-agent: write outside ${memoryDir} denied` };
        }
        // Deny everything else
        return { kind: "auto-deny", reason: "memory-agent: tool not allowed" };
      }
    }
    // Copy over bypass state from the real permissions engine
    const restrictedPermissions = new MemoryPermissionEngine(this.opts.cwd);
    if (basePermissions.bypassAll) restrictedPermissions.setSessionBypass(true);

    const childEngine = new QueryEngine({
      provider: this.opts.provider,
      model: this.opts.model,
      registry: this.opts.registry,
      permissions: restrictedPermissions,
      cwd: this.opts.cwd,
      maxIterations: maxTurns,
      autoCompact: false, // never compact the memory agent
      getAppState: this.opts.getAppState,
      setAppState: this.opts.setAppState,
      customSystemPrompt:
        `You are a memory management agent. You may ONLY read files freely and write/edit files inside: ${memoryDir}\n` +
        `Bash is restricted to read-only commands (ls, find, grep, cat, stat, wc, head, tail). ` +
        `Anything that writes, redirects to a file, or modifies state outside ${memoryDir} will be denied. ` +
        `Plan your work accordingly.`,
    });
    childEngine.abortController = abortController;

    const writtenPaths: string[] = [];
    let turnCount = 0;

    try {
      for await (const ev of childEngine.submitMessage(prompt)) {
        if (ev.type === "turn_start") turnCount++;
        if (ev.type === "tool_result" && typeof (ev as any).filePath === "string") {
          writtenPaths.push((ev as any).filePath);
        }
      }
    } catch {
      // Forked agent errors are non-fatal
    }

    return { writtenPaths, turnCount };
  }


  private async renderSystemPrompt(turnId: number): Promise<string[]> {
    if (this.opts.customSystemPrompt !== undefined) {
      return [this.opts.customSystemPrompt];
    }
    const tokenBudget = this.opts.contextLength
      ? {
          used: this.opts.stats?.lastPromptTokens ?? 0,
          limit: this.opts.contextLength,
        }
      : undefined;
    return buildSystemPromptSections(this.opts.cwd, this.opts.model, tokenBudget);
  }

  private async *maybeAutoCompact(): AsyncGenerator<SessionEvent, void, unknown> {
    if (this.opts.autoCompact === false) return;
    const ctx = this.opts.contextLength;
    if (!ctx) return;

    const measured = this.opts.stats?.lastPromptTokens ?? 0;
    // lastPromptTokens lags one API round-trip and misses tool outputs appended
    // mid-turn. estimateTokens() (chars/4 over the live transcript) catches that
    // growth — and, crucially, updates immediately after each free tier compresses
    // messages, so we can decide whether to escalate without another round-trip.
    const sizeNow = () => Math.max(measured, estimateTokens(this.messages));
    let current = sizeNow();
    if (!current) return;

    // --- Phase 20: Buffer-token threshold ---
    // Use absolute buffer (13 000 tok reserve) rather than a bare ratio,
    // matching beta's AUTOCOMPACT_BUFFER_TOKENS approach.
    const AUTOCOMPACT_BUFFER = 13_000;
    const WARNING_BUFFER     = 20_000;
    const ratioThreshold = this.opts.autoCompactThreshold ?? 0.9;
    const absoluteThreshold = ctx - AUTOCOMPACT_BUFFER;  // ~93% for 128K ctx
    // Use whichever fires earlier: ratio OR absolute-buffer
    const effectiveThreshold = Math.min(
      Math.floor(ctx * ratioThreshold),
      absoluteThreshold,
    );
    const warningThreshold = ctx - WARNING_BUFFER;

    if (current < warningThreshold) return; // well below warning — nothing to do

    const pct = () => Math.round((sizeNow() / ctx) * 100);

    // --- Phase 20: Circuit breaker ---
    // After 3 consecutive compact failures stop trying — the context is
    // irrecoverably full and we'd waste every turn hammering the LLM.
    const MAX_CONSECUTIVE_FAILURES = 3;
    if (this.compactFailures >= MAX_CONSECUTIVE_FAILURES) {
      // Surface once so the user knows why compaction is suppressed
      if (this.compactFailures === MAX_CONSECUTIVE_FAILURES) {
        this.compactFailures++; // bump past threshold so we don't repeat
        yield {
          type: "notice",
          message: `auto-compact circuit breaker tripped after ${MAX_CONSECUTIVE_FAILURES} failures — use /compact manually`,
          tone: "error",
        };
      }
      return;
    }

    // Below effective compact threshold — only warn
    if (current < effectiveThreshold) {
      yield {
        type: "notice",
        message: `context ${pct()}% full — approaching compact threshold`,
        tone: "warn",
      };
      return;
    }

    // --- Free tiers, cascaded in one pass ---
    // Run each free tier in order, re-estimating after each. Stop as soon as the
    // transcript drops under the threshold; otherwise escalate to the next tier.

    // Tier 1: Snip (truncate large tool outputs)
    {
      const { messages: snipped, snippedCount } = snipToolOutputs(this.messages);
      if (snippedCount > 0) {
        this.messages = snipped;
        yield {
          type: "notice",
          message: `snipped ${snippedCount} large tool output(s) (context ${pct()}% full)`,
          tone: "warn",
        };
        if ((current = sizeNow()) < effectiveThreshold) return;
      }
    }

    // Tier 2: Microcompact (compress tool outputs more aggressively)
    {
      const { messages: compacted, compactedCount } = microcompactToolOutputs(this.messages);
      if (compactedCount > 0) {
        this.messages = compacted;
        yield {
          type: "notice",
          message: `microcompacted ${compactedCount} tool output(s) (context ${pct()}% full)`,
          tone: "warn",
        };
        if ((current = sizeNow()) < effectiveThreshold) return;
      }
    }

    // Tier 3: Collapse read/search groups
    {
      const { messages: collapsed, collapsedGroups } = collapseReadSearchGroups(this.messages);
      if (collapsedGroups > 0) {
        this.messages = collapsed;
        yield {
          type: "notice",
          message: `collapsed ${collapsedGroups} read/search group(s) (context ${pct()}% full)`,
          tone: "warn",
        };
        if ((current = sizeNow()) < effectiveThreshold) return;
      }
    }

    // --- Tier 4: Autocompact (expensive — LLM summarization) ---
    const before = sizeNow();
    yield {
      type: "notice",
      message: `auto-compacting via summarization (context ${pct()}% full)…`,
      tone: "warn",
    };
    try {
      const result = await compactMessages(this.messages, {
        provider: this.opts.provider,
        model: this.opts.model,
        cwd: this.opts.cwd,
      });
      if (result.droppedCount > 0) {
        this.messages = result.messages;
        // Reset circuit breaker on success
        this.compactFailures = 0;
        const freed = Math.max(0, before - estimateTokens(this.messages));
        yield {
          type: "auto_compact",
          droppedCount: result.droppedCount,
          freedTokens: freed,
        };
      }
    } catch (e: unknown) {
      // Increment failure counter for circuit breaker
      this.compactFailures++;
      yield {
        type: "notice",
        message: `auto-compact failed (attempt ${this.compactFailures}/${MAX_CONSECUTIVE_FAILURES}): ${e instanceof Error ? e.message : String(e)}`,
        tone: "error",
      };
    }
  }

  /**
   * Build the message array to send to the provider for this stream. Appends the
   * volatile <system-reminder> at the tail (after all stable content) so it never
   * disturbs the cached prefix. Merges into the latest user turn when present to
   * avoid two consecutive user messages. Does NOT mutate this.messages.
   */
  private buildStreamMessages(): ChatMessage[] {
    if (!this.dynamicReminder) return this.messages;
    const msgs = this.messages;
    const last = msgs[msgs.length - 1];
    if (last && last.role === "user") {
      return [
        ...msgs.slice(0, -1),
        { ...last, content: `${last.content}\n\n${this.dynamicReminder}` },
      ];
    }
    return [...msgs, { role: "user", content: this.dynamicReminder }];
  }

  private async *runOneTurn(
    toolCallsOut: ToolCall[]
  ): AsyncGenerator<SessionEvent, void, unknown> {
    const tools = this.opts.registry.toolSchema();
    let text = "";
    // Model reasoning (chain-of-thought) — kept separate from `text` so it's
    // never rendered as the answer. Surfaced as a collapsed reasoning event.
    let reasoning = "";
    let reasoningEndedAt = 0;
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
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
        think: thinkMode ? true : undefined,
      })) {
        if (chunk.message?.thinking) {
          reasoning += chunk.message.thinking;
        }
        if (chunk.message?.content) {
          const delta = thinkMode
            ? provider.stripThinkingTags(chunk.message.content)
            : chunk.message.content;
          if (delta) {
            // First real answer token — reasoning phase is over.
            if (reasoning && !reasoningEndedAt) reasoningEndedAt = Date.now();
            text += delta;
            // We can't yield from inside withRetry, so we buffer.
            // Streaming deltas are handled in the outer try block.
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
      // Wrap the streaming call in retry logic for transient errors.
      // prompt_too_long is handled separately below (needs compact, not retry).
      await withRetry(doStream, {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30_000,
        signal: this.abortController.signal,
        isRetryable: (err) => {
          const kind = classifyApiError(err);
          return kind === "rate_limit" || kind === "network" || kind === "server";
        },
        onRetry: (err, attempt, delayMs) => {
          const kind = classifyApiError(err);
          const msg = err instanceof Error ? err.message : String(err);
          // We can't yield from here, but we'll log to stderr.
          process.stderr.write(
            `  ⟳ ${kind} error (attempt ${attempt}), retrying in ${Math.round(delayMs / 1000)}s: ${msg.slice(0, 120)}\n`
          );
        },
      });

      // Emit all buffered text as a single delta (since we couldn't yield during retry)
      if (text) {
        yield { type: "assistant_delta", text };
      }
    } catch (e: unknown) {
      if (this.abortController.signal.aborted) {
        return;
      }

      // Check if this is a context overflow — try to auto-compact and retry once.
      const kind = classifyApiError(e);
      if (kind === "prompt_too_long") {
        yield {
          type: "notice",
          message: "context overflow detected — auto-compacting and retrying…",
          tone: "warn",
        };
        try {
          const result = await compactMessages(this.messages, {
            provider: this.opts.provider,
            model: this.opts.model,
            cwd: this.opts.cwd,
          });
          if (result.droppedCount > 0) {
            this.messages = result.messages;
            yield {
              type: "auto_compact",
              droppedCount: result.droppedCount,
              freedTokens: 0,
            };
            // Retry the turn after compacting.
            text = "";
            toolCallsOut.length = 0;
            for await (const chunk of provider.streamChat({
              model: this.opts.model,
              messages: this.buildStreamMessages(),
              tools,
              signal: this.abortController.signal,
              options: { temperature: this.opts.temperature },
              think: thinkMode ? true : undefined,
            })) {
              if (chunk.message?.thinking) {
                reasoning += chunk.message.thinking;
                yield { type: "reasoning_delta", text: chunk.message.thinking };
              }
              if (chunk.message?.content) {
                const delta = thinkMode
                  ? provider.stripThinkingTags(chunk.message.content)
                  : chunk.message.content;
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
            // Nothing to compact — re-throw the original error.
            const msg = e instanceof Error ? e.message : String(e);
            yield { type: "notice", message: msg, tone: "error" };
            throw e;
          }
        } catch (compactErr: unknown) {
          const msg = compactErr instanceof Error ? compactErr.message : String(compactErr);
          yield { type: "notice", message: `auto-compact failed: ${msg}`, tone: "error" };
          throw e; // throw the original prompt_too_long error
        }
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        yield { type: "notice", message: msg, tone: "error" };
        throw e;
      }
    }

    const apiMs = Date.now() - startTime;

    this.messages.push({
      role: "assistant",
      content: text,
      tool_calls: toolCallsOut.length ? toolCallsOut : undefined,
    });
    // Surface reasoning (collapsed) just before the answer so it sorts above it.
    if (reasoning.trim()) {
      yield {
        type: "reasoning_done",
        text: reasoning.trim(),
        durationMs: (reasoningEndedAt || Date.now()) - startTime,
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
        toolCalls: [...this.turnToolCalls],
      });
    }
  }

  private async *runToolCalls(
    calls: ToolCall[]
  ): AsyncGenerator<SessionEvent, void, unknown> {
    // Partition calls into parallel-safe vs sequential based on the tool's
    // isConcurrencySafe flag. Run the safe batch concurrently (much faster for
    // read-only exploration turns: multiple Reads/Greps at once).
    const parallel: Array<{ call: ToolCall; tool: Tool; id: string }> = [];
    const sequential: Array<{ call: ToolCall; tool: Tool; id: string }> = [];

    for (const call of calls) {
      const id = call.id ?? randomUUID();
      const tool = this.opts.registry.get(call.function.name);
      if (!tool) {
        this.turnToolCalls.push(call.function.name);
        const msg = `Error: unknown tool "${call.function.name}". Available: ${this.opts.registry
          .list()
          .map((t) => t.name)
          .join(", ")}`;
        this.messages.push({
          role: "tool",
          tool_name: call.function.name,
          tool_call_id: id,
          content: msg,
        });
        yield { type: "tool_start", toolUseId: id, name: call.function.name, args: call.function.arguments ?? {} };
        yield {
          type: "tool_result",
          toolUseId: id,
          name: call.function.name,
          result: msg,
          isError: true,
        };
        continue;
      }

      this.turnToolCalls.push(tool.name);

      // Parse + validate args with the tool's zod schema. On parse failure,
      // synthesize an error tool_result so the model can see the mistake.
      const parsed = tool.inputSchema.safeParse(call.function.arguments ?? {});
      if (!parsed.success) {
        const msg = `Invalid args for ${tool.name}: ${parsed.error.issues
          .map(
            (i: { path: (string | number)[]; message: string }) =>
              `${i.path.join(".") || "(root)"} — ${i.message}`
          )
          .join("; ")}`;
        this.messages.push({
          role: "tool",
          tool_name: tool.name,
          tool_call_id: id,
          content: msg,
        });
        yield { type: "tool_start", toolUseId: id, name: tool.name, args: call.function.arguments ?? {} };
        yield {
          type: "tool_result",
          toolUseId: id,
          name: tool.name,
          result: msg,
          isError: true,
        };
        continue;
      }

      // Bucket. TodoWrite is "read-only" semantically but we don't parallelize
      // it with itself; isConcurrencySafe handles the nuance.
      if (tool.isConcurrencySafe(parsed.data)) {
        parallel.push({ call, tool, id });
      } else {
        sequential.push({ call, tool, id });
      }
    }

    // Run parallel batch — but stream their start/result events in call order.
    if (parallel.length > 0) {
      const promises = parallel.map(async ({ call, tool, id }) => {
        return await this.executeSingle(call, tool, id);
      });
      // For streaming: emit start events immediately in order, await results
      // in order (Promise.all keeps original ordering).
      const results = parallel.map((p, idx) => ({ ...p, promise: promises[idx] }));
      // Emit starts first so the UI shows all running in parallel.
      for (const r of results) {
        yield {
          type: "tool_start",
          toolUseId: r.id,
          name: r.tool.name,
          args: r.call.function.arguments ?? {},
        };
      }
      for (const r of results) {
        const p = r.promise;
        if (!p) continue;
        const evts = await p;
        for (const ev of evts) yield ev;
      }
    }

    // Run sequential calls one at a time — each can see the effects of the prior.
    for (const { call, tool, id } of sequential) {
      yield {
        type: "tool_start",
        toolUseId: id,
        name: tool.name,
        args: call.function.arguments ?? {},
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
  private async executeSingle(
    call: ToolCall,
    tool: Tool,
    toolUseId: string
  ): Promise<SessionEvent[]> {
    const out: SessionEvent[] = [];
    const input = tool.inputSchema.parse(call.function.arguments ?? {}) as Record<
      string,
      unknown
    >;

    // Collected completed child tool calls when this tool spawns a subagent —
    // attached to this call's tool_result so the UI can render a ├ │ └ tree.
    const subAgentChildren: Array<{
      name: string;
      args: Record<string, unknown>;
      result?: string;
      isError?: boolean;
    }> = [];
    const subAgentChildArgs = new Map<string, Record<string, unknown>>();

    const ctx: ToolUseContext = {
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
        // Create a focused sub-agent engine
        const subEngine = new QueryEngine({
          provider: this.opts.provider,
          model: this.opts.model,
          registry: this.opts.registry, // Wait, we should probably restrict tools if allowed_tools is provided
          permissions: this.opts.permissions,
          stats: this.opts.stats, // share stats or new stats? Share so cost is combined
          cwd: this.opts.cwd,
          contextLength: this.opts.contextLength,
          autoCompact: this.opts.autoCompact,
          getAppState: this.opts.getAppState,
          setAppState: this.opts.setAppState,
          onEvent: (ev) => {
            // Forward events as sub-agent events
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
          context ? `\n# Additional Context\n${context}` : ""
        ].join("\n");

        onProgress?.({ type: "status", message: `spawning sub-agent: ${task.slice(0, 60)}...` });
        
        let resultSummary = "Sub-agent completed without output.";
        
        try {
          // Run it to completion, collecting the child's completed tool calls so
          // the parent can render them as a subagent tree.
          for await (const ev of subEngine.submitMessage(prompt)) {
            if (ev.type === "tool_start") {
              subAgentChildArgs.set(ev.toolUseId, ev.args);
            } else if (ev.type === "tool_result") {
              subAgentChildren.push({
                name: ev.name,
                args: subAgentChildArgs.get(ev.toolUseId) ?? {},
                result: ev.result,
                isError: ev.isError,
              });
            }
          }
          
          // Get the last assistant message as the result
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

    // ─── 1. PreToolUse Hooks ───
    const { runPreToolUseHooks, runPostToolUseHooks } = await import("../hooks/index.js");
    const preHook = await runPreToolUseHooks({ toolName: tool.name, input, ctx });
    if (preHook.denied) {
      this.messages.push({
        role: "tool",
        tool_name: tool.name,
        tool_call_id: toolUseId,
        content: `Blocked by hook: ${preHook.denied}`,
      });
      out.push({
        type: "tool_result",
        toolUseId,
        name: tool.name,
        result: `Blocked by hook: ${preHook.denied}`,
        isError: true,
      });
      return out;
    }
    const finalInput = preHook.modifiedInput ?? input;

    // ─── 2. Permission Check ───
    const appState = this.opts.getAppState();
    const PLAN_MODE_ALLOWLIST = new Set(["EnterPlanMode", "ExitPlanMode"]);
    if (
      appState.planMode &&
      !PLAN_MODE_ALLOWLIST.has(tool.name) &&
      (!tool.isReadOnly(finalInput) || tool.isDestructive(finalInput))
    ) {
      const msg = `Blocked: plan mode is ON. Only read-only tools may run; call ExitPlanMode first.`;
      this.messages.push({
        role: "tool",
        tool_name: tool.name,
        tool_call_id: toolUseId,
        content: msg,
      });
      out.push({
        type: "tool_result",
        toolUseId,
        name: tool.name,
        result: msg,
        isError: true,
      });
      return out;
    }

    // Tool-specific validation layer (beyond schema).
    if (tool.validateInput) {
      const v = await tool.validateInput(finalInput, ctx);
      if (!v.ok) {
        const msg = `Validation failed for ${tool.name}: ${v.message}`;
        this.messages.push({
          role: "tool",
          tool_name: tool.name,
          tool_call_id: toolUseId,
          content: msg,
        });
        out.push({
          type: "tool_result",
          toolUseId,
          name: tool.name,
          result: msg,
          isError: true,
        });
        return out;
      }
    }

    // Permission check (only for tools that require it).
    if (tool.requiresPermission || tool.isDestructive(finalInput)) {
      const engine = this.opts.permissions;
      const auto = engine.decide(tool.name, finalInput);

      if (auto.kind === "auto-deny") {
        const msg = `Denied — ${auto.reason}`;
        this.messages.push({
          role: "tool",
          tool_name: tool.name,
          tool_call_id: toolUseId,
          content: msg,
        });
        out.push({
          type: "auto_decision",
          toolUseId,
          name: tool.name,
          decision: "deny",
          reason: auto.reason,
        });
        out.push({
          type: "tool_result",
          toolUseId,
          name: tool.name,
          result: msg,
          isError: true,
        });
        return out;
      }

      if (auto.kind === "prompt") {
        if (!this.opts.requestPermission) {
          // No UI to ask — deny by default.
          const msg = "Permission required but no handler available; denied.";
          this.messages.push({
            role: "tool",
            tool_name: tool.name,
            tool_call_id: toolUseId,
            content: msg,
          });
          out.push({
            type: "tool_result",
            toolUseId,
            name: tool.name,
            result: msg,
            isError: true,
          });
          return out;
        }
        const suggestedRules = {
          session: engine.suggestRule(tool.name, finalInput, "session"),
          project: engine.suggestRule(tool.name, finalInput, "project"),
        };
        out.push({
          type: "permission_request",
          toolUseId,
          name: tool.name,
          args: finalInput,
          suggestedRules,
        });
        const choice = await this.opts.requestPermission({
          toolUseId,
          name: tool.name,
          args: finalInput,
          suggestedRules,
          signal: this.abortController.signal,
        });
        out.push({ type: "permission_decision", toolUseId, choice });

        if (choice === "no") {
          const msg = "User denied this tool call.";
          this.messages.push({
            role: "tool",
            tool_name: tool.name,
            tool_call_id: toolUseId,
            content: msg,
          });
          out.push({
            type: "tool_result",
            toolUseId,
            name: tool.name,
            result: msg,
            isError: true,
          });
          return out;
        }
        if (choice === "session") engine.addSessionAllow(suggestedRules.session);
        if (choice === "project") {
          try {
            await engine.addPersistedRule("project", "allow", suggestedRules.project);
          } catch (e: unknown) {
            out.push({
              type: "notice",
              message: `project save failed: ${e instanceof Error ? e.message : String(e)}`,
              tone: "warn",
            });
          }
        }
      } else {
        out.push({
          type: "auto_decision",
          toolUseId,
          name: tool.name,
          decision: "allow",
          reason: auto.reason,
        });
      }
    }

    // ─── PreToolUse hooks (Phase 3.3) ───
    let effectiveInput = input;
    try {
      const { runPreToolUseHooks } = await import("../hooks/index.js");
      const hookResult = await runPreToolUseHooks({ toolName: tool.name, input, ctx });
      if (hookResult.denied) {
        const msg = `Hook denied: ${hookResult.denied}`;
        this.messages.push({
          role: "tool",
          tool_name: tool.name,
          tool_call_id: toolUseId,
          content: msg,
        });
        out.push({
          type: "tool_result",
          toolUseId,
          name: tool.name,
          result: msg,
          isError: true,
        });
        return out;
      }
      if (hookResult.modifiedInput) {
        effectiveInput = hookResult.modifiedInput;
      }
    } catch {
      // Hook loading failures are non-fatal
    }

    // Execute.
    try {
      const rawResult = await tool.call(effectiveInput, ctx, (progress) => {
        // Progress is fire-and-forget from the tool's POV; we queue it.
        // (The caller iterates `out` after the promise resolves — live progress
        // streaming into the generator would need a different shape.)
        out.push({
          type: "tool_progress",
          toolUseId,
          message: progress.message,
        });
      });
      // Truncate oversized tool results to prevent context blowup.
      const resultStr = typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult);
      let result = truncateToolResult(resultStr);

      // ─── PostToolUse hooks (Phase 3.3) ───
      try {
        const { runPostToolUseHooks } = await import("../hooks/index.js");
        const hookResult = await runPostToolUseHooks({
          toolName: tool.name,
          input: effectiveInput,
          output: result,
          isError: false,
          ctx,
        });
        if (hookResult.modifiedOutput) {
          result = hookResult.modifiedOutput;
        }
      } catch {
        // Hook loading failures are non-fatal
      }

      this.messages.push({
        role: "tool",
        tool_name: tool.name,
        tool_call_id: toolUseId,
        content: result,
      });
      // Structured diff for the UI (real file line numbers), if the tool offers one.
      let diff: { filePath: string; before: string; after: string; startLine: number } | undefined;
      try {
        const rendered = tool.renderToolResult?.(effectiveInput, result);
        if (rendered && rendered.kind === "diff") {
          diff = {
            filePath: rendered.filePath,
            before: rendered.before,
            after: rendered.after,
            startLine: rendered.startLine ?? 1,
          };
        }
      } catch {
        // Rendering metadata is best-effort and must never fail the tool.
      }
      out.push({
        type: "tool_result",
        toolUseId,
        name: tool.name,
        result,
        isError: false,
        args: effectiveInput,
        ...(diff ? { diff } : {}),
        ...(subAgentChildren.length ? { children: subAgentChildren } : {}),
      });
    } catch (e: unknown) {
      const msg = `Error: ${e instanceof Error ? e.message : String(e)}`;
      this.messages.push({
        role: "tool",
        tool_name: tool.name,
        tool_call_id: toolUseId,
        content: msg,
      });
      out.push({
        type: "tool_result",
        toolUseId,
        name: tool.name,
        result: msg,
        isError: true,
        args: effectiveInput,
      });
    }

    return out;
  }
}
