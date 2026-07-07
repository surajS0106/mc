import type { EditMode } from "../config/permissions.js";
import type { TranscriptItem } from "../ui/types.js";

/**
 * The single source of truth for interactive session state. Replaces the
 * ~20 useState calls that used to live in App.tsx. All mutations go through
 * setAppState (a reducer-style updater) so they stay traceable.
 */
export interface AppState {
  // Transcript — what the user sees scroll by.
  finalized: TranscriptItem[];
  streamingAssistant: string;
  // Live reasoning buffer — accumulated while the model thinks, then folded
  // into a collapsed `reasoning` transcript item on reasoning_done.
  streamingReasoning: string;
  activeTool: TranscriptItem | null;

  // Turn lifecycle.
  busy: boolean;
  thinking: {
    verb: string | null;
    startedAt: number;
  };

  // Model / context.
  currentModel: string;
  contextLength: number | undefined;

  // Token counters (updated once per turn).
  promptTokens: number;
  completionTokens: number;
  lastPromptTokens: number;

  // Permission mode (session-scoped).
  bypassAll: boolean;
  editMode: EditMode;

  // Pending permission prompt (at most one at a time).
  pendingPermission: {
    id: string;
    name: string;
    args: Record<string, unknown>;
    suggestedRules: { session: string; project: string };
  } | null;

  // Overlay screens.
  overlay: "none" | "model-picker" | "status" | "usage" | "accounts";

  // When opening the accounts overlay, whether to jump straight into the
  // guided "add account" flow (set by `/accounts add`).
  accountsAddMode?: boolean;

  // Plan mode — when true, write/edit/bash tools refuse to mutate.
  planMode: boolean;

  // Active git worktree (if user entered one via EnterWorktree).
  worktreePath: string | null;

  // Background tasks
  tasks?: Record<string, any>;
}

export function createInitialAppState(args: {
  model: string;
  bypassAll: boolean;
  editMode: EditMode;
}): AppState {
  return {
    finalized: [],
    streamingAssistant: "",
    streamingReasoning: "",
    activeTool: null,
    busy: false,
    thinking: { verb: null, startedAt: 0 },
    currentModel: args.model,
    contextLength: undefined,
    promptTokens: 0,
    completionTokens: 0,
    lastPromptTokens: 0,
    bypassAll: args.bypassAll,
    editMode: args.editMode,
    pendingPermission: null,
    overlay: "none",
    planMode: false,
    worktreePath: null,
    tasks: {},
  };
}
