import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export type Scope = "session" | "project" | "global";
export type RuleKind = "allow" | "deny";
export type PermissionChoice = "once" | "session" | "project" | "no";

export interface SettingsFile {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  bypassAll?: boolean;
}

export type AutoResult =
  | { kind: "auto-allow"; reason: string }
  | { kind: "auto-deny"; reason: string; locked?: boolean }
  | { kind: "prompt" };

// ─── Hardcoded safety rules (non-bypassable) ────────────────────────────────

const HARDCODED_DENY: Array<{
  tool: string;
  test: (args: Record<string, unknown>) => { match: boolean; reason?: string };
}> = [
  {
    tool: "Bash",
    test: (args) => {
      const cmd = String(args.command ?? "");
      if (/\brm\s+-rf?\s+\/([\s]|$)/.test(cmd)) return { match: true, reason: "rm -rf /" };
      if (/\brm\s+-rf?\s+~\/?([\s]|$)/.test(cmd)) return { match: true, reason: "wiping home" };
      if (/\brm\s+-rf?\s+\*([\s]|$)/.test(cmd)) return { match: true, reason: "wiping with glob" };
      if (/:\s*\(\s*\)\s*\{[^}]*:\s*\|\s*:\s*&\s*\}\s*;/.test(cmd)) return { match: true, reason: "fork bomb" };
      if (/\bmkfs\.[a-z0-9]+\b/.test(cmd)) return { match: true, reason: "format filesystem" };
      if (/\bdd\b[^|]*\bif=[^|]*\bof=\/dev\/(sd|nvme|hd)/.test(cmd))
        return { match: true, reason: "disk overwrite" };
      if (/\bgit\s+push\s+(-f\b|--force(-with-lease)?\b).*\b(main|master)\b/.test(cmd))
        return { match: true, reason: "force push to main/master" };
      if (/\bcurl\b.*\|\s*(sudo\s+)?bash/.test(cmd))
        return { match: true, reason: "pipe-to-bash install" };
      if (/\bchmod\s+[0-7]*777\b/.test(cmd))
        return { match: true, reason: "chmod 777" };
      return { match: false };
    },
  },
];

// ─── Read-only tools that are always allowed (like beta) ─────────────────────
const ALWAYS_ALLOW_TOOLS = new Set(["Read", "Grep", "Glob", "WebSearch", "WebFetch"]);

// ─── File helpers ────────────────────────────────────────────────────────────

function projectSettingsPath(cwd: string): string {
  return path.join(cwd, ".my-code", "settings.json");
}
function globalSettingsPath(): string {
  return path.join(os.homedir(), ".my-code", "settings.json");
}

async function readJsonSafe(p: string): Promise<SettingsFile> {
  try {
    const txt = await fs.readFile(p, "utf8");
    return JSON.parse(txt) as SettingsFile;
  } catch {
    return {};
  }
}
async function writeJson(p: string, data: SettingsFile): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ─── Pattern matching (Phase 3.6 — enhanced) ────────────────────────────────

export function parseRule(rule: string): { tool: string; pattern?: string } {
  const m = rule.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\((.*)\))?$/);
  if (!m) return { tool: rule };
  return { tool: m[1]!, pattern: m[2] };
}

function matchBash(pattern: string, command: string): boolean {
  // Regex patterns: /pattern/
  if (pattern.startsWith("/") && pattern.endsWith("/")) {
    try {
      return new RegExp(pattern.slice(1, -1)).test(command);
    } catch {
      return false;
    }
  }
  // Prefix patterns: cmd:* matches "cmd" and "cmd ..."
  if (pattern.endsWith(":*")) {
    const prefix = pattern.slice(0, -2);
    return command === prefix || command.startsWith(prefix + " ");
  }
  // Exact match
  return pattern === command;
}

function matchPath(pattern: string, p: string): boolean {
  // Normalize separators for cross-platform
  const normP = p.replace(/\\/g, "/");
  const normPattern = pattern.replace(/\\/g, "/");

  if (normPattern === normP) return true;
  // Recursive glob: dir/**
  if (normPattern.endsWith("/**")) {
    const pre = normPattern.slice(0, -3);
    return normP === pre || normP.startsWith(pre + "/");
  }
  // Single-level glob: dir/*
  if (normPattern.endsWith("/*")) {
    const pre = normPattern.slice(0, -2);
    return normP.startsWith(pre + "/") && !normP.slice(pre.length + 1).includes("/");
  }
  // Trailing wildcard: prefix*
  if (normPattern.endsWith("*")) {
    return normP.startsWith(normPattern.slice(0, -1));
  }
  // Extension glob: *.ts, *.md, etc.
  if (normPattern.startsWith("*.")) {
    return normP.endsWith(normPattern.slice(1));
  }
  // ? wildcard (match single char)
  if (normPattern.includes("?")) {
    const regex = new RegExp("^" + normPattern.replace(/\?/g, ".").replace(/\*/g, ".*") + "$");
    return regex.test(normP);
  }
  return false;
}

