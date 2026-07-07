import { useCallback, useEffect, useReducer, useState } from "react";
import { initialState, reducer, rid } from "./state.js";
import { onHostMessage, postToHost } from "./vscode.js";
import type { PermissionChoice, EditMode } from "../../../src/config/permissions.js";
import type {
  PermissionRequest,
  SettingsKey,
  SettingsSnapshot,
} from "../../src/chat/protocol.js";
import { MessageList } from "./components/MessageList.js";
import { Composer } from "./components/Composer.js";
import { WelcomeCard } from "./components/WelcomeCard.js";
import { SessionList } from "./components/SessionList.js";
import { Header } from "./components/Header.js";
import { ApprovalBar } from "./components/ApprovalBar.js";
import { StatusPill } from "./components/StatusPill.js";
import { SettingsView } from "./components/SettingsView.js";
import type { ToolMsg } from "./state.js";

interface SessionMeta {
  id: string;
  cwd: string;
  model: string;
  startedAt: number;
  turns: number;
  promptTokens: number;
  completionTokens: number;
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [prefill, setPrefill] = useState<{ text: string; tag: number } | null>(
    null,
  );
  const [sessionPanel, setSessionPanel] = useState<SessionMeta[] | null>(null);
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [savedKey, setSavedKey] = useState<SettingsKey | null>(null);

  useEffect(() => {
    const off = onHostMessage((msg) => {
      switch (msg.type) {
        case "init":
          dispatch({
            type: "init",
            model: msg.model,
            cwd: msg.cwd,
            planMode: msg.planMode,
            permissionMode: msg.permissionMode,
          });
          break;
        case "model_changed":
          dispatch({ type: "model_changed", model: msg.model });
          break;
        case "engine_event":
          dispatch({ type: "engine_event", ev: msg.ev });
          break;
        case "status":
          dispatch({ type: "set_busy", busy: msg.busy });
          break;
        case "error":
          dispatch({ type: "error", message: msg.message });
          break;
        case "selection_attached":
          dispatch({ type: "attach_selection", selection: msg.selection });
          break;
        case "prefill":
          if (msg.autosend) {
            const id = rid();
            dispatch({ type: "user_submit", id, text: msg.text });
            postToHost({ type: "submit", text: msg.text });
          } else {
            setPrefill({ text: msg.text, tag: Date.now() });
          }
          break;
        case "diff_staged":
          dispatch({ type: "diff_staged", diff: msg.diff });
          break;
        case "diff_resolved":
          dispatch({
            type: "diff_resolved",
            toolUseId: msg.toolUseId,
            decision: msg.decision,
          });
          break;
        case "permission_request":
          dispatch({ type: "permission_request", req: msg.req });
          break;
        case "permission_resolved":
          dispatch({ type: "permission_resolved", toolUseId: msg.toolUseId });
          break;
        case "plan_mode_changed":
          dispatch({ type: "plan_mode_changed", planMode: msg.planMode });
          break;
        case "permission_mode_changed":
          dispatch({ type: "permission_mode_changed", mode: msg.mode });
          break;
        case "session_list":
          setSessionPanel(msg.sessions);
          break;
        case "models_list":
          setModels(msg.models);
          break;
        case "settings_snapshot":
          setSettings(msg.settings);
          break;
        case "settings_saved":
          setSavedKey(msg.key);
          break;
      }
    });
    postToHost({ type: "ready" });
    return off;
  }, []);

  useEffect(() => {
    if (!savedKey) return;
    const t = setTimeout(() => setSavedKey(null), 1500);
    return () => clearTimeout(t);
  }, [savedKey]);

  function openSettings() {
    setView("settings");
    postToHost({ type: "settings_get" });
  }
  function closeSettings() {
    setView("chat");
  }
  const requestModels = useCallback(() => {
    postToHost({ type: "list_models" });
  }, []);

  // Collect any pending permission requests from the message thread.
  const pendingApprovals: PermissionRequest[] = [];
  let activeTool: ToolMsg | null = null;
  let lastTool: ToolMsg | null = null;
  for (const m of state.messages) {
    if (m.kind !== "tool") continue;
    if (m.permissionRequest) pendingApprovals.push(m.permissionRequest);
    if (m.status === "running") activeTool = m;
    lastTool = m;
  }

