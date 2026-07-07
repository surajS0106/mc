/**
 * Read/write access to my-code's own config files, used by the Settings panels.
 * Mirrors the shapes in my-code/src/config/*. All paths are the same ones
 * `my-code serve` reads at startup, so writing here + restarting the backend
 * applies the change.
 *
 *   ~/.my-code/config.json          provider, defaultModel, ollamaHost
 *   ~/.my-code/settings.local.json  apiKeys, accounts, activeAccountId
 *   ~/.my-code/settings.json        global permissions { allow, deny }
 *   <cwd>/.my-code/settings.json    project permissions
 *   ~/.my-code/skills/*.md          user skills
 */

import { readFile, writeFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { AccountMeta } from "./ipc.js";

function mcDir(): string {
  return join(homedir(), ".my-code");
}
async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}
async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ─── config.json (global) ───
export interface GlobalConfig {
  provider?: string;
  defaultModel?: string;
  ollamaHost?: string;
}
const configPath = () => join(mcDir(), "config.json");
export const readGlobalConfig = () => readJson<GlobalConfig>(configPath(), {});
export async function patchGlobalConfig(patch: Partial<GlobalConfig>): Promise<void> {
  const cur = await readGlobalConfig();
  await writeJson(configPath(), { ...cur, ...patch });
}

// ─── settings.local.json (secrets + accounts) ───
export interface ProviderAccount {
  id: string;
  provider: string;
  name: string;
  apiKey?: string;
  host?: string;
  meta?: AccountMeta;
}
export interface LocalConfig {
  ollamaApiKey?: string;
  ollamaHost?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  accounts?: ProviderAccount[];
  activeAccountId?: string;
}
const localPath = () => join(mcDir(), "settings.local.json");
export const readLocalConfig = () => readJson<LocalConfig>(localPath(), {});
export async function patchLocalConfig(patch: Partial<LocalConfig>): Promise<void> {
  const cur = await readLocalConfig();
  await writeJson(localPath(), { ...cur, ...patch });
}

const accountId = (provider: string, name: string) => `${provider}:${name}`;
function defaultHostFor(provider: string): string | undefined {
  if (provider === "ollama") return "http://localhost:11434";
  if (provider === "openai") return "https://api.openai.com/v1";
  if (provider === "gemini") return "https://generativelanguage.googleapis.com";
  return undefined;
}
export async function listAccounts(): Promise<{ accounts: ProviderAccount[]; activeId?: string }> {
  const l = await readLocalConfig();
  return { accounts: l.accounts ?? [], activeId: l.activeAccountId };
}
export async function addAccount(input: {
  provider: string;
  name: string;
  apiKey?: string;
  host?: string;
  meta?: AccountMeta;
}): Promise<void> {
  const l = await readLocalConfig();
  const accounts = l.accounts ?? [];
  const id = accountId(input.provider, input.name);
  const rec: ProviderAccount = {
    id,
    provider: input.provider,
    name: input.name,
    apiKey: input.apiKey,
    host: input.host || defaultHostFor(input.provider),
    meta: input.meta,
  };
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx >= 0) accounts[idx] = rec;
  else accounts.push(rec);
  await patchLocalConfig({ accounts });
}
export async function removeAccount(id: string): Promise<void> {
  const l = await readLocalConfig();
  const accounts = (l.accounts ?? []).filter((a) => a.id !== id);
  const activeAccountId = l.activeAccountId === id ? undefined : l.activeAccountId;
  await writeJson(localPath(), { ...l, accounts, activeAccountId });
}
export async function setActiveAccount(id: string): Promise<void> {
  await patchLocalConfig({ activeAccountId: id });
}

// ─── settings.json (permissions) ───
export type RuleKind = "allow" | "deny";
export interface PermScope {
  allow: string[];
  deny: string[];
}
interface SettingsFile {
  permissions?: { allow?: string[]; deny?: string[] };
}
const globalSettingsPath = () => join(mcDir(), "settings.json");
const projectSettingsPath = (cwd: string) => join(cwd, ".my-code", "settings.json");

export async function readPermissions(cwd: string | null): Promise<{ global: PermScope; project: PermScope }> {
  const g = await readJson<SettingsFile>(globalSettingsPath(), {});
  const p = cwd ? await readJson<SettingsFile>(projectSettingsPath(cwd), {}) : {};
  const norm = (s: SettingsFile): PermScope => ({
    allow: s.permissions?.allow ?? [],
    deny: s.permissions?.deny ?? [],
  });
  return { global: norm(g), project: norm(p as SettingsFile) };
}
export async function editPermissionRule(opts: {
  scope: "global" | "project";
  kind: RuleKind;
  rule: string;
  op: "add" | "remove";
  cwd: string | null;
}): Promise<void> {
  const path = opts.scope === "global" ? globalSettingsPath() : projectSettingsPath(opts.cwd ?? homedir());
  const f = await readJson<SettingsFile>(path, {});
  if (!f.permissions) f.permissions = {};
  const arr = new Set(f.permissions[opts.kind] ?? []);
  if (opts.op === "add") arr.add(opts.rule);
  else arr.delete(opts.rule);
  f.permissions[opts.kind] = [...arr];
  await writeJson(path, f);
}

// ─── Azure Foundry: parse credentials from a .env file (for prefill) ───
export interface AzureEnvDefaults {
  host?: string;
  apiKey?: string;
  apiVersion?: string;
  deployment?: string;
  model?: string;
}

/** Minimal dotenv line parser: KEY=VALUE, ignores comments/blanks, strips quotes and `export `. */
function parseDotenv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.replace(/^export\s+/, "").match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    // Strip surrounding matching quotes.
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

