/**
 * Multi-account store. Lets the user register several credentials per provider
 * (e.g. multiple Ollama cloud keys, plus Anthropic / Azure Foundry), switch the
 * active one at runtime, and probe per-account quota.
 *
 * Accounts live in the existing machine-local secret file (~/.my-code/settings.local.json),
 * alongside the legacy single-key fields, which keep working as an implicit
 * "default" account. We read the whole file and rewrite only the account fields
 * so other LocalConfig keys are preserved.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { localConfigPath } from "./globalConfig.js";

/** A supported provider id for accounts. Only "ollama" is wired for chat today. */
export type AccountProvider = "ollama" | "anthropic" | "azure-foundry";

export const ACCOUNT_PROVIDERS: AccountProvider[] = ["ollama", "anthropic", "azure-foundry"];

/** True when the provider can actually be used for chat right now. */
export function isProviderWired(provider: string): boolean {
  return provider === "ollama" || provider === "azure-foundry";
}

export interface ProviderAccount {
  /** `${provider}:${name}` — unique within the store. */
  id: string;
  provider: string;
  /** Friendly label chosen by the user. */
  name: string;
  /** Secret API key. Lives only in settings.local.json. */
  apiKey?: string;
  /** Host / baseURL / endpoint. Optional — inferred per provider when absent. */
  host?: string;
  /** Provider-specific extras (e.g. azure deployment, apiVersion). Future use. */
  meta?: Record<string, string>;
}

/** Shape of the local secret file as far as accounts are concerned. */
interface LocalFileShape {
  accounts?: ProviderAccount[];
  activeAccountId?: string;
  [k: string]: unknown;
}

export function accountId(provider: string, name: string): string {
  return `${provider}:${name}`;
}

/** Web dashboard where the user can see real account usage (no usage API exists). */
export function dashboardUrl(provider: string): string | undefined {
  switch (provider) {
    case "ollama":
      return "https://ollama.com/settings";
    case "anthropic":
      return "https://console.anthropic.com/settings/usage";
    case "azure-foundry":
      return "https://ai.azure.com";
    default:
      return undefined;
  }
}

/** Default endpoint for a provider when the account doesn't specify a host. */
export function defaultHostFor(provider: string): string | undefined {
  switch (provider) {
    case "ollama":
      return "https://ollama.com"; // a key implies cloud
    case "anthropic":
      return "https://api.anthropic.com";
    case "azure-foundry":
      return undefined; // endpoint is per-resource; user supplies it
    default:
      return undefined;
  }
}

async function readLocal(): Promise<LocalFileShape> {
  try {
    return JSON.parse(await fs.readFile(localConfigPath(), "utf8")) as LocalFileShape;
  } catch {
    return {};
  }
}

async function writeLocal(data: LocalFileShape): Promise<void> {
  const p = localConfigPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function listAccounts(): Promise<ProviderAccount[]> {
  return (await readLocal()).accounts ?? [];
}

export async function getActiveAccountId(): Promise<string | undefined> {
  return (await readLocal()).activeAccountId;
}

export async function getActiveAccount(): Promise<ProviderAccount | undefined> {
  const l = await readLocal();
  if (!l.activeAccountId) return undefined;
  return (l.accounts ?? []).find((a) => a.id === l.activeAccountId);
}

/** Add or update an account (keyed by provider+name). Returns the stored record. */
export async function addAccount(
  input: { provider: string; name: string; apiKey?: string; host?: string; meta?: Record<string, string> }
): Promise<ProviderAccount> {
  const l = await readLocal();
  const accounts = l.accounts ?? [];
  const id = accountId(input.provider, input.name);
  const record: ProviderAccount = {
    id,
    provider: input.provider,
    name: input.name,
    apiKey: input.apiKey,
    host: input.host ?? defaultHostFor(input.provider),
    meta: input.meta,
  };
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx >= 0) accounts[idx] = record;
  else accounts.push(record);
  l.accounts = accounts;
  await writeLocal(l);
  return record;
}

/** Remove by id. Returns true if something was removed. Clears active if it matched. */
export async function removeAccount(id: string): Promise<boolean> {
  const l = await readLocal();
  const accounts = l.accounts ?? [];
  const next = accounts.filter((a) => a.id !== id);
  if (next.length === accounts.length) return false;
  l.accounts = next;
  if (l.activeAccountId === id) delete l.activeAccountId;
  await writeLocal(l);
  return true;
}

export async function setActiveAccount(id: string): Promise<void> {
  const l = await readLocal();
  l.activeAccountId = id;
  await writeLocal(l);
}

/** Resolve a user-supplied token to an account, matching id first then name. */
export function resolveAccount(
  accounts: ProviderAccount[],
  idOrName: string
): ProviderAccount | undefined {
  return accounts.find((a) => a.id === idOrName) ?? accounts.find((a) => a.name === idOrName);
}

export function maskKey(key?: string): string {
  if (!key) return "(none)";
  return key.length <= 4 ? "***" : "***" + key.slice(-4);
}
