import * as vscode from "vscode";
import type { ChatViewProvider } from "../chat/ChatViewProvider.js";

export function registerStatusBar(
  ctx: vscode.ExtensionContext,
  provider: ChatViewProvider,
): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  item.command = "reno.pickModel";
  item.tooltip = "reno: click to switch model";
  item.text = "$(comment-discussion) reno";
  item.show();
  ctx.subscriptions.push(item);

  const update = () => {
    const host = provider.hostRef;
    const model = host.model || "(no model)";
    const t = host.statsTotals();
    const tokens = t.promptTokens + t.completionTokens;
    const tokStr =
      tokens > 0
        ? tokens >= 1000
          ? `${(tokens / 1000).toFixed(1)}k`
          : `${tokens}`
        : "—";
    const planTag = host.planMode ? " · plan" : "";
    const modeTag = host.currentEditMode === "bypass" ? " · bypass" : "";
    item.text = `$(comment-discussion) ${shortModel(model)} · ${tokStr}${planTag}${modeTag}`;
  };

  // Tick once a second; cheap, and reflects token deltas during streams.
  const interval = setInterval(update, 1000);
  ctx.subscriptions.push({
    dispose: () => clearInterval(interval),
  });
  update();
  return item;
}

function shortModel(m: string): string {
  return m.split(":")[0]!;
}
