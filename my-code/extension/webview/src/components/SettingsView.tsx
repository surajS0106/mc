import { useEffect, useMemo, useRef, useState } from "react";
import { postToHost } from "../vscode.js";
import type {
  SettingsKey,
  SettingsSnapshot,
} from "../../../src/chat/protocol.js";
import {
  ArrowLeftIcon,
  BookIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  CubeIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  FlaskIcon,
  GearIcon,
  GlobeIcon,
  InfoIcon,
  RobotIcon,
  SearchIcon,
  TerminalIcon,
  WrenchIcon,
} from "./Icons.js";
import type { ComponentType } from "react";

type Tab =
  | "general"
  | "agent"
  | "models"
  | "tools"
  | "rules"
  | "slash"
  | "network"
  | "beta"
  | "about";

interface NavItem {
  id: Tab;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavGroup {
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    items: [
      { id: "general", label: "General", hint: "account, reset", icon: GearIcon },
      { id: "agent", label: "Agent", hint: "permissions, plan, compact", icon: RobotIcon },
      { id: "models", label: "Models", hint: "model picker, api keys", icon: CubeIcon },
    ],
  },
  {
    items: [
      { id: "tools", label: "Tools & MCP", hint: "built-in tools, mcp servers", icon: WrenchIcon },
      { id: "rules", label: "Rules", hint: "custom instructions", icon: BookIcon },
      { id: "slash", label: "Slash commands", hint: "available commands", icon: TerminalIcon },
    ],
  },
  {
    items: [
      { id: "network", label: "Network", hint: "host, debug logging", icon: GlobeIcon },
      { id: "beta", label: "Beta", hint: "experimental flags", icon: FlaskIcon },
    ],
  },
  {
    items: [{ id: "about", label: "About", hint: "version, links", icon: InfoIcon }],
  },
];

