import * as vscode from "vscode";

const SCHEME = "reno-diff";

/**
 * Stages before/after content under a virtual URI scheme so we can hand them
 * to `vscode.diff` for native side-by-side rendering. Each staged edit is
 * keyed by toolUseId; .before and .after are independent virtual files.
 */
export class DiffPreviewRegistry implements vscode.TextDocumentContentProvider {
  private staged = new Map<string, { before: string; after: string; filePath: string }>();
  private emitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.emitter.event;

  static register(ctx: vscode.ExtensionContext): DiffPreviewRegistry {
    const registry = new DiffPreviewRegistry();
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(SCHEME, registry),
    );
    return registry;
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const [side, toolUseId] = uri.path.split("/");
    if (!toolUseId) return "";
    const e = this.staged.get(toolUseId);
    if (!e) return "";
    return side === "before" ? e.before : e.after;
  }

  stage(toolUseId: string, filePath: string, before: string, after: string): void {
    this.staged.set(toolUseId, { before, after, filePath });
    this.emitter.fire(this.uriFor(toolUseId, "before"));
    this.emitter.fire(this.uriFor(toolUseId, "after"));
  }

  clear(toolUseId: string): void {
    this.staged.delete(toolUseId);
  }

  uriFor(toolUseId: string, side: "before" | "after"): vscode.Uri {
    const e = this.staged.get(toolUseId);
    const ext = e ? extOf(e.filePath) : "txt";
    return vscode.Uri.parse(
      `${SCHEME}:/${side}/${toolUseId}/${encodeURIComponent(
        e ? basename(e.filePath) : "file",
      )}.${ext}`,
    );
  }

  async openDiff(toolUseId: string): Promise<void> {
    const e = this.staged.get(toolUseId);
    if (!e) return;
    const before = this.uriFor(toolUseId, "before");
    const after = this.uriFor(toolUseId, "after");
    await vscode.commands.executeCommand(
      "vscode.diff",
      before,
      after,
      `reno: ${basename(e.filePath)} (proposed)`,
    );
  }
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}

function extOf(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i > 0 ? b.slice(i + 1) : "txt";
}