function matchGrep(pattern: string, query: string): boolean {
  // For Grep, match on the search pattern
  if (pattern === "*") return true;
  return query.includes(pattern);
}

export function matchRule(rule: string, tool: string, args: Record<string, unknown>): boolean {
  const parsed = parseRule(rule);
  if (parsed.tool !== tool) return false;
  if (!parsed.pattern) return true; // bare tool name matches all invocations

  if (tool === "Bash") return matchBash(parsed.pattern, String(args.command ?? ""));
  if (tool === "Write" || tool === "Edit" || tool === "Read" || tool === "multi_replace_file_content" || tool === "replace_file_content" || tool === "write_to_file" || tool === "view_file") {
    const file = String(args.file_path ?? args.TargetFile ?? args.AbsolutePath ?? args.TargetFile ?? "");
    return matchPath(parsed.pattern, file);
  }
  if (tool === "Grep") {
    return matchGrep(parsed.pattern, String(args.pattern ?? ""));
  }
  if (tool === "Glob") {
    return matchPath(parsed.pattern, String(args.pattern ?? ""));
  }
  return false;
}

// ─── Rule suggestion ─────────────────────────────────────────────────────────

export function suggestRule(
  tool: string,
  args: Record<string, unknown>,
  scope: "session" | "project",
  cwd: string = process.cwd()
): string {
  if (tool === "Bash") {
    const cmd = String(args.command ?? "").trim();
    const tokens = cmd.split(/\s+/);
    const first = tokens[0] ?? "";
    const multiSub = new Set([
      "npm", "pnpm", "yarn", "bun", "git", "pip", "pip3", "cargo",
      "docker", "kubectl", "brew", "go", "rustup", "deno",
    ]);
    if (multiSub.has(first) && tokens[1] && !tokens[1].startsWith("-")) {
      return `Bash(${first} ${tokens[1]}:*)`;
    }
    return `Bash(${first}:*)`;
  }
  if (tool === "Write" || tool === "Edit" || tool === "multi_replace_file_content" || tool === "replace_file_content" || tool === "write_to_file") {
    if (scope === "session") {
      // Tool-wide for session: "don't ask again for Write" should mean ALL
      // writes this session, not just this exact file. File-scoped rules are
      // useless after the first file (see Claude Code's behavior).
      return tool;
    }
    const file = String(args.file_path ?? args.TargetFile ?? "");
    const normFile = file.replace(/\\/g, "/");
    const normCwd = cwd.replace(/\\/g, "/");
    if (scope === "project" && normFile.startsWith(normCwd + "/")) {
      return `${tool}(${normCwd}/**)`;
    }
    return `${tool}(${normFile})`;
  }
  return tool;
}

export type EditMode = "normal" | "accept-edits" | "bypass";

// ─── PermissionEngine ────────────────────────────────────────────────────────

export class PermissionEngine {
  private cwd: string;
  private session: { allow: Set<string>; deny: Set<string>; bypassAll: boolean };
  private project: SettingsFile = {};
  private global: SettingsFile = {};
  private _mode: EditMode = "normal";
  /**
   * Tools that MUST prompt every invocation, regardless of any session /
   * project / global allow rules. Used for irreversible side-effects like
   * sending mail or posting chats — we never want a user's earlier "yes
   * for the session" to silently dispatch a subsequent send.
   */
  private alwaysPrompt: Set<string> = new Set();

  constructor(cwd: string) {
    this.cwd = cwd;
    this.session = { allow: new Set(), deny: new Set(), bypassAll: false };
  }

  /** Mark a tool as requiring a fresh prompt every call. */
  addAlwaysPromptTool(toolName: string): void {
    this.alwaysPrompt.add(toolName);
  }

  /** Remove a tool from the always-prompt set. */
  removeAlwaysPromptTool(toolName: string): void {
    this.alwaysPrompt.delete(toolName);
  }

  isAlwaysPrompt(toolName: string): boolean {
    return this.alwaysPrompt.has(toolName);
  }

  get mode(): EditMode {
    if (this.session.bypassAll || this.project.bypassAll || this.global.bypassAll) return "bypass";
    return this._mode;
  }

  setMode(mode: EditMode): void {
    this._mode = mode;
    this.session.bypassAll = mode === "bypass";
  }

  cycleMode(): EditMode {
    const order: EditMode[] = ["normal", "accept-edits", "bypass"];
    const i = order.indexOf(this.mode);
    const next = order[(i + 1) % order.length]!;
    this.setMode(next);
    return next;
  }

  async load(): Promise<void> {
    this.project = await readJsonSafe(projectSettingsPath(this.cwd));
    this.global = await readJsonSafe(globalSettingsPath());
  }

  get bypassAll(): boolean {
    return this.session.bypassAll || !!this.project.bypassAll || !!this.global.bypassAll;
  }

  setSessionBypass(on: boolean): void {
    this.session.bypassAll = on;
  }

  addSessionAllow(rule: string): void {
    this.session.allow.add(rule);
  }
  addSessionDeny(rule: string): void {
    this.session.deny.add(rule);
  }

