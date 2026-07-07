import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { ProviderAccount } from "./accounts.js";

// ─── Config hierarchy (lowest priority → highest priority) ──────────────────
//
// 1. User config:    ~/.my-code/config.json          — global defaults
// 2. Project config: <cwd>/.my-code/config.json      — per-project overrides
// 3. Local config:   ~/.my-code/settings.local.json   — machine-local secrets
// 4. Env vars:       MY_CODE_PROVIDER, MY_CODE_MODEL, etc. — highest priority
// ─────────────────────────────────────────────────────────────────────────────

// ~/.my-code/config.json — shareable global defaults
export interface GlobalConfig {
  provider?: string; // "ollama" | "openai" | "gemini"
  defaultModel?: string;
  ollamaHost?: string;
  openaiBaseUrl?: string;
  geminiBaseUrl?: string;
}

// ~/.my-code/settings.local.json — machine-local secrets, never commit
export interface LocalConfig {
  ollamaApiKey?: string;
  ollamaHost?: string; // can override host per-machine
  openaiApiKey?: string;
  geminiApiKey?: string;
  /** Multi-account store (see config/accounts.ts). */
  accounts?: ProviderAccount[];
  activeAccountId?: string;
}

export interface ResolvedConfig {
  provider?: string;
  defaultModel?: string;
  ollamaHost?: string;
  ollamaApiKey?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  geminiApiKey?: string;
  geminiBaseUrl?: string;
  /** All configured accounts + which one is active (from settings.local.json). */
  accounts?: ProviderAccount[];
  activeAccountId?: string;
  /** Which source contributed each key (for debugging). */
  _sources?: Record<string, string>;
}

export function myCodeDir(): string {
  return path.join(os.homedir(), ".my-code");
}

export function oldRenoDir(): string {
  return path.join(os.homedir(), ".reno");
}

export async function autoMigrate(): Promise<void> {
  const oldDir = oldRenoDir();
  const newDir = myCodeDir();

  try {
    const oldStat = await fs.stat(oldDir);
    if (!oldStat.isDirectory()) return;

    try {
      const newStat = await fs.stat(newDir);
      if (newStat.isDirectory()) {
        // new dir already exists, do not overwrite
        return;
      }
    } catch {
      // new dir does not exist, safe to rename
    }

    // Rename ~/.reno to ~/.my-code
    await fs.rename(oldDir, newDir);
    
    // NOTE: This does not migrate project-local .reno to .my-code.
    // It is out of scope unless we scan the whole disk, which is impractical.
  } catch {
    // ignore if .reno doesn't exist or permissions error
  }
}

export function configPath(): string {
  return path.join(myCodeDir(), "config.json");
}

export function localConfigPath(): string {
  return path.join(myCodeDir(), "settings.local.json");
}

/** Project-level config: <cwd>/.my-code/config.json */
export function projectConfigPath(cwd?: string): string {
  return path.join(cwd ?? process.cwd(), ".my-code", "config.json");
}

async function readJsonSafe<T>(p: string): Promise<Partial<T>> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8")) as T;
  } catch {
    return {};
  }
}