export function SettingsView({
  settings,
  models,
  savedKey,
  onClose,
  onRequestModels,
}: {
  settings: SettingsSnapshot | null;
  models: string[];
  savedKey: SettingsKey | null;
  onClose: () => void;
  onRequestModels: () => void;
}) {
  const [tab, setTab] = useState<Tab>("general");
  const [search, setSearch] = useState("");

  const filteredNav = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.map((g) => ({
      items: g.items.filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.hint.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  return (
    <div className="cs-shell">
      <div className="cs-topbar">
        <button
          type="button"
          className="cs-topbar-btn"
          title="Back to chat"
          onClick={onClose}
        >
          <ArrowLeftIcon />
        </button>
        <span className="cs-topbar-title">Settings</span>
        <span className="cs-topbar-spacer" />
        <button
          type="button"
          className="cs-topbar-btn"
          title="Close"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="cs-root">
        <aside className="cs-rail">
          <AccountCard settings={settings} />
          <div className="cs-search">
            <SearchIcon className="cs-search-icon" />
            <input
              type="text"
              placeholder="Search settings"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <nav className="cs-nav">
            {filteredNav.map((g, gi) => (
              <div key={gi} className="cs-nav-group">
                {g.items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className={"cs-nav-item" + (tab === it.id ? " active" : "")}
                    onClick={() => setTab(it.id)}
                    title={it.hint}
                  >
                    <it.icon className="cs-nav-icon" />
                    <span className="cs-nav-label">{it.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className="cs-main">
        {!settings && <div className="cs-loading">Loading…</div>}
        {settings && tab === "general" && <GeneralPane settings={settings} savedKey={savedKey} />}
        {settings && tab === "agent" && <AgentPane settings={settings} savedKey={savedKey} />}
        {settings && tab === "models" && (
          <ModelsPane
            settings={settings}
            models={models}
            savedKey={savedKey}
            onRequestModels={onRequestModels}
          />
        )}
        {settings && tab === "tools" && <ToolsPane />}
        {settings && tab === "rules" && <RulesPane settings={settings} savedKey={savedKey} />}
        {settings && tab === "slash" && <SlashPane />}
        {settings && tab === "network" && <NetworkPane settings={settings} savedKey={savedKey} />}
        {settings && tab === "beta" && <BetaPane />}
        {settings && tab === "about" && <AboutPane settings={settings} />}
        </main>
      </div>
    </div>
  );
}

function AccountCard({ settings }: { settings: SettingsSnapshot | null }) {
  const cloud = settings?.hasApiKey ?? false;
  return (
    <div className="cs-account">
      <div className="cs-account-avatar">M</div>
      <div className="cs-account-text">
        <div className="cs-account-name">reno</div>
        <div className="cs-account-plan">{cloud ? "Cloud" : "Local"}</div>
      </div>
    </div>
  );
}

function update(key: SettingsKey, value: string | boolean) {
  postToHost({ type: "settings_update", key, value });
}

function PaneHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="cs-pane-head">
      <h1 className="cs-pane-title">{title}</h1>
      {subtitle && <p className="cs-pane-sub">{subtitle}</p>}
    </header>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cs-card">
      {title && (
        <header className="cs-card-head">
          <h2 className="cs-card-title">{title}</h2>
          {description && <p className="cs-card-sub">{description}</p>}
        </header>
      )}
      <div className="cs-card-body">{children}</div>
    </section>
  );
}

function Row({
  label,
  description,
  saved,
  control,
}: {
  label: string;
  description?: string;
  saved?: boolean;
  control: React.ReactNode;
}) {
  return (
    <div className="cs-row">
      <div className="cs-row-text">
        <div className="cs-row-label">
          {label}
          {saved && <SavedFlag />}
        </div>
        {description && <div className="cs-row-desc">{description}</div>}
      </div>
      <div className="cs-row-control">{control}</div>
    </div>
  );
}

function SavedFlag() {
  return (
    <span className="cs-saved">
      <CheckIcon /> Saved
    </span>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={"cs-toggle" + (checked ? " on" : "")}
      onClick={() => onChange(!checked)}
    >
      <span className="cs-toggle-thumb" />
    </button>
  );
}

/* ─── General ─── */

function GeneralPane({
  settings,
  savedKey,
}: {
  settings: SettingsSnapshot;
  savedKey: SettingsKey | null;
}) {
  void savedKey;
  return (
    <>
      <PaneHeader title="General" />
      <Card title="Connection">
        <div className="cs-conn">
          <span
            className={
              "cs-status-dot " + (settings.hasApiKey ? "ok" : "info")
            }
          />
          <div className="cs-conn-text">
            <strong>{settings.hasApiKey ? "Ollama Cloud" : "Local only"}</strong>
            <span>{settings.ollamaHost}</span>
          </div>
          <button
            type="button"
            className="cs-btn"
            onClick={() => postToHost({ type: "settings_test_connection" })}
          >
            Test connection
          </button>
        </div>
      </Card>

      <Card title="Workspace">
        <Row
          label="Clear chat history"
          description="Remove all messages from the active session."
          control={
            <button
              type="button"
              className="cs-btn"
              onClick={() => postToHost({ type: "new_chat" })}
            >
              Clear
            </button>
          }
        />
        <Row
          label="Open VS Code Settings"
          description="Edit reno settings in the native settings UI."
          control={
            <button
              type="button"
              className="cs-btn"
              onClick={() => postToHost({ type: "settings_open_native" })}
            >
              <ExternalLinkIcon /> Open
            </button>
          }
        />
      </Card>
    </>
  );
}

/* ─── Agent ─── */

function AgentPane({
  settings,
  savedKey,
}: {
  settings: SettingsSnapshot;
  savedKey: SettingsKey | null;
}) {
  return (
    <>
      <PaneHeader title="Agent" subtitle="Control how reno edits files and runs commands." />
      <Card title="Permission mode">
        <div className="cs-segmented">
          {(["normal", "accept-edits", "bypass"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={
                "cs-segment" +
                (settings.permissionMode === m ? " active" : "") +
                (m === "bypass" ? " danger" : "")
              }
              onClick={() => update("permissionMode", m)}
            >
              {m === "normal" && "Normal"}
              {m === "accept-edits" && "Accept edits"}
              {m === "bypass" && "Bypass"}
            </button>
          ))}
        </div>
        <ul className="cs-mode-help">
          <li>
            <strong>Normal</strong> — ask before each edit and shell command.
          </li>
          <li>
            <strong>Accept edits</strong> — auto-apply file edits, still ask for shell.
          </li>
          <li>
            <strong>Bypass</strong> — allow everything without prompting. Dangerous.
          </li>
        </ul>
        {savedKey === "permissionMode" && <SavedFlag />}
      </Card>

      <Card title="Conversation">
        <Row
          label="Auto-compact"
          description="Summarize older messages when the context window fills."
          saved={savedKey === "autoCompact"}
          control={
            <Toggle
              checked={settings.autoCompact}
              onChange={(v) => update("autoCompact", v)}
            />
          }
        />
        <Row
          label="Plan mode default"
          description="Start every chat in read-only plan mode. (Coming soon.)"
          control={<Toggle checked={false} onChange={() => undefined} />}
        />
        <Row
          label="Selection auto-attach"
          description="Auto-attach editor selection when you press Ctrl+L. (Coming soon.)"
          control={<Toggle checked={true} onChange={() => undefined} />}
        />
      </Card>
    </>
  );
}

/* ─── Models ─── */

function ModelsPane({
  settings,
  models,
  savedKey,
  onRequestModels,
}: {
  settings: SettingsSnapshot;
  models: string[];
  savedKey: SettingsKey | null;
  onRequestModels: () => void;
}) {
  const [search, setSearch] = useState("");
  const [reveal, setReveal] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [modelInput, setModelInput] = useState(settings.model);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!requestedRef.current) {
      requestedRef.current = true;
      onRequestModels();
    }
  }, [onRequestModels]);

  useEffect(() => setModelInput(settings.model), [settings.model]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.toLowerCase().includes(q));
  }, [models, search]);

  return (
    <>
      <PaneHeader title="Models" />
      <Card>
        <div className="cs-card-toolbar">
          <div className="cs-search inline">
            <SearchIcon className="cs-search-icon" />
            <input
              type="text"
              placeholder="Add or search model"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              list="cs-models"
            />
            <datalist id="cs-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <button
            type="button"
            className="cs-icon-btn"
            title="Refresh installed models"
            onClick={onRequestModels}
          >
            <RefreshSvg />
          </button>
        </div>

        {search && filtered.length === 0 && (
          <div className="cs-list-row">
            <span className="cs-list-label">"{search}"</span>
            <button
              type="button"
              className="cs-btn primary"
              onClick={() => update("model", search.trim())}
            >
              Use this model
            </button>
          </div>
        )}

        {filtered.length === 0 && !search && (
          <div className="cs-empty">
            No models installed. Type a name in the box above to use it anyway.
          </div>
        )}

        {filtered.map((m) => {
          const isCurrent = m === settings.model;
          return (
            <div key={m} className="cs-list-row">
              <span className="cs-list-label">
                {m}
                {isCurrent && <span className="cs-tag">Default</span>}
              </span>
              <Toggle
                checked={isCurrent}
                onChange={() => {
                  if (!isCurrent) update("model", m);
                }}
              />
            </div>
          );
        })}

        {modelInput && modelInput !== settings.model && !models.includes(modelInput) && (
          <div className="cs-list-row">
            <span className="cs-list-label custom">{modelInput} (custom)</span>
            <button
              type="button"
              className="cs-btn primary"
              onClick={() => update("model", modelInput.trim())}
            >
              Use
            </button>
          </div>
        )}
        {savedKey === "model" && <div className="cs-card-footer"><SavedFlag /></div>}
      </Card>

      <button
        type="button"
        className={"cs-collapse" + (apiKeysOpen ? " open" : "")}
        onClick={() => setApiKeysOpen((v) => !v)}
      >
        <ChevronRightIcon className="cs-chev" />
        API Keys
      </button>
      {apiKeysOpen && (
        <Card>
          <Row
            label="Ollama Cloud"
            description="Stored in VS Code SecretStorage. Required only for ollama.com."
            saved={savedKey === "apiKey"}
            control={
              settings.hasApiKey ? (
                <button
                  type="button"
                  className="cs-btn danger"
                  onClick={() => update("apiKey", "")}
                >
                  Clear key
                </button>
              ) : (
                <span className="cs-muted">Not set</span>
              )
            }
          />
          <div className="cs-key-input-row">
            <div className="cs-input-wrap">
              <input
                type={reveal ? "text" : "password"}
                className="cs-input"
                placeholder="ollama_…"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
              <button
                type="button"
                className="cs-input-affix"
                onClick={() => setReveal((v) => !v)}
                title={reveal ? "Hide" : "Reveal"}
              >
                {reveal ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <button
              type="button"
              className="cs-btn primary"
              disabled={!keyInput.trim()}
              onClick={() => {
                update("apiKey", keyInput.trim());
                setKeyInput("");
              }}
            >
              {settings.hasApiKey ? "Replace" : "Save"}
            </button>
          </div>
          <a
            href="https://ollama.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="cs-link"
          >
            Get a key on ollama.com <ExternalLinkIcon />
          </a>
        </Card>
      )}
    </>
  );
}

function RefreshSvg() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8a5 5 0 0 1 8.5-3.5L13 6" />
      <path d="M13 3v3h-3" />
      <path d="M13 8a5 5 0 0 1-8.5 3.5L3 10" />
      <path d="M3 13v-3h3" />
    </svg>
  );
}

