import type { SessionEvent } from "../../../src/agent/events.js";
import type {
  AttachedSelection,
  DiffStaged,
  PermissionRequest,
} from "../../src/chat/protocol.js";
import type {
  EditMode,
  PermissionChoice,
} from "../../../src/config/permissions.js";

export interface UserMsg {
  kind: "user";
  id: string;
  text: string;
  attachedSelection?: AttachedSelection;
}
export interface AssistantMsg {
  kind: "assistant";
  id: string;
  text: string;
  done: boolean;
}
export interface ToolMsg {
  kind: "tool";
  id: string;
  toolUseId: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "ok" | "error" | "denied";
  result?: string;
  progress?: string;
  diff?: DiffStaged;
  diffState?: "pending" | "applied" | "rejected";
  permissionRequest?: PermissionRequest;
  permissionDecision?: PermissionChoice;
}
export interface NoticeMsg {
  kind: "notice";
  id: string;
  text: string;
  tone: "info" | "warn" | "error";
}
export type ChatMsg = UserMsg | AssistantMsg | ToolMsg | NoticeMsg;

export interface ChatState {
  messages: ChatMsg[];
  busy: boolean;
  model: string;
  cwd: string;
  promptTokens: number;
  completionTokens: number;
  ready: boolean;
  attachedSelection: AttachedSelection | null;
  planMode: boolean;
  permissionMode: EditMode;
}

export const initialState: ChatState = {
  messages: [],
  busy: false,
  model: "",
  cwd: "",
  promptTokens: 0,
  completionTokens: 0,
  ready: false,
  attachedSelection: null,
  planMode: false,
  permissionMode: "normal",
};

export type Action =
  | {
      type: "init";
      model: string;
      cwd: string;
      planMode: boolean;
      permissionMode: EditMode;
    }
  | { type: "model_changed"; model: string }
  | {
      type: "user_submit";
      id: string;
      text: string;
      attachedSelection?: AttachedSelection;
    }
  | { type: "engine_event"; ev: SessionEvent }
  | { type: "set_busy"; busy: boolean }
  | { type: "error"; message: string }
  | { type: "attach_selection"; selection: AttachedSelection }
  | { type: "detach_selection" }
  | { type: "diff_staged"; diff: DiffStaged }
  | {
      type: "diff_resolved";
      toolUseId: string;
      decision: "apply" | "reject" | "applied" | "rejected";
    }
  | { type: "permission_request"; req: PermissionRequest }
  | { type: "permission_resolved"; toolUseId: string }
  | { type: "plan_mode_changed"; planMode: boolean }
  | { type: "permission_mode_changed"; mode: EditMode }
  | { type: "clear" };

export function reducer(s: ChatState, a: Action): ChatState {
  switch (a.type) {
    case "init":
      return {
        ...s,
        model: a.model,
        cwd: a.cwd,
        ready: true,
        planMode: a.planMode,
        permissionMode: a.permissionMode,
      };
    case "model_changed":
      return { ...s, model: a.model };
    case "user_submit":
      return {
        ...s,
        attachedSelection: null,
        messages: [
          ...s.messages,
          {
            kind: "user",
            id: a.id,
            text: a.text,
            attachedSelection: a.attachedSelection,
          },
        ],
      };
    case "set_busy":
      return { ...s, busy: a.busy };
    case "attach_selection":
      return { ...s, attachedSelection: a.selection };
    case "detach_selection":
      return { ...s, attachedSelection: null };
    case "diff_staged":
      return updateTool(s, a.diff.toolUseId, (t) => ({
        ...t,
        diff: a.diff,
        diffState: "pending",
      }));
    case "diff_resolved":
      return updateTool(s, a.toolUseId, (t) => ({
        ...t,
        diffState:
          a.decision === "applied" || a.decision === "apply"
            ? "applied"
            : "rejected",
      }));
    case "permission_request":
      return updateTool(s, a.req.toolUseId, (t) => ({
        ...t,
        permissionRequest: a.req,
      }));
    case "permission_resolved":
      return updateTool(s, a.toolUseId, (t) => ({
        ...t,
        permissionRequest: undefined,
      }));
    case "plan_mode_changed":
      return { ...s, planMode: a.planMode };
    case "permission_mode_changed":
      return { ...s, permissionMode: a.mode };
    case "error":
      return {
        ...s,
        messages: [
          ...s.messages,
          { kind: "notice", id: rid(), text: a.message, tone: "error" },
        ],
      };
    case "clear":
      return {
        ...s,
        messages: [],
        promptTokens: 0,
        completionTokens: 0,
      };
    case "engine_event":
      return applyEngineEvent(s, a.ev);
  }
}

