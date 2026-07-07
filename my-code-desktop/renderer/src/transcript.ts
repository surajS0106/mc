/** Flat transcript item model the renderer reduces backend events into. */
import type { DiffPayload, SuggestedRules, ToolChild } from "../../electron/ipc";

export type Item =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string; streaming: boolean }
  | { kind: "thinking"; id: string; text: string; streaming: boolean; durationMs?: number }
  | {
      kind: "tool";
      id: string;
      toolUseId: string;
      name: string;
      args: Record<string, unknown>;
      running: boolean;
      result?: string;
      isError?: boolean;
      diff?: DiffPayload;
      children?: ToolChild[];
    }
  | { kind: "notice"; id: string; tone: "info" | "warn" | "error"; text: string };

export interface PendingPermission {
  toolUseId: string;
  name: string;
  args: Record<string, unknown>;
  suggestedRules: SuggestedRules;
}