/* ─── Tools & MCP ─── */

const BUILT_IN_TOOLS: Array<{ name: string; desc: string }> = [
  { name: "Read", desc: "Read files in your workspace" },
  { name: "Grep", desc: "Regex search across files" },
  { name: "Glob", desc: "File pattern matching" },
  { name: "Edit", desc: "Modify files" },
  { name: "Write", desc: "Create new files" },
  { name: "Bash", desc: "Run shell commands" },
  { name: "WebFetch", desc: "Fetch URLs" },
  { name: "WebSearch", desc: "Search the web" },
  { name: "NotebookEdit", desc: "Edit Jupyter cells" },
  { name: "Todo", desc: "Track multi-step tasks" },
  { name: "PlanMode", desc: "Read-only planning" },
  { name: "Worktree", desc: "Isolated git copies" },
];

function ToolsPane() {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return BUILT_IN_TOOLS;
    return BUILT_IN_TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q),
    );
  }, [search]);
  return (
    <>
      <PaneHeader title="Tools & MCP" subtitle="Per-tool toggles are coming soon. All built-in tools are currently enabled." />
      <Card>
        <div className="cs-card-toolbar">
          <div className="cs-search inline">
            <SearchIcon className="cs-search-icon" />
            <input
              type="text"
              placeholder="Search tools"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {filtered.map((t) => (
          <div key={t.name} className="cs-list-row">
            <span className="cs-list-label">
              {t.name}
              <span className="cs-list-desc"> — {t.desc}</span>
            </span>
            <Toggle checked={true} onChange={() => undefined} />
          </div>
        ))}
      </Card>

      <Card title="MCP Servers" description="Add external tools via the Model Context Protocol.">
        <div className="cs-empty">
          No MCP servers configured. Configuration UI coming soon.
        </div>
      </Card>
    </>
  );
}