function applyEngineEvent(s: ChatState, ev: SessionEvent): ChatState {
  switch (ev.type) {
    case "turn_start": {
      return {
        ...s,
        messages: [
          ...s.messages,
          {
            kind: "assistant",
            id: `a-${ev.turnId}-${ev.at}`,
            text: "",
            done: false,
          },
        ],
      };
    }
    case "assistant_delta": {
      const msgs = s.messages.slice();
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i]!;
        if (m.kind === "assistant" && !m.done) {
          msgs[i] = { ...m, text: m.text + ev.text };
          return { ...s, messages: msgs };
        }
        if (m.kind === "tool") break;
      }
      return {
        ...s,
        messages: [
          ...s.messages,
          { kind: "assistant", id: rid(), text: ev.text, done: false },
        ],
      };
    }
    case "assistant_done": {
      const msgs = s.messages.slice();
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i]!;
        if (m.kind === "assistant" && !m.done) {
          msgs[i] = { ...m, text: ev.text || m.text, done: true };
          return { ...s, messages: msgs };
        }
      }
      return s;
    }
    case "tool_start": {
      return {
        ...s,
        messages: [
          ...s.messages,
          {
            kind: "tool",
            id: rid(),
            toolUseId: ev.toolUseId,
            name: ev.name,
            args: ev.args,
            status: "running",
          },
        ],
      };
    }
    case "tool_progress": {
      return updateTool(s, ev.toolUseId, (t) => ({ ...t, progress: ev.message }));
    }
    case "tool_result": {
      return updateTool(s, ev.toolUseId, (t) => ({
        ...t,
        status: ev.isError ? "error" : "ok",
        result: ev.result,
        progress: undefined,
        permissionRequest: undefined,
      }));
    }
    case "permission_request": {
      return updateTool(s, ev.toolUseId, (t) => ({
        ...t,
        permissionRequest: {
          toolUseId: ev.toolUseId,
          name: ev.name,
          args: ev.args,
          suggestedRules: ev.suggestedRules,
        },
      }));
    }
    case "permission_decision": {
      return updateTool(s, ev.toolUseId, (t) => ({
        ...t,
        permissionDecision: ev.choice,
        permissionRequest: undefined,
      }));
    }
    case "auto_decision": {
      if (ev.decision === "deny") {
        return updateTool(s, ev.toolUseId, (t) => ({
          ...t,
          status: "denied",
          result: ev.reason,
        }));
      }
      return s;
    }
    case "token_stats": {
      return {
        ...s,
        promptTokens: ev.promptTokens ?? s.promptTokens,
        completionTokens: ev.completionTokens ?? s.completionTokens,
      };
    }
    case "notice": {
      return {
        ...s,
        messages: [
          ...s.messages,
          { kind: "notice", id: rid(), text: ev.message, tone: ev.tone },
        ],
      };
    }
    case "auto_compact": {
      return {
        ...s,
        messages: [
          ...s.messages,
          {
            kind: "notice",
            id: rid(),
            text: `Auto-compacted (dropped ${ev.droppedCount}, freed ~${ev.freedTokens} tokens)`,
            tone: "info",
          },
        ],
      };
    }
    default:
      return s;
  }
}

function updateTool(
  s: ChatState,
  toolUseId: string,
  patch: (t: ToolMsg) => ToolMsg,
): ChatState {
  const msgs = s.messages.slice();
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]!;
    if (m.kind === "tool" && m.toolUseId === toolUseId) {
      msgs[i] = patch(m);
      return { ...s, messages: msgs };
    }
  }
  return s;
}

let counter = 0;
export function rid(): string {
  counter += 1;
  return `m-${Date.now()}-${counter}`;
}