async function writeJsonSafe(p: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Load and merge config from all 4 levels.
 * Priority (highest wins): env vars > local > project > user.
 */
export async function loadConfig(cwd?: string): Promise<ResolvedConfig> {
  await autoMigrate();

  const [userCfg, projectCfg, localCfg] = await Promise.all([
    readJsonSafe<GlobalConfig>(configPath()),
    readJsonSafe<GlobalConfig>(projectConfigPath(cwd)),
    readJsonSafe<LocalConfig>(localConfigPath()),
  ]);

  // Merge: user < project < local < env
  const sources: Record<string, string> = {};

  const pick = <T>(key: string, ...layers: Array<{ val: T | undefined; src: string }>) => {
    for (const layer of layers.reverse()) {
      if (layer.val !== undefined) {
        sources[key] = layer.src;
        return layer.val;
      }
    }
    return undefined;
  };

  // Active account is an explicit user choice — it wins for its provider's
  // resolved key/host. Only Ollama is wired for chat today.
  const accounts = localCfg.accounts ?? [];
  const activeId = localCfg.activeAccountId;
  const activeAccount = activeId ? accounts.find((a) => a.id === activeId) : undefined;
  const activeOllama = activeAccount?.provider === "ollama" ? activeAccount : undefined;

  return {
    accounts,
    activeAccountId: activeId,
    provider: pick("provider",
      { val: userCfg.provider, src: "user" },
      { val: projectCfg.provider, src: "project" },
      { val: process.env.MY_CODE_PROVIDER, src: "env" },
    ),
    defaultModel: pick("defaultModel",
      { val: userCfg.defaultModel, src: "user" },
      { val: projectCfg.defaultModel, src: "project" },
      { val: process.env.MY_CODE_MODEL, src: "env" },
    ),
    ollamaHost: pick("ollamaHost",
      { val: userCfg.ollamaHost, src: "user" },
      { val: projectCfg.ollamaHost, src: "project" },
      { val: localCfg.ollamaHost, src: "local" },
      { val: process.env.OLLAMA_HOST, src: "env" },
      { val: activeOllama?.host, src: "account" },
    ),
    ollamaApiKey: pick("ollamaApiKey",
      { val: localCfg.ollamaApiKey, src: "local" },
      { val: process.env.OLLAMA_API_KEY, src: "env" },
      { val: activeOllama?.apiKey, src: "account" },
    ),
    openaiApiKey: pick("openaiApiKey",
      { val: localCfg.openaiApiKey, src: "local" },
      { val: process.env.OPENAI_API_KEY, src: "env" },
    ),
    openaiBaseUrl: pick("openaiBaseUrl",
      { val: userCfg.openaiBaseUrl, src: "user" },
      { val: projectCfg.openaiBaseUrl, src: "project" },
      { val: process.env.OPENAI_BASE_URL, src: "env" },
    ),
    geminiApiKey: pick("geminiApiKey",
      { val: localCfg.geminiApiKey, src: "local" },
      { val: process.env.GEMINI_API_KEY, src: "env" },
    ),
    geminiBaseUrl: pick("geminiBaseUrl",
      { val: userCfg.geminiBaseUrl, src: "user" },
      { val: projectCfg.geminiBaseUrl, src: "project" },
    ),
    _sources: sources,
  };
}

// Key aliases for user convenience
function normalizeKey(key: string): string {
  if (key === "model") return "defaultModel";
  if (key === "apiKey" || key === "api-key") return "ollamaApiKey";
  if (key === "host") return "ollamaHost";
  return key;
}

const SECRET_KEYS = new Set(["ollamaApiKey", "openaiApiKey", "geminiApiKey"]);

// Write a config value; secrets go to settings.local.json, rest to config.json
export async function setConfigKey(key: string, value: string): Promise<{ file: string; key: string }> {
  const nk = normalizeKey(key);
  const isSecret = SECRET_KEYS.has(nk);
  const file = isSecret ? localConfigPath() : configPath();
  const current = isSecret
    ? await readJsonSafe<LocalConfig>(file)
    : await readJsonSafe<GlobalConfig>(file);
  (current as Record<string, unknown>)[nk] = value;
  await writeJsonSafe(file, current);
  return { file, key: nk };
}

export async function getConfigValue(key: string): Promise<string | undefined> {
  const cfg = await loadConfig();
  const nk = normalizeKey(key);
  return (cfg as Record<string, unknown>)[nk] as string | undefined;
}

function maskSecret(s: string): string {
  return "***" + s.slice(-4);
}

export async function listConfig(): Promise<Record<string, string>> {
  const cfg = await loadConfig();
  const out: Record<string, string> = {};
  if (cfg.provider) out.provider = cfg.provider;
  if (cfg.defaultModel) out.defaultModel = cfg.defaultModel;
  if (cfg.ollamaHost) out.ollamaHost = cfg.ollamaHost;
  if (cfg.ollamaApiKey) out.ollamaApiKey = maskSecret(cfg.ollamaApiKey);
  if (cfg.openaiApiKey) out.openaiApiKey = maskSecret(cfg.openaiApiKey);
  if (cfg.openaiBaseUrl) out.openaiBaseUrl = cfg.openaiBaseUrl;
  if (cfg.geminiApiKey) out.geminiApiKey = maskSecret(cfg.geminiApiKey);
  if (cfg.geminiBaseUrl) out.geminiBaseUrl = cfg.geminiBaseUrl;
  return out;
}