  // Global keyboard: Alt+Enter approves first pending; Esc rejects it.
  useEffect(() => {
    if (pendingApprovals.length === 0) return;
    function onKey(e: KeyboardEvent) {
      if (pendingApprovals.length === 0) return;
      const first = pendingApprovals[0];
      if (!first) return;
      if (e.key === "Enter" && e.altKey) {
        e.preventDefault();
        postToHost({
          type: "permission_decision",
          toolUseId: first.toolUseId,
          choice: "once",
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingApprovals]);

  function submit(text: string) {
    const sel = state.attachedSelection ?? undefined;
    const composedText = sel
      ? `${text}\n\n— Selection from \`${sel.filePath}:${sel.startLine}-${sel.endLine}\`:\n\n\`\`\`${sel.language}\n${sel.text}\n\`\`\``
      : text;
    dispatch({
      type: "user_submit",
      id: rid(),
      text,
      attachedSelection: sel,
    });
    postToHost({ type: "submit", text: composedText, attachedSelection: sel });
  }

  function cancel() {
    postToHost({ type: "cancel" });
  }

  function newChat() {
    postToHost({ type: "new_chat" });
    dispatch({ type: "clear" });
  }

  function detachSelection() {
    dispatch({ type: "detach_selection" });
  }

  function onPermissionDecision(toolUseId: string, choice: PermissionChoice) {
    postToHost({ type: "permission_decision", toolUseId, choice });
  }

  function onDiffDecision(toolUseId: string, decision: "apply" | "reject") {
    postToHost({ type: "diff_decision", toolUseId, decision });
  }

  function onOpenDiff(toolUseId: string) {
    postToHost({ type: "open_diff", toolUseId });
  }

  function onSlash(cmd: string, args: string[]) {
    postToHost({ type: "slash", cmd, args });
  }

  function resumeSession(id: string) {
    postToHost({ type: "resume_session", sessionId: id });
    setSessionPanel(null);
  }

  function openHistory() {
    postToHost({ type: "request_session_list", all: false });
  }

  function togglePlan() {
    postToHost({ type: "toggle_plan_mode" });
  }

  function cyclePermMode() {
    const order: EditMode[] = ["normal", "accept-edits", "bypass"];
    const i = order.indexOf(state.permissionMode);
    const next = order[(i + 1) % order.length]!;
    postToHost({ type: "set_permission_mode", mode: next });
  }

  function setModel(model: string) {
    postToHost({ type: "set_model", model });
  }

  return (
    <div className="app">
      {view === "settings" && (
        <SettingsView
          settings={settings}
          models={models}
          savedKey={savedKey}
          onClose={closeSettings}
          onRequestModels={requestModels}
        />
      )}
      <div className="chat-shell" style={view === "chat" ? undefined : { display: "none" }}>
      <Header
        model={state.model}
        cwd={state.cwd}
        promptTokens={state.promptTokens}
        completionTokens={state.completionTokens}
        onNewChat={newChat}
        onHistory={openHistory}
        onOpenSettings={openSettings}
      />
      <MessageList
        messages={state.messages}
        empty={<WelcomeCard onQuickAction={(text) => setPrefill({ text, tag: Date.now() })} />}
        footer={
          <StatusPill
            busy={state.busy}
            activeTool={activeTool}
            lastTool={lastTool}
          />
        }
        onPermissionDecision={onPermissionDecision}
        onDiffDecision={onDiffDecision}
        onOpenDiff={onOpenDiff}
      />
      {pendingApprovals.length > 0 && (
        <div className="approval-stack">
          {pendingApprovals.map((req) => (
            <ApprovalBar
              key={req.toolUseId}
              request={req}
              onDecide={(choice) => onPermissionDecision(req.toolUseId, choice)}
            />
          ))}
        </div>
      )}
      <div className="composer-wrap">
        <Composer
          busy={state.busy}
          attachedSelection={state.attachedSelection}
          prefill={prefill}
          model={state.model}
          planMode={state.planMode}
          permissionMode={state.permissionMode}
          onSubmit={submit}
          onSlash={onSlash}
          onCancel={cancel}
          onDetachSelection={detachSelection}
          onTogglePlan={togglePlan}
          onCyclePermMode={cyclePermMode}
          onSetModel={setModel}
        />
      </div>
      <div className="disclaimer">
        AI may make mistakes. Double-check all generated code.
      </div>
      {sessionPanel && (
        <SessionList
          sessions={sessionPanel}
          onResume={resumeSession}
          onClose={() => setSessionPanel(null)}
        />
      )}
      </div>
    </div>
  );
}
