import type { ChatMessage, ToolCall } from "./types.js";
import type { PermissionChoice } from "../config/permissions.js";

/**
 * Public stream of events emitted by QueryEngine.submitMessage(). Both the REPL
 * and the `-p` print mode consume this — so every UI state change has exactly
 * one canonical source.
 */
export type SessionEvent =
  | { type: "turn_start"; turnId: number; at: number }
  | { type: "assistant_delta"; text: string }
  | { type: "assistant_done"; text: string }
  | { type: "reasoning_delta"; text: string }
  | { type: "reasoning_done"; text: string; durationMs: number }
  | {
      type: "tool_start";
      toolUseId: string;
      name: string;
      args: Record<string, unknown>;
    }
  | {
      type: "tool_progress";
      toolUseId: string;
      message: string;
    }
  | {
      type: "tool_result";
      toolUseId: string;
      name: string;
      result: string;
      isError: boolean;
      /** The tool's input args — carried here so parallel tools render summaries. */
      args?: Record<string, unknown>;
      /** Structured diff for the UI (real file line numbers). Edit/Write. */
      diff?: { filePath: string; before: string; after: string; startLine: number };
      /** Completed child tool calls when this is a subagent (Agent) call. */
      children?: Array<{
        name: string;
        args: Record<string, unknown>;
        result?: string;
        isError?: boolean;
      }>;
    }
  | {
      type: "permission_request";
      toolUseId: string;
      name: string;
      args: Record<string, unknown>;
      suggestedRules: { session: string; project: string };
    }
  | {
      type: "permission_decision";
      toolUseId: string;
      choice: PermissionChoice;
      reason?: string;
    }
  | {
      type: "auto_decision";
      toolUseId: string;
      name: string;
      decision: "allow" | "deny";
      reason: string;
    }
  | {
      type: "token_stats";
      promptTokens: number | undefined;
      completionTokens: number | undefined;
    }
  | {
      type: "notice";
      message: string;
      tone: "info" | "warn" | "error";
    }
  | {
      type: "auto_compact";
      droppedCount: number;
      freedTokens: number;
    }
  | {
      type: "checkpoint";
      messages: ChatMessage[];
    }
  | {
      type: "turn_end";
      turnId: number;
      reason: "complete" | "aborted" | "max_iterations";
    };

export type PermissionPromptFn = (args: {
  toolUseId: string;
  name: string;
  args: Record<string, unknown>;
  suggestedRules: { session: string; project: string };
  signal: AbortSignal;
}) => Promise<PermissionChoice>;

/** Convenience: unwrap a tool_call's tool_use_id (Ollama calls may lack an id). */
export function toolUseIdOf(call: ToolCall, fallback: string): string {
  return call.id ?? fallback;
}
