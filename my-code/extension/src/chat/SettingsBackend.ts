import * as vscode from "vscode";
import { OLLAMA_API_KEY, readSecretApiKey } from "../commands/secretStorage.js";
import type { EngineHost } from "../runtime/EngineHost.js";
import type {
  HostMessage,
  SettingsKey,
  SettingsSnapshot,
  WebviewMessage,
} from "./protocol.js";

type Poster = (msg: HostMessage) => void;

export class SettingsBackend {
  private outputChannel: vscode.OutputChannel | undefined;

  constructor(
    private ctx: vscode.ExtensionContext,
    private getHost: () => EngineHost | undefined,
  ) {}

  /**
   * Returns true if the message was handled by this backend.
   * Lets ChatViewProvider/SettingsPanel keep one big switch.
   */
  async handle(msg: WebviewMessage, post: Poster): Promise<boolean> {
    switch (msg.type) {
      case "settings_get":
        post({
          type: "settings_snapshot",
          settings: await this.readSnapshot(),
        });
        return true;
      case "settings_update":
        await this.applyUpdate(msg.key, msg.value, post);
        return true;
      case "settings_test_connection":
        await this.testConnection(post);
        return true;
      case "settings_open_native":
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "@ext:reno.reno",
        );
        return true;
      case "list_models": {
        const host = this.getHost();
        if (!host) {
          post({ type: "models_list", models: [] });
          return true;
        }
        try {
          const models = await host.listModels();
          post({ type: "models_list", models });
        } catch {
          post({ type: "models_list", models: [] });
        }
        return true;
      }
      default:
        return false;
    }
  }

  async readSnapshot(): Promise<SettingsSnapshot> {
    const cfg = vscode.workspace.getConfiguration("reno");
    const secret = await readSecretApiKey(this.ctx);
    const settingsKey = cfg.get<string>("ollama.apiKey")?.trim() || "";
    const ext = vscode.extensions.getExtension("reno.reno");
    const version =
      (ext?.packageJSON as { version?: string } | undefined)?.version ??
      "0.0.0";
    return {
      provider: "ollama",
      model: cfg.get<string>("model") ?? "",
      ollamaHost: cfg.get<string>("ollama.host") ?? "http://localhost:11434",
      hasApiKey: !!(secret || settingsKey),
      autoCompact: cfg.get<boolean>("autoCompact") ?? true,
      permissionMode:
        (cfg.get<string>("permissionMode") as
          | "normal"
          | "accept-edits"
          | "bypass") ?? "normal",
      customInstructions: cfg.get<string>("customInstructions") ?? "",
      version,
    };
  }

  private async applyUpdate(
    key: SettingsKey,
    value: string | boolean,
    post: Poster,
  ): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("reno");
    const Global = vscode.ConfigurationTarget.Global;
    const host = this.getHost();
    try {
      switch (key) {
        case "model":
          await cfg.update("model", String(value), Global);
          host?.setModel(String(value));
          break;
        case "ollamaHost":
          await cfg.update("ollama.host", String(value), Global);
          break;
        case "apiKey": {
          const v = String(value);
          if (v.trim()) {
            await this.ctx.secrets.store(OLLAMA_API_KEY, v);
          } else {
            await this.ctx.secrets.delete(OLLAMA_API_KEY);
          }
          break;
        }
        case "autoCompact":
          await cfg.update("autoCompact", !!value, Global);
          break;
        case "permissionMode": {
          const v = String(value) as "normal" | "accept-edits" | "bypass";
          await cfg.update("permissionMode", v, Global);
          host?.setPermissionMode(v);
          break;
        }
        case "customInstructions":
          await cfg.update("customInstructions", String(value), Global);
          break;
      }
      post({ type: "settings_saved", key });
      post({
        type: "settings_snapshot",
        settings: await this.readSnapshot(),
      });
    } catch (e: unknown) {
      post({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private async testConnection(post: Poster): Promise<void> {
    const host = this.getHost();
    if (!host) {
      post({
        type: "engine_event",
        ev: {
          type: "notice",
          message: "Engine not initialized yet — open a chat first.",
          tone: "warn",
        },
      });
      return;
    }
    try {
      const models = await host.listModels();
      const tone: "info" | "error" = models.length > 0 ? "info" : "error";
      const message =
        models.length > 0
          ? `✓ Connected — ${models.length} model${models.length === 1 ? "" : "s"} available`
          : "Connected but no models found.";
      post({
        type: "engine_event",
        ev: { type: "notice", message, tone },
      });
    } catch (e: unknown) {
      post({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