/* ─── Rules ─── */

function RulesPane({
  settings,
  savedKey,
}: {
  settings: SettingsSnapshot;
  savedKey: SettingsKey | null;
}) {
  const [text, setText] = useState(settings.customInstructions);
  useEffect(() => setText(settings.customInstructions), [settings.customInstructions]);
  const dirty = text !== settings.customInstructions;
  return (
    <>
      <PaneHeader title="Rules" subtitle="Custom instructions appended to every chat's system prompt." />
      <Card>
        <textarea
          className="cs-textarea"
          rows={12}
          placeholder={"e.g.\n- Prefer TypeScript strict mode\n- Use Bun, not npm\n- Keep responses terse"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="cs-card-footer end">
          {savedKey === "customInstructions" && <SavedFlag />}
          <button
            type="button"
            className="cs-btn"
            disabled={!dirty}
            onClick={() => setText(settings.customInstructions)}
          >
            Reset
          </button>
          <button
            type="button"
            className="cs-btn primary"
            disabled={!dirty}
            onClick={() => update("customInstructions", text)}
          >
            Save
          </button>
        </div>
      </Card>
    </>
  );
}

/* ─── Slash commands ─── */

const SLASH_COMMANDS: Array<{ cmd: string; desc: string }> = [
  { cmd: "/new", desc: "Start a new chat" },
  { cmd: "/clear", desc: "Clear conversation" },
  { cmd: "/model", desc: "Pick a model" },
  { cmd: "/sessions", desc: "List past sessions" },
  { cmd: "/resume", desc: "Resume a session by id" },
  { cmd: "/plan", desc: "Toggle plan mode" },
  { cmd: "/compact", desc: "Compact conversation now" },
  { cmd: "/help", desc: "Show available commands" },
];

function SlashPane() {
  return (
    <>
      <PaneHeader title="Slash commands" subtitle="Type these in the chat composer." />
      <Card>
        {SLASH_COMMANDS.map((s) => (
          <div key={s.cmd} className="cs-list-row">
            <span className="cs-list-label mono">{s.cmd}</span>
            <span className="cs-list-desc">{s.desc}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

/* ─── Network ─── */

function NetworkPane({
  settings,
  savedKey,
}: {
  settings: SettingsSnapshot;
  savedKey: SettingsKey | null;
}) {
  const [host, setHost] = useState(settings.ollamaHost);
  useEffect(() => setHost(settings.ollamaHost), [settings.ollamaHost]);
  return (
    <>
      <PaneHeader title="Network" />
      <Card>
        <Row
          label="Ollama host"
          description="Auto-flips to ollama.com when an API key is set."
          saved={savedKey === "ollamaHost"}
          control={
            <div className="cs-row-input">
              <input
                type="text"
                className="cs-input"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="http://localhost:11434"
              />
              <button
                type="button"
                className="cs-btn primary"
                disabled={!host || host === settings.ollamaHost}
                onClick={() => update("ollamaHost", host.trim())}
              >
                Save
              </button>
            </div>
          }
        />
      </Card>
    </>
  );
}

/* ─── Beta ─── */

function BetaPane() {
  return (
    <>
      <PaneHeader title="Beta" subtitle="Experimental flags. May change or break without notice." />
      <Card>
        <div className="cs-empty">No beta features available right now.</div>
      </Card>
    </>
  );
}

/* ─── About ─── */

function AboutPane({ settings }: { settings: SettingsSnapshot }) {
  return (
    <>
      <PaneHeader title="About" />
      <Card>
        <div className="cs-about">
          <div className="cs-about-row">
            <span className="k">Version</span>
            <span className="v">{settings.version}</span>
          </div>
          <div className="cs-about-row">
            <span className="k">Provider</span>
            <span className="v">{settings.provider}</span>
          </div>
          <div className="cs-about-row">
            <span className="k">Host</span>
            <span className="v">{settings.ollamaHost}</span>
          </div>
          <div className="cs-about-row">
            <span className="k">Model</span>
            <span className="v">{settings.model || "—"}</span>
          </div>
        </div>
      </Card>

      <Card title="Resources">
        <div className="cs-links">
          <a className="cs-link" href="https://ollama.com" target="_blank" rel="noreferrer">
            ollama.com <ExternalLinkIcon />
          </a>
          <a
            className="cs-link"
            href="https://github.com/anthropics/claude-code/issues"
            target="_blank"
            rel="noreferrer"
          >
            Report an issue <ExternalLinkIcon />
          </a>
        </div>
      </Card>
    </>
  );
}
