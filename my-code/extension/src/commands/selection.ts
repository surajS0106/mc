import * as vscode from "vscode";
import type { ChatViewProvider } from "../chat/ChatViewProvider.js";
import type { AttachedSelection } from "../chat/protocol.js";

export function captureActiveSelection(): AttachedSelection | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  const sel = editor.selection;
  if (sel.isEmpty) return undefined;
  const range = new vscode.Range(sel.start, sel.end);
  const text = editor.document.getText(range);
  return {
    uri: editor.document.uri.toString(),
    filePath: vscode.workspace.asRelativePath(editor.document.uri),
    language: editor.document.languageId,
    text,
    startLine: sel.start.line + 1,
    endLine: sel.end.line + 1,
  };
}

export async function sendSelectionToChat(
  provider: ChatViewProvider,
): Promise<void> {
  const sel = captureActiveSelection();
  if (!sel) {
    vscode.window.showInformationMessage(
      "reno: no editor selection. Highlight some code first.",
    );
    return;
  }
  await provider.reveal();
  provider.attachSelection(sel);
}

export async function explainSelection(
  provider: ChatViewProvider,
): Promise<void> {
  const sel = captureActiveSelection();
  if (!sel) {
    vscode.window.showInformationMessage(
      "reno: select code in the editor first.",
    );
    return;
  }
  await provider.reveal();
  provider.attachSelection(sel);
  provider.prefill(`Explain this code from \`${sel.filePath}\`.`, true);
}

export function captureDiagnosticAt(
  uri: vscode.Uri,
  range: vscode.Range,
): { selection: AttachedSelection; diagnostic: vscode.Diagnostic } | undefined {
  const diags = vscode.languages.getDiagnostics(uri);
  const hit = diags.find((d) => d.range.intersection(range));
  if (!hit) return undefined;
  const editor = vscode.window.activeTextEditor;
  const doc = editor?.document.uri.toString() === uri.toString()
    ? editor.document
    : undefined;
  if (!doc) return undefined;
  const expanded = new vscode.Range(
    new vscode.Position(Math.max(0, hit.range.start.line - 2), 0),
    new vscode.Position(
      Math.min(doc.lineCount - 1, hit.range.end.line + 2),
      Number.MAX_SAFE_INTEGER,
    ),
  );
  const text = doc.getText(expanded);
  return {
    selection: {
      uri: doc.uri.toString(),
      filePath: vscode.workspace.asRelativePath(doc.uri),
      language: doc.languageId,
      text,
      startLine: expanded.start.line + 1,
      endLine: expanded.end.line + 1,
    },
    diagnostic: hit,
  };
}
