import type { SessionEvent } from "../../../src/agent/events.js";
import type { PermissionChoice } from "../../../src/config/permissions.js";

export interface AttachedSelection {
  uri: string;
  filePath: string;
  language: string;
  text: string;
  startLine: number;
  endLine: number;
}

export interface DiffStaged {
  toolUseId: string;
  op: "Edit" | "Write";
  filePath: string;
  beforeBytes: number;
  afterBytes: number;
  addedLines: number;
  removedLines: number;
  preview: string;
}

export interface PermissionRequest {
  toolUseId: string;
  name: string;
  args: Record<string, unknown>;
  suggestedRules: { session: string; project: string };
}

export interface SettingsSnapshot {
  provider: "ollama";
  model: string;
  ollamaHost: string;
  hasApiKey: boolean;
  autoCompact: boolean;
  permissionMode: "normal" | "accept-edits" | "bypass";
  customInstructions: string;
  version: string;
}

export type SettingsKey =
  | "model"
  | "ollamaHost"
  | "apiKey"
  | "autoCompact"
  | "permissionMode"
  | "customInstructions";

export type HostMessage =
  | {
      type: "init";
      model: string;
      provider: string;
      cwd: string;
      planMode: boolean;
      permissionMode: "normal" | "accept-edits" | "bypass";
    }
  | { type: "engine_event"; ev: SessionEvent }
  | { type: "status"; busy: boolean }
  | { type: "model_changed"; model: string }
  | { type: "selection_attached"; selection: AttachedSelection }
  | { type: "prefill"; text: string; autosend?: boolean }
  | { type: "diff_staged"; diff: DiffStaged }
  | {
      type: "diff_resolved";
      toolUseId: string;
      decision: "apply" | "reject" | "applied" | "rejected";
    }
  | { type: "permission_request"; req: PermissionRequest }
  | { type: "permission_resolved"; toolUseId: string }
  | { type: "plan_mode_changed"; planMode: boolean }
  | {
      type: "permission_mode_changed";
      mode: "normal" | "accept-edits" | "bypass";
    }
  | {
      type: "files_found";
      reqId: number;
      files: Array<{ relPath: string; basename: string }>;
    }
  | {
      type: "session_list";
      sessions: Array<{
        id: string;
        cwd: string;
        model: string;
        startedAt: number;
        turns: number;
        promptTokens: number;
        completionTokens: number;
      }>;
    }
  | { type: "models_list"; models: string[] }
  | { type: "settings_snapshot"; settings: SettingsSnapshot }
  | { type: "settings_saved"; key: SettingsKey }
  | { type: "error"; message: string };

export type WebviewMessage =
  | { type: "ready" }
  | {
      type: "submit";
      text: string;
      attachedSelection?: AttachedSelection;
    }
  | { type: "slash"; cmd: string; args: string[] }
  | { type: "cancel" }
  | { type: "new_chat" }
  | { type: "open_file"; filePath: string; line?: number }
  | { type: "open_diff"; toolUseId: string }
  | { type: "diff_decision"; toolUseId: string; decision: "apply" | "reject" }
  | {
      type: "permission_decision";
      toolUseId: string;
      choice: PermissionChoice;
    }
  | { type: "toggle_plan_mode" }
  | {
      type: "set_permission_mode";
      mode: "normal" | "accept-edits" | "bypass";
    }
  | { type: "request_session_list"; all: boolean }
  | { type: "resume_session"; sessionId: string }
  | { type: "find_files"; query: string; reqId: number }
  | { type: "list_models" }
  | { type: "set_model"; model: string }
  | { type: "settings_get" }
  | {
      type: "settings_update";
      key: SettingsKey;
      value: string | boolean;
    }
  | { type: "settings_test_connection" }
  | { type: "settings_open_native" };