/**
 * Read AZURE_OPENAI_* fields from a .env file so the desktop can pre-fill the
 * add-account form. Returns null if the file can't be read. Never persists.
 */
export async function readAzureEnvDefaults(path: string): Promise<AzureEnvDefaults | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return null;
  }
  const e = parseDotenv(raw);
  return {
    host: e.AZURE_OPENAI_BASE_URL || undefined,
    apiKey: e.AZURE_OPENAI_API_KEY || undefined,
    apiVersion: e.AZURE_OPENAI_API_VERSION || undefined,
    deployment: e.AZURE_DEPLOYMENT_NAME || undefined,
    model: e.AZURE_MODEL_NAME || undefined,
  };
}

// ─── models via Ollama /api/tags ───
export async function fetchModels(host?: string, apiKey?: string): Promise<string[]> {
  const base = (host || "http://localhost:11434").replace(/\/+$/, "");
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await fetch(`${base}/api/tags`, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name?: string; model?: string }[] };
    return (data.models ?? []).map((m) => m.name || m.model || "").filter(Boolean);
  } catch {
    return [];
  }
}

// ─── skills ───
export interface SkillInfo {
  name: string;
  description: string;
  whenToUse?: string;
  source: "bundled" | "user" | "project";
  path?: string; // absent for bundled (read-only)
  body: string;
}
function userSkillsDir(): string {
  return join(mcDir(), "skills");
}
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) meta[kv[1].trim()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body: m[2] };
}
async function loadFromDir(dir: string, source: SkillInfo["source"]): Promise<SkillInfo[]> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const out: SkillInfo[] = [];
  for (const f of files) {
    const full = join(dir, f);
    try {
      const raw = await readFile(full, "utf8");
      const { meta, body } = parseFrontmatter(raw);
      out.push({
        name: meta.name || f.replace(/\.md$/, ""),
        description: meta.description || "",
        whenToUse: meta.when_to_use || meta.whenToUse,
        source,
        path: source === "bundled" ? undefined : full,
        body,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}
export async function listSkills(cwd: string | null, bundledDir?: string): Promise<SkillInfo[]> {
  const bundled = bundledDir ? await loadFromDir(bundledDir, "bundled") : [];
  const user = await loadFromDir(userSkillsDir(), "user");
  const project = cwd ? await loadFromDir(join(cwd, ".my-code", "skills"), "project") : [];
  return [...bundled, ...user, ...project];
}
export async function saveSkill(fileName: string, content: string): Promise<string> {
  const dir = userSkillsDir();
  await mkdir(dir, { recursive: true });
  const safe = fileName.replace(/[^\w.-]/g, "-").replace(/\.md$/, "") + ".md";
  const full = join(dir, safe);
  await writeFile(full, content, "utf8");
  return full;
}
export async function deleteSkillFile(path: string): Promise<void> {
  // Only allow deleting inside the user skills dir.
  if (!path.startsWith(userSkillsDir())) return;
  await rm(path, { force: true });
}
export function userSkillsFolder(): string {
  return userSkillsDir();
}

// ─── usage ───
export interface ModelUsage {
  model: string;
  turns: number;
  promptTokens: number;
  completionTokens: number;
}
export interface UsageSummary {
  today: ModelUsage[];
  week: ModelUsage[];
  all: ModelUsage[];
  sessionCount: number;
}
interface SessionMetaFile {
  model?: string;
  startedAt?: number;
  endedAt?: number;
  turns?: number;
  promptTokens?: number;
  completionTokens?: number;
}
function addTo(map: Map<string, ModelUsage>, m: SessionMetaFile): void {
  const key = m.model || "unknown";
  const cur = map.get(key) ?? { model: key, turns: 0, promptTokens: 0, completionTokens: 0 };
  cur.turns += m.turns ?? 0;
  cur.promptTokens += m.promptTokens ?? 0;
  cur.completionTokens += m.completionTokens ?? 0;
  map.set(key, cur);
}
export async function aggregateUsage(nowMs: number): Promise<UsageSummary> {
  const projectsDir = join(mcDir(), "projects");
  const today = new Map<string, ModelUsage>();
  const week = new Map<string, ModelUsage>();
  const all = new Map<string, ModelUsage>();
  let sessionCount = 0;
  const dayStart = new Date(nowMs);
  dayStart.setHours(0, 0, 0, 0);
  const dayMs = dayStart.getTime();
  const weekMs = nowMs - 7 * 24 * 60 * 60 * 1000;

  let projects: string[];
  try {
    projects = await readdir(projectsDir);
  } catch {
    return { today: [], week: [], all: [], sessionCount: 0 };
  }
  for (const p of projects) {
    const sdir = join(projectsDir, p, "sessions");
    let files: string[];
    try {
      files = (await readdir(sdir)).filter((f) => f.endsWith(".meta.json"));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        const meta = JSON.parse(await readFile(join(sdir, f), "utf8")) as SessionMetaFile;
        const when = meta.endedAt ?? meta.startedAt ?? 0;
        sessionCount++;
        addTo(all, meta);
        if (when >= weekMs) addTo(week, meta);
        if (when >= dayMs) addTo(today, meta);
      } catch {
        /* skip */
      }
    }
  }
  const sort = (m: Map<string, ModelUsage>) =>
    [...m.values()].sort((a, b) => b.promptTokens + b.completionTokens - (a.promptTokens + a.completionTokens));
  return { today: sort(today), week: sort(week), all: sort(all), sessionCount };
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
