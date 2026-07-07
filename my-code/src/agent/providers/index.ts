import type { ChatProvider } from "../provider.js";
import type { ProviderAccount } from "../../config/accounts.js";
import { OllamaProvider } from "./ollama.js";
import { AzureFoundryProvider } from "./azure.js";

export type ProviderName = "ollama" | "openai" | "gemini" | "azure-foundry";

/** Thrown when an account's provider has no chat implementation yet. */
export class ProviderNotWiredError extends Error {
  constructor(public readonly provider: string) {
    super(`Provider "${provider}" is not wired for chat yet.`);
    this.name = "ProviderNotWiredError";
  }
}

/**
 * Build a ChatProvider from a stored account. Single path shared by startup and
 * runtime account-switching. Throws ProviderNotWiredError for providers we store
 * but can't chat with yet (anthropic, azure-foundry).
 */
export function providerFromAccount(acc: ProviderAccount): ChatProvider {
  switch (acc.provider) {
    case "ollama":
      return new OllamaProvider({ host: acc.host, apiKey: acc.apiKey });
    case "azure-foundry":
      // Legacy accounts may lack meta; the account name doubles as the deployment
      // (that's how the desktop stores it), so fall back to it rather than break.
      return new AzureFoundryProvider({
        endpoint: acc.host,
        apiKey: acc.apiKey,
        deployment: acc.meta?.deployment ?? acc.name,
        apiVersion: acc.meta?.apiVersion,
        model: acc.meta?.model ?? acc.meta?.deployment ?? acc.name,
      });
    default:
      throw new ProviderNotWiredError(acc.provider);
  }
}

export interface ProviderFactoryOpts {
  host?: string;
  apiKey?: string;
}

/**
 * Build a ChatProvider by name. Adding a provider = one new file under
 * `providers/` + one case here.
 */
export function getProvider(name: ProviderName, opts: ProviderFactoryOpts = {}): ChatProvider {
  switch (name) {
    case "ollama":
      return new OllamaProvider(opts);
    case "azure-foundry":
      // No name-only construction for Azure — it needs a deployment/endpoint,
      // which only live on a stored account. Use providerFromAccount instead.
      throw new Error(
        'Provider "azure-foundry" requires an account (endpoint + deployment). Add one via /accounts add.'
      );
    case "openai":
      throw new Error(
        'Provider "openai" not yet implemented. Add src/agent/providers/openai.ts and wire it here.'
      );
    case "gemini":
      throw new Error(
        'Provider "gemini" not yet implemented. Add src/agent/providers/gemini.ts and wire it here.'
      );
    default: {
      const _exhaustive: never = name;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}

export function isProviderName(s: string): s is ProviderName {
  return s === "ollama" || s === "openai" || s === "gemini" || s === "azure-foundry";
}

export { OllamaProvider } from "./ollama.js";
export { AzureFoundryProvider } from "./azure.js";
