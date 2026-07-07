import * as vscode from "vscode";
import type { ChatViewProvider } from "../chat/ChatViewProvider.js";
import { captureDiagnosticAt } from "../commands/selection.js";

const COMMAND = "reno.fixDiagnostic";

export class DiagnosticCodeActionProvider
  implements vscode.CodeActionProvider
{
  static readonly providedKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    ctx: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    if (!ctx.diagnostics.length) return [];
    return ctx.diagnostics.map((diag) => {
      const action = new vscode.CodeAction(
        `reno: Fix "${truncate(diag.message, 60)}"`,
        vscode.CodeActionKind.QuickFix,
      );
      action.command = {
        command: COMMAND,
        title: "Fix with reno",
        arguments: [document.uri, diag.range],
      };
      action.diagnostics = [diag];
      return action;
    });
  }
}

export function registerDiagnosticActions(
  ctx: vscode.ExtensionContext,
  provider: ChatViewProvider,
): void {
  ctx.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "*",
      new DiagnosticCodeActionProvider(),
      { providedCodeActionKinds: DiagnosticCodeActionProvider.providedKinds },
    ),
    vscode.commands.registerCommand(
      COMMAND,
      async (uri: vscode.Uri, range: vscode.Range) => {
        const captured = captureDiagnosticAt(uri, range);
        if (!captured) return;
        await provider.reveal();
        provider.attachSelection(captured.selection);
        provider.prefill(
          `Fix this error: ${captured.diagnostic.message}`,
          true,
        );
      },
    ),
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
