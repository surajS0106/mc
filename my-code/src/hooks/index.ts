/**
 * Hook system — lifecycle hooks that fire before/after tool execution.
 * 
 * Modeled after beta's utils/hooks.ts. Hooks allow external code (plugins,
 * project config, user scripts) to intercept tool calls.
 *
 * Hooks are registered globally and fire for ALL tool calls in the session.
 */

import type { ToolUseContext } from "../tools/Tool.js";

// ─── Hook Types ─────────────────────────────────────────────────────────────

export type HookPhase = "PreToolUse" | "PostToolUse" | "SessionStart" | "SessionEnd";

export interface PreToolUseHookArgs {
  toolName: string;
  input: Record<string, unknown>;
  ctx: ToolUseContext;
}

export interface PreToolUseHookResult {
  /** If set, the tool call is blocked with this message. */
  deny?: string;
  /** If set, the input is modified before the tool runs. */
  modifiedInput?: Record<string, unknown>;
}

export interface PostToolUseHookArgs {
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  isError: boolean;
  ctx: ToolUseContext;
}

export interface PostToolUseHookResult {
  /** If set, the result is replaced with this. */
  modifiedOutput?: string;
}

export interface SessionHookArgs {
  sessionId: string;
  cwd: string;
}

export type PreToolUseHook = (args: PreToolUseHookArgs) => Promise<PreToolUseHookResult | void> | PreToolUseHookResult | void;
export type PostToolUseHook = (args: PostToolUseHookArgs) => Promise<PostToolUseHookResult | void> | PostToolUseHookResult | void;
export type SessionHook = (args: SessionHookArgs) => Promise<void> | void;

// ─── Hook Registry ──────────────────────────────────────────────────────────

interface HookStore {
  preToolUse: PreToolUseHook[];
  postToolUse: PostToolUseHook[];
  sessionStart: SessionHook[];
  sessionEnd: SessionHook[];
}

const store: HookStore = {
  preToolUse: [],
  postToolUse: [],
  sessionStart: [],
  sessionEnd: [],
};

/** Register a hook for a specific lifecycle phase. */
export function registerHook(phase: "PreToolUse", fn: PreToolUseHook): void;
export function registerHook(phase: "PostToolUse", fn: PostToolUseHook): void;
export function registerHook(phase: "SessionStart" | "SessionEnd", fn: SessionHook): void;
export function registerHook(phase: HookPhase, fn: unknown): void {
  switch (phase) {
    case "PreToolUse":
      store.preToolUse.push(fn as PreToolUseHook);
      break;
    case "PostToolUse":
      store.postToolUse.push(fn as PostToolUseHook);
      break;
    case "SessionStart":
      store.sessionStart.push(fn as SessionHook);
      break;
    case "SessionEnd":
      store.sessionEnd.push(fn as SessionHook);
      break;
  }
}

/** Remove all hooks (for testing or session reset). */
export function clearHooks(): void {
  store.preToolUse = [];
  store.postToolUse = [];
  store.sessionStart = [];
  store.sessionEnd = [];
}

/** Get the count of registered hooks. */
export function hookCount(): Record<HookPhase, number> {
  return {
    PreToolUse: store.preToolUse.length,
    PostToolUse: store.postToolUse.length,
    SessionStart: store.sessionStart.length,
    SessionEnd: store.sessionEnd.length,
  };
}

// ─── Hook Execution ─────────────────────────────────────────────────────────

/**
 * Run all PreToolUse hooks. If any hook returns `deny`, the tool is blocked.
 * If any hook returns `modifiedInput`, the last one wins.
 */
export async function runPreToolUseHooks(
  args: PreToolUseHookArgs
): Promise<{ denied: string | null; modifiedInput: Record<string, unknown> | null }> {
  let denied: string | null = null;
  let modifiedInput: Record<string, unknown> | null = null;

  for (const hook of store.preToolUse) {
    try {
      const result = await hook(args);
      if (result?.deny) {
        denied = result.deny;
        break; // First deny wins — stop running hooks
      }
      if (result?.modifiedInput) {
        modifiedInput = result.modifiedInput;
      }
    } catch (e) {
      // Hook errors should not crash the tool — log and continue
      process.stderr.write(
        `  ⚠ PreToolUse hook error: ${e instanceof Error ? e.message : String(e)}\n`
      );
    }
  }

  return { denied, modifiedInput };
}

/**
 * Run all PostToolUse hooks. If any hook returns `modifiedOutput`, the last one wins.
 */
export async function runPostToolUseHooks(
  args: PostToolUseHookArgs
): Promise<{ modifiedOutput: string | null }> {
  let modifiedOutput: string | null = null;

  for (const hook of store.postToolUse) {
    try {
      const result = await hook(args);
      if (result?.modifiedOutput) {
        modifiedOutput = result.modifiedOutput;
      }
    } catch (e) {
      process.stderr.write(
        `  ⚠ PostToolUse hook error: ${e instanceof Error ? e.message : String(e)}\n`
      );
    }
  }

  return { modifiedOutput };
}

/** Run all SessionStart hooks. */
export async function runSessionStartHooks(args: SessionHookArgs): Promise<void> {
  for (const hook of store.sessionStart) {
    try {
      await hook(args);
    } catch (e) {
      process.stderr.write(
        `  ⚠ SessionStart hook error: ${e instanceof Error ? e.message : String(e)}\n`
      );
    }
  }
}

/** Run all SessionEnd hooks. */
export async function runSessionEndHooks(args: SessionHookArgs): Promise<void> {
  for (const hook of store.sessionEnd) {
    try {
      await hook(args);
    } catch (e) {
      process.stderr.write(
        `  ⚠ SessionEnd hook error: ${e instanceof Error ? e.message : String(e)}\n`
      );
    }
  }
}
