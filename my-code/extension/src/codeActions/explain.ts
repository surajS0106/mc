import * as vscode from "vscode";
import type { ChatViewProvider } from "../chat/ChatViewProvider.js";
import { captureActiveSelection } from "../commands/selection.js";

const COMMAND = "reno.explainRange";

export class ExplainCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedKinds = [vscode.CodeActionKind.RefactorExtract];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] {
    if (range.isEmpty) return [];
    const action = new vscode.CodeAction(
      "reno: Explain this",
      vscode.CodeActionKind.RefactorExtract,
    );
    action.command = {
      command: COMMAND,
      title: "Explain with reno",
      arguments: [document.uri, range],
    };
    return [action];
  }
}

export function registerExplainAction(
  ctx: vscode.ExtensionContext,
  provider: ChatViewProvider,
): void {
  ctx.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "*",
      new ExplainCodeActionProvider(),
      { providedCodeActionKinds: ExplainCodeActionProvider.providedKinds },
    ),
    vscode.commands.registerCommand(
      COMMAND,
      async (uri: vscode.Uri, range: vscode.Range) => {
        const editor = await vscode.window.showTextDocument(uri);
        editor.selection = new vscode.Selection(range.start, range.end);
        const sel = captureActiveSelection();
        if (!sel) return;
        await provider.reveal();
        provider.attachSelection(sel);
        provider.prefill(`Explain this code from \`${sel.filePath}\`.`, true);
      },
    ),
  );
}
