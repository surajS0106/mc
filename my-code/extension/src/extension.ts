import * as vscode from "vscode";
import { ChatViewProvider } from "./chat/ChatViewProvider.js";
import {
  explainSelection,
  sendSelectionToChat,
} from "./commands/selection.js";
import { registerDiagnosticActions } from "./codeActions/diagnostics.js";
import { registerExplainAction } from "./codeActions/explain.js";
import { registerStatusBar } from "./commands/statusBar.js";
import { registerSecretCommands } from "./commands/secretStorage.js";

let chatProvider: ChatViewProvider | undefined;

export function activate(ctx: vscode.ExtensionContext): void {
  const provider = new ChatViewProvider(ctx);
  chatProvider = provider;

  ctx.subscriptions.push(
    { dispose: () => provider.dispose() },
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    vscode.commands.registerCommand("reno.newChat", () => provider.newChat()),
    vscode.commands.registerCommand("reno.cancelTurn", () => provider.cancel()),
    vscode.commands.registerCommand("reno.useSelection", () =>
      sendSelectionToChat(provider),
    ),
    vscode.commands.registerCommand("reno.explainSelection", () =>
      explainSelection(provider),
    ),
    vscode.commands.registerCommand("reno.pickModel", async () => {
      let installed: string[] = [];
      try {
        installed = await provider.hostRef.listModels();
      } catch {
        /* ignore — fall through to input box */
      }
      let pick: string | undefined;
      if (installed.length > 0) {
        pick = await vscode.window.showQuickPick(installed, {
          title: "reno: pick model",
          placeHolder: provider.hostRef.model,
        });
      } else {
        pick = await vscode.window.showInputBox({
          title: "reno: model name",
          placeHolder: "e.g. qwen2.5-coder:latest",
          value: provider.hostRef.model,
        });
      }
      if (!pick) return;
      provider.hostRef.setModel(pick);
      await vscode.workspace
        .getConfiguration("reno")
        .update("model", pick, vscode.ConfigurationTarget.Global);
    }),
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("reno")) {
        await provider.refreshConfig();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      // When user opens a new folder, reinitialize with the new cwd.
      try {
        await provider.refreshConfig();
      } catch {
        /* best-effort — extension will reinit on next webview ready */
      }
    }),
  );

  registerDiagnosticActions(ctx, provider);
  registerExplainAction(ctx, provider);
  registerStatusBar(ctx, provider);
  registerSecretCommands(ctx);
}

export function deactivate(): void {
  chatProvider?.dispose();
  chatProvider = undefined;
}