  /** Remove a session rule. */
  removeSessionRule(kind: RuleKind, rule: string): boolean {
    return kind === "allow"
      ? this.session.allow.delete(rule)
      : this.session.deny.delete(rule);
  }

  async addPersistedRule(scope: "project" | "global", kind: RuleKind, rule: string): Promise<void> {
    const file = scope === "project" ? projectSettingsPath(this.cwd) : globalSettingsPath();
    const current = scope === "project" ? this.project : this.global;
    current.permissions = current.permissions ?? {};
    const list = (current.permissions[kind] = current.permissions[kind] ?? []);
    if (!list.includes(rule)) list.push(rule);
    await writeJson(file, current);
  }

  /** Remove a persisted rule. */
  async removePersistedRule(scope: "project" | "global", kind: RuleKind, rule: string): Promise<boolean> {
    const file = scope === "project" ? projectSettingsPath(this.cwd) : globalSettingsPath();
    const current = scope === "project" ? this.project : this.global;
    const list = current.permissions?.[kind];
    if (!list) return false;
    const idx = list.indexOf(rule);
    if (idx === -1) return false;
    list.splice(idx, 1);
    await writeJson(file, current);
    return true;
  }

  async setPersistedBypass(scope: "project" | "global", on: boolean): Promise<void> {
    const file = scope === "project" ? projectSettingsPath(this.cwd) : globalSettingsPath();
    const current = scope === "project" ? this.project : this.global;
    current.bypassAll = on;
    await writeJson(file, current);
  }

  /** Get all rules across all scopes for display. */
  allRules(): Array<{ scope: Scope; kind: RuleKind; rule: string }> {
    const out: Array<{ scope: Scope; kind: RuleKind; rule: string }> = [];
    for (const r of this.session.allow) out.push({ scope: "session", kind: "allow", rule: r });
    for (const r of this.session.deny) out.push({ scope: "session", kind: "deny", rule: r });
    for (const r of this.project.permissions?.allow ?? []) out.push({ scope: "project", kind: "allow", rule: r });
    for (const r of this.project.permissions?.deny ?? []) out.push({ scope: "project", kind: "deny", rule: r });
    for (const r of this.global.permissions?.allow ?? []) out.push({ scope: "global", kind: "allow", rule: r });
    for (const r of this.global.permissions?.deny ?? []) out.push({ scope: "global", kind: "deny", rule: r });
    return out;
  }

  snapshot() {
    return {
      session: {
        allow: [...this.session.allow],
        deny: [...this.session.deny],
        bypassAll: this.session.bypassAll,
      },
      project: this.project,
      global: this.global,
    };
  }

  suggestRule(tool: string, args: Record<string, unknown>, scope: "session" | "project"): string {
    return suggestRule(tool, args, scope, this.cwd);
  }

  decide(tool: string, args: Record<string, unknown>): AutoResult {
    // 1. Hardcoded deny (non-bypassable)
    for (const rule of HARDCODED_DENY) {
      if (rule.tool !== tool) continue;
      const r = rule.test(args);
      if (r.match) {
        return { kind: "auto-deny", reason: `safety rule: ${r.reason}`, locked: true };
      }
    }

    // 2. Always-allow read-only tools (Phase 3.6)
    if (ALWAYS_ALLOW_TOOLS.has(tool)) {
      return { kind: "auto-allow", reason: "read-only tool" };
    }

    // 3. Bypass all
    if (this.bypassAll) return { kind: "auto-allow", reason: "bypass mode" };

    // 3b. Accept-edits mode auto-approves Write/Edit (not Bash)
    if (this._mode === "accept-edits" && (tool === "Write" || tool === "Edit")) {
      return { kind: "auto-allow", reason: "accept-edits mode" };
    }

    const matches = (rules: string[] | undefined): boolean =>
      !!rules && rules.some((r) => matchRule(r, tool, args));

    // 4. Deny lists checked FIRST (deny takes priority over allow at same scope)
    // Session deny
    if ([...this.session.deny].some((r) => matchRule(r, tool, args)))
      return { kind: "auto-deny", reason: "session deny" };
    // Project deny
    if (matches(this.project.permissions?.deny))
      return { kind: "auto-deny", reason: "project deny" };
    // Global deny
    if (matches(this.global.permissions?.deny))
      return { kind: "auto-deny", reason: "global deny" };

    // 4.5. Always-prompt tools — short-circuit before any allow rule matches.
    // Used for irreversible sends (mail / chat) so a stale "session allow"
    // can never silently fire a later send to the wrong recipient.
    if (this.alwaysPrompt.has(tool)) {
      return { kind: "prompt" };
    }

    // 5. Allow lists (session > project > global)
    if ([...this.session.allow].some((r) => matchRule(r, tool, args)))
      return { kind: "auto-allow", reason: "session allow" };
    if (matches(this.project.permissions?.allow))
      return { kind: "auto-allow", reason: "project allow" };
    if (matches(this.global.permissions?.allow))
      return { kind: "auto-allow", reason: "global allow" };

    return { kind: "prompt" };
  }
}
