import * as vscode from "vscode";
import { EngineHost } from "../runtime/EngineHost.js";
import { runSlash } from "../commands/slash.js";
import { SettingsBackend } from "./SettingsBackend.js";
import type {
  AttachedSelection,
  HostMessage,
  WebviewMessage,
} from "./protocol.js";

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "reno.chatView";
  private view: vscode.WebviewView | undefined;
  private host: EngineHost;
  private ctx: vscode.ExtensionContext;
  private initPromise: Promise<void> | undefined;
  private settings: SettingsBackend;

  constructor(ctx: vscode.ExtensionContext) {
    this.ctx = ctx;
    this.settings = new SettingsBackend(ctx, () => this.host);
    this.host = new EngineHost(ctx, {
      onEvent: (ev) => this.post({ type: "engine_event", ev }),
      onStatus: (busy) => this.post({ type: "status", busy }),
      onError: (message) => this.post({ type: "error", message }),
      onDiffStaged: (diff) => this.post({ type: "diff_staged", diff }),
      onDiffResolved: (toolUseId, decision) =>
        this.post({ type: "diff_resolved", toolUseId, decision }),
      onPermissionRequest: (req) => this.post({ type: "permission_request", req }),
      onPermissionResolved: (toolUseId) =>
        this.post({ type: "permission_resolved", toolUseId }),
      onPlanModeChanged: (planMode) =>
        this.post({ type: "plan_mode_changed", planMode }),
    });
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    // Reset the init promise so re-opening or changing workspace re-initializes.
    this.initPromise = undefined;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.ctx.extensionUri, "out"),
        vscode.Uri.joinPath(this.ctx.extensionUri, "media"),
      ],
    };
    view.webview.html = this.render(view.webview);

    view.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      try {
        if (await this.settings.handle(msg, (m) => this.post(m))) return;
      } catch {
        /* settings handler shouldn't crash the loop */
      }
      switch (msg.type) {
        case "ready": {
          this.initPromise ??= this.host.init();
          try {
            await this.initPromise;
          } catch (e: unknown) {
            this.initPromise = undefined; // allow retry on next ready
            this.post({
              type: "error",
              message: e instanceof Error ? e.message : String(e),
            });
            return;
          }
          this.post({
            type: "init",
            model: this.host.model,
            provider: "ollama",
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "",
            planMode: this.host.planMode,
            permissionMode: this.host.currentEditMode,
          });
          break;
        }
        case "submit":
          await this.host.submit(msg.text);
          break;
        case "cancel":
          this.host.cancel();
          break;
        case "new_chat":
          this.host.resetConversation();
          break;
        case "open_file":
          await openFile(msg.filePath, msg.line);
          break;
        case "open_diff":
          await this.host.openDiff(msg.toolUseId);
          break;
        case "diff_decision":
          this.host.resolveDiff(msg.toolUseId, msg.decision);
          break;
        case "permission_decision":
          this.host.resolvePermission(msg.toolUseId, msg.choice);
          break;
        case "toggle_plan_mode": {
          const next = this.host.togglePlanMode();
          this.post({ type: "plan_mode_changed", planMode: next });
          break;
        }
        case "set_permission_mode":
          this.host.setPermissionMode(msg.mode);
          this.post({ type: "permission_mode_changed", mode: msg.mode });
          break;
        case "slash": {
          await this.dispatchSlash(msg.cmd, msg.args);
          break;
        }
        case "request_session_list":
          await this.sendSessionList(msg.all);
          break;
        case "resume_session":
          await this.resumeSession(msg.sessionId);
          break;
        case "find_files":
          await this.findFiles(msg.query, msg.reqId);
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
          this.host.setModel(msg.model);
          await vscode.workspace
            .getConfiguration("reno")
            .update("model", msg.model, vscode.ConfigurationTarget.Global);
          this.post({ type: "model_changed", model: msg.model });
          break;
        }
      }
    });
  }

  private async findFiles(query: string, reqId: number): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      this.post({ type: "files_found", reqId, files: [] });
      return;
    }
    try {
      const include = new vscode.RelativePattern(
        vscode.workspace.workspaceFolders?.[0] ?? "",
        `**/*${trimmed}*`,
      );
      const found = await vscode.workspace.findFiles(
        include,
        "**/{node_modules,dist,out,build,.git}/**",
        20,
      );
      const files = found.map((u) => {
        const rel = vscode.workspace.asRelativePath(u);
        const basename = rel.split(/[\\/]/).pop() ?? rel;
        return { relPath: rel, basename };
      });
      this.post({ type: "files_found", reqId, files });
    } catch (e: unknown) {
      this.post({ type: "files_found", reqId, files: [] });
    }
  }

  private async dispatchSlash(cmd: string, args: string[]): Promise<void> {
    try {
      const out = await runSlash(this.host, cmd, args);
      if (out.notice) {
        this.post({
          type: "engine_event",
          ev: {
            type: "notice",
            message: out.notice.text,
            tone: out.notice.tone,
          },
        });
      }
      if (out.sessions) {
        this.post({ type: "session_list", sessions: out.sessions });
      }
      if (out.submit) {
        await this.host.submit(out.submit);
      }
    } catch (e: unknown) {
      this.post({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private async sendSessionList(all: boolean): Promise<void> {
    const { listSessionMetas, listAllSessionMetas } = await import(
      "../../../src/session/transcript.js"
    );
    try {
      const sessions = all
        ? await listAllSessionMetas(30)
        : await listSessionMetas(this.host.cwdPath);
      this.post({ type: "session_list", sessions });
    } catch (e: unknown) {
      this.post({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private async resumeSession(sessionId: string): Promise<void> {
    const { sessionDir } = await import(
      "../../../src/session/projectStore.js"
    );
    const { messagesFromTranscript } = await import(
      "../../../src/session/transcript.js"
    );
    const filePath = `${sessionDir(this.host.cwdPath)}/${sessionId}.jsonl`;
    const messages = await messagesFromTranscript(filePath);
    if (!messages) {
      this.post({
        type: "error",
        message: "Could not load session (no checkpoint found).",
      });
      return;
    }
    this.host.setMessages(messages);
    this.post({
      type: "engine_event",
      ev: {
        type: "notice",
        message: `✔ resumed: loaded ${messages.length} messages`,
        tone: "info",
      },
    });
  }

  async reveal(): Promise<void> {
    if (this.view) {
      this.view.show?.(true);
      return;
    }
    await vscode.commands.executeCommand("reno.chatView.focus");
  }

  attachSelection(selection: AttachedSelection): void {
    this.post({ type: "selection_attached", selection });
  }

  prefill(text: string, autosend = false): void {
    this.post({ type: "prefill", text, autosend });
  }

  cancel(): void {
    this.host.cancel();
  }

  newChat(): void {
    this.host.resetConversation();
  }

  async refreshConfig(): Promise<void> {
    await this.host.refreshConfig();
    this.post({ type: "model_changed", model: this.host.model });
  }

  dispose(): void {
    try {
      this.host.dispose();
    } catch {
      /* best-effort cleanup during window reload */
    }
  }

  /** Used by status-bar etc to read current state without a round-trip. */
  get hostRef(): EngineHost {
    return this.host;
  }

  private post(msg: HostMessage): void {
    this.view?.webview.postMessage(msg);
  }

  private render(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, "out", "webview.js"),
    );
    const nonce = randomNonce();
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`,
    ].join("; ");
    return /* html */ `<!doctype html>
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
</html>`;
  }
}

async function openFile(filePath: string, line?: number): Promise<void> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  const uri =
    filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath)
      ? vscode.Uri.file(filePath)
      : ws
        ? vscode.Uri.joinPath(ws.uri, filePath)
        : vscode.Uri.file(filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, {
    preview: false,
    viewColumn: vscode.ViewColumn.Active,
  });
  if (typeof line === "number" && line > 0) {
    const pos = new vscode.Position(Math.max(0, line - 1), 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(
      new vscode.Range(pos, pos),
      vscode.TextEditorRevealType.InCenter,
    );
  }
}

function randomNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let n = "";
  for (let i = 0; i < 32; i++)
    n += chars[Math.floor(Math.random() * chars.length)];
  return n;
}
