import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { memoize } from "lodash-es";
import { getPluginPromptSections } from "../plugins/index.js";
import { getBranch, getChangedFiles, isAtGitRoot, findGitRoot } from "../utils/git.js";
import { loadMemoryPrompt } from "../memdir/index.js";
import { scanMemoryFiles, formatMemoryManifest } from "../memdir/memoryScan.js";
import { getAutoMemPath } from "../memdir/paths.js";
import { systemPromptSection, DANGEROUS_uncachedSystemPromptSection, resolveSystemPromptSections, clearSystemPromptSections } from "./systemPromptSections.js";
import { readSessionMemory } from "../services/sessionMemory/index.js";

export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY = "====== DYNAMIC BOUNDARY ======";

function safeExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "ignore"], timeout: 2000 })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

function readFileSafe(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8").trim();
    }
  } catch {}
  return null;
}

export interface MemorySource {
  path: string;
  content: string;
  scope: "user" | "project" | "local" | "directory";
}

async function loadProjectMemory(cwd: string): Promise<MemorySource[]> {
  const sources: MemorySource[] = [];

  const gitRoot = await findGitRoot(cwd) || cwd;
  
  const dirs: string[] = [];
  let currentDir = cwd;
  while (currentDir.length >= gitRoot.length && currentDir.startsWith(gitRoot)) {
    dirs.unshift(currentDir);
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  const userPath = path.join(os.homedir(), ".my-code", "my-code.md");
  const userContent = readFileSafe(userPath);
  if (userContent) sources.push({ path: userPath, content: userContent, scope: "user" });

  for (const dir of dirs) {
    const legacyPath = path.join(dir, "my-code.md");
    const legacyContent = readFileSafe(legacyPath);
    if (legacyContent) sources.push({ path: legacyPath, content: legacyContent, scope: "project" });

    const projectPath = path.join(dir, ".my-code", "my-code.md");
    const projectContent = readFileSafe(projectPath);
    if (projectContent) sources.push({ path: projectPath, content: projectContent, scope: "project" });

    const rulesDir = path.join(dir, ".my-code", "rules");
    try {
      if (fs.existsSync(rulesDir)) {
        const files = fs.readdirSync(rulesDir);
        for (const file of files) {
          if (file.endsWith(".md")) {
            const rulePath = path.join(rulesDir, file);
            const ruleContent = readFileSafe(rulePath);
            if (ruleContent) sources.push({ path: rulePath, content: ruleContent, scope: "project" });
          }
        }
      }
    } catch {}
  }

  const localPath = path.join(cwd, ".my-code", "my-code.local.md");
  const localContent = readFileSafe(localPath);
  if (localContent) sources.push({ path: localPath, content: localContent, scope: "local" });

  return sources;
}

function formatMemorySources(sources: MemorySource[]): string {
  if (sources.length === 0) return "";
  return sources
    .map((s) => `--- From ${s.path} ---\n${s.content}`)
    .join("\n\n");
}

function getKnowledgeCutoff(modelId: string): string | null {
  const id = modelId.toLowerCase();
  if (id.includes("gemini-2.5") || id.includes("gemini-2-5")) return "January 2025";
  if (id.includes("gemini-2.0") || id.includes("gemini-2-0")) return "August 2024";
  if (id.includes("gemini-1.5") || id.includes("gemini-1-5")) return "January 2024";
  if (id.includes("claude-opus-4") || id.includes("claude-sonnet-4")) return "March 2025";
  if (id.includes("claude-haiku-4")) return "February 2025";
  if (id.includes("claude-3-7") || id.includes("claude-3.7")) return "October 2024";
  if (id.includes("claude-3-5-sonnet") || id.includes("claude-3.5-sonnet")) return "April 2024";
  if (id.includes("claude-3-5")) return "April 2024";
  if (id.includes("claude-3")) return "August 2023";
  return null;
}

function isGitWorktree(cwd: string): boolean {
  try {
    const gitPath = path.join(cwd, ".git");
    if (fs.existsSync(gitPath)) {
      return fs.statSync(gitPath).isFile();
    }
    const parent = path.dirname(cwd);
    if (parent !== cwd) return isGitWorktree(parent);
  } catch {}
  return false;
}

export const getSystemContext = memoize(async (cwd: string): Promise<string> => {
  const branch = await getBranch(cwd);
  const isGit = !!branch;
  const statusLines = isGit ? await getChangedFiles(cwd) : [];
  
  const parts: string[] = [
    `cwd: ${cwd}`,
    `platform: ${os.platform()} (${os.release()})`,
    `shell: ${process.env.SHELL ?? (process.platform === "win32" ? "powershell" : "/bin/sh")}${
      process.platform === "win32"
        ? " (use PowerShell syntax, not Unix \u2014 e.g., $null not /dev/null, $env:VAR not $VAR, backtick for line continuation)"
        : ""
    }`,
    `git: ${isGit ? `yes, branch=${branch}` : "not a git repo"}`,
  ];
  if (statusLines.length > 0) {
    const lines = statusLines.slice(0, 30);
    parts.push("git status (changed files, top 30):");
    parts.push(lines.map(l => "  " + l).join("\n"));
  }
  return parts.join("\n");
});

export const getUserContext = memoize(async (cwd: string): Promise<string> => {
  const sources = await loadProjectMemory(cwd);
  return formatMemorySources(sources);
});

const STATIC_PROMPT = `You are my-code, a terminal-based AI coding assistant. You help users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges, and educational contexts. Refuse requests for destructive techniques, DoS attacks, mass targeting, supply chain compromise, or detection evasion for malicious purposes. Dual-use security tools (C2 frameworks, credential testing, exploit development) require clear authorization context: pentesting engagements, CTF competitions, security research, or defensive use cases.

# Tone and style
 - Only use emojis if the user explicitly requests it. Avoid using emojis in all communication unless asked.
 - Your responses should be short and concise.
 - When referencing specific functions or pieces of code include the pattern file_path:line_number to allow the user to easily navigate to the source code location.
 - When referencing GitHub issues or pull requests, use the owner/repo#123 format (e.g. owner/repo#100) so they render as clickable links.
 - Do not use a colon before tool calls. Your tool calls may not be shown directly in the output, so text like "Let me read the file:" followed by a read tool call should just be "Let me read the file." with a period.

# Output efficiency
IMPORTANT: Go straight to the point. Try the simplest approach first without going in circles. Do not overdo it. Be extra concise.

Keep your text output brief and direct. Lead with the answer or action, not the reasoning. Skip filler words, preamble, and unnecessary transitions. Do not restate what the user said \u2014 just do it. When explaining, include only what is necessary for the user to understand.

Focus text output on:
 - Decisions that need the user's input
 - High-level status updates at natural milestones
 - Errors or blockers that change the plan

If you can say it in one sentence, don't use three. Prefer short, direct sentences over long explanations. This does not apply to code or tool calls.

When working with tool results, write down any important information you might need later in your response, as the original tool result may be cleared later.`;

export async function buildSystemPromptSections(
  cwd: string,
  model?: string,
  tokenBudget?: { used: number; limit: number },
  mcpClients?: Array<{ name: string; instructions?: string }>,
  language?: string,
  additionalWorkingDirectories?: string[],
): Promise<string[]> {
  const sections = [
    systemPromptSection("core", () => STATIC_PROMPT),

    // --- Language ---
    systemPromptSection("language", () => {
      if (!language) return null;
      return "# Language\nAlways respond in " + language + ". Use " + language + " for all explanations, comments, and communications with the user. Technical terms and code identifiers should remain in their original form.";
    }),

    // --- Environment (Static parts) ---
    systemPromptSection("env_static", async () => {
      const sysCtx = await getSystemContext(cwd);
      const worktree = isGitWorktree(cwd);
      let envSection = "# Environment\nYou have been invoked in the following environment:\n" + sysCtx;
      if (worktree) {
        envSection += "\n - This is a git worktree \u2014 an isolated copy of the repository. Run all commands from this directory. Do NOT \`cd\` to the original repository root.";
      }
      if (additionalWorkingDirectories && additionalWorkingDirectories.length > 0) {
        envSection += "\n - Additional working directories:";
        for (const dir of additionalWorkingDirectories) {
          envSection += "\n   - " + dir;
        }
      }
      if (model) {
        envSection += "\n - You are powered by the model " + model + ".";
        const cutoff = getKnowledgeCutoff(model);
        if (cutoff) {
          envSection += "\n - Assistant knowledge cutoff is " + cutoff + ".";
        }
      }
      return envSection;
    }),

    // --- Auto Memory (Phase 10) ---
    systemPromptSection("auto_memory", () => {
      return loadMemoryPrompt(cwd) || null;
    }),

    // --- User Context (my-code.md files) ---
    systemPromptSection("user_context", async () => {
      const uCtx = await getUserContext(cwd);
      if (uCtx) {
        return "# Project Instructions\n\n" + uCtx;
      }
      return null;
    }),

    // --- Memory File Manifest (Phase 23) ---
    systemPromptSection("memory_manifest", async () => {
      try {
        const memDir = getAutoMemPath(cwd);
        const memHeaders = await scanMemoryFiles(memDir);
        if (memHeaders.length > 0) {
          const manifest = formatMemoryManifest(memHeaders);
          return "## Memory Index\n\n" + manifest;
        }
      } catch {}
      return null;
    }),

    // --- Plugin prompt sections (Phase 4.1) ---
    systemPromptSection("plugins", () => {
      try {
        const pluginSections = getPluginPromptSections();
        if (pluginSections.length === 0) return null;
        let prompt = "";
        for (const section of pluginSections) {
          prompt += "# " + section.title + "\n\n" + section.content + "\n\n";
        }
        return prompt.trim();
      } catch {
        return null;
      }
    }),

    // --- MCP Server Instructions ---
    systemPromptSection("mcp_instructions", () => {
      if (mcpClients && mcpClients.length > 0) {
        const withInstructions = mcpClients.filter(c => c.instructions?.trim());
        if (withInstructions.length > 0) {
          const blocks = withInstructions
            .map(c => "## " + c.name + "\n" + c.instructions)
            .join("\n\n");
          return "# MCP Server Instructions\n\nThe following MCP servers have provided instructions for how to use their tools and resources:\n\n" + blocks;
        }
      }
      return null;
    }),

    // ==========================================
    // DYNAMIC SECTION BOUNDARY (Recomputed per-turn)
    // ==========================================
    systemPromptSection("dynamic_boundary", () => SYSTEM_PROMPT_DYNAMIC_BOUNDARY),

    // --- Dynamic Time/Date ---
    DANGEROUS_uncachedSystemPromptSection("current_time", () => {
      return "date: " + new Date().toISOString().split("T")[0] + "\ntime: " + new Date().toLocaleTimeString();
    }, "Time changes every turn"),

    // --- Session Memory (Next Day Resume) ---
    DANGEROUS_uncachedSystemPromptSection("session_memory", async () => {
      const mem = await readSessionMemory(cwd);
      if (!mem) return null;
      return "# Previous Session Memory\n" + mem;
    }, "Session memory updates constantly in the background"),

    // --- Token Budget (Phase 26) ---
    DANGEROUS_uncachedSystemPromptSection("token_budget", () => {
      if (tokenBudget && tokenBudget.limit > 0) {
        const ratio = tokenBudget.used / tokenBudget.limit;
        const remaining = tokenBudget.limit - tokenBudget.used;
        const pct = Math.round(ratio * 100);
        if (ratio >= 0.7) {
          const urgency = ratio >= 0.9 ? "CRITICAL" : ratio >= 0.8 ? "WARNING" : "NOTICE";
          return [
            "<token_budget>",
            "<used>" + tokenBudget.used + "</used>",
            "<limit>" + tokenBudget.limit + "</limit>",
            "<remaining>" + remaining + "</remaining>",
            "<percentage_used>" + pct + "%</percentage_used>",
            "<urgency>" + urgency + "</urgency>",
            urgency === "CRITICAL"
              ? "You have used " + pct + "% of the context window. STOP expanding the task. Wrap up your current action, write a handoff summary in your final response, and use /compact if you need to continue."
              : urgency === "WARNING"
              ? "You have used " + pct + "% of the context window. Be concise. Avoid large tool outputs. Consider compacting soon."
              : "You have used " + pct + "% of the context window. Be mindful of output length.",
            "</token_budget>",
          ].join("\n");
        }
      }
      return null;
    }, "Token budget changes every turn"),
  ];

  const resolved = await resolveSystemPromptSections(sections, cwd);
  return resolved.filter((r): r is string => r !== null && r !== "");
}

/** Test seam \u2014 clear memoization caches. */
export function clearContextCaches(): void {
  (getSystemContext as any).cache.clear?.();
  (getUserContext as any).cache.clear?.();
  clearSystemPromptSections();
}

/** Exported for testing / debug commands. */
// export type { MemorySource };
