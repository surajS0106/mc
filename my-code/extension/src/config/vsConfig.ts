import * as vscode from "vscode";
import type { EditMode } from "../../../src/config/permissions.js";
import { readSecretApiKey } from "../commands/secretStorage.js";

export interface VsResolvedConfig {
  provider: "ollama";
  model: string | undefined;
  ollamaHost: string;
  ollamaApiKey: string | undefined;
  autoCompact: boolean;
  permissionMode: EditMode;
}

const DEFAULT_LOCAL_HOST = "http://localhost:11434";
const CLOUD_HOST = "https://ollama.com";

export async function loadVsConfig(
  ctx?: vscode.ExtensionContext,
): Promise<VsResolvedConfig> {
  const cfg = vscode.workspace.getConfiguration("reno");
  const model = cfg.get<string>("model")?.trim();
  const settingsKey = cfg.get<string>("ollama.apiKey")?.trim();
  const secret = ctx ? await readSecretApiKey(ctx) : undefined;
  const apiKey = secret || settingsKey || undefined;
  const mode = (cfg.get<string>("permissionMode") || "normal") as EditMode;

  // Auto-flip host to Ollama Cloud when an API key is present and the user
  // hasn't customized the host. Mirrors the CLI behavior in src/cli.ts so
  // "I set my key" implies "use cloud" without requiring a second setting.
  const rawHost = cfg.get<string>("ollama.host")?.trim();
  const userCustomizedHost = !!rawHost && rawHost !== DEFAULT_LOCAL_HOST;
  const ollamaHost = userCustomizedHost
    ? rawHost
    : apiKey
      ? CLOUD_HOST
      : DEFAULT_LOCAL_HOST;

  return {
    provider: "ollama",
    model: model ? model : undefined,
    ollamaHost,
    ollamaApiKey: apiKey,
    autoCompact: cfg.get<boolean>("autoCompact") ?? true,
    permissionMode: ["normal", "accept-edits", "bypass"].includes(mode)
      ? mode
      : "normal",
  };
}
