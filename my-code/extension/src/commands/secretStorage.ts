import * as vscode from "vscode";

export const OLLAMA_API_KEY = "reno.ollamaApiKey";

export function registerSecretCommands(
  ctx: vscode.ExtensionContext,
): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand("reno.setOllamaApiKey", async () => {
      const value = await vscode.window.showInputBox({
        title: "reno: set Ollama Cloud API key",
        password: true,
        placeHolder: "ollama_…",
        prompt:
          "Stored encrypted in VS Code's SecretStorage. Get a key at https://ollama.com/settings/keys",
      });
      if (value === undefined) return;
      if (!value.trim()) {
        await ctx.secrets.delete(OLLAMA_API_KEY);
        vscode.window.showInformationMessage("reno: API key cleared.");
        return;
      }
      await ctx.secrets.store(OLLAMA_API_KEY, value);
      vscode.window.showInformationMessage("reno: API key saved to SecretStorage.");
    }),
    vscode.commands.registerCommand("reno.clearOllamaApiKey", async () => {
      await ctx.secrets.delete(OLLAMA_API_KEY);
      vscode.window.showInformationMessage("reno: API key cleared.");
    }),
  );
}

export async function readSecretApiKey(
  ctx: vscode.ExtensionContext,
): Promise<string | undefined> {
  return await ctx.secrets.get(OLLAMA_API_KEY);
}
