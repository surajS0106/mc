const fs = require('fs');
let code = fs.readFileSync('src/agent/context.ts', 'utf8');

// 1. Add imports
code = code.replace(
  "import { getAutoMemPath } from '../memdir/paths.js';",
  "import { getAutoMemPath } from '../memdir/paths.js';\nimport { memoize } from 'lodash-es';\nimport { systemPromptSection, DANGEROUS_uncachedSystemPromptSection, resolveSystemPromptSections, clearSystemPromptSections } from './systemPromptSections.js';\nimport { readSessionMemory } from '../services/sessionMemory/index.js';\n\nexport const SYSTEM_PROMPT_DYNAMIC_BOUNDARY = '====== DYNAMIC BOUNDARY ======';"
);

// 2. Remove old cache variables
code = code.replace(/interface CachedContext \{[\s\S]*?let userCache: CachedContext \| null = null;/m, '');

// 3. Replace getSystemContext
code = code.replace(/export async function getSystemContext[\s\S]*?return \(systemCache = parts\.join\('\\n'\)\);\n\}/m, `export const getSystemContext = memoize(async (cwd: string): Promise<string> => {
  const branch = await getBranch(cwd);
  const isGit = !!branch;
  const statusLines = isGit ? await getChangedFiles(cwd) : [];
  
  const parts: string[] = [
    \`cwd: \${cwd}\`,
    \`platform: \${os.platform()} (\${os.release()})\`,
    \`shell: \${process.env.SHELL ?? (process.platform === "win32" ? "powershell" : "/bin/sh")}\${
      process.platform === "win32"
        ? " (use Unix shell syntax, not Windows \\u2014 e.g., /dev/null not NUL, forward slashes in paths)"
        : ""
    }\`,
    \`git: \${isGit ? \`yes, branch=\${branch}\` : "not a git repo"}\`,
  ];
  if (statusLines.length > 0) {
    const lines = statusLines.slice(0, 30);
    parts.push("git status (changed files, top 30):");
    parts.push(lines.map(l => "  " + l).join("\\n"));
  }
  return parts.join("\\n");
});`);

// 4. Replace getUserContext
code = code.replace(/export async function getUserContext[\s\S]*?return \(userCache = formatMemorySources\(sources\)\);\n\}/m, `export const getUserContext = memoize(async (cwd: string): Promise<string> => {
  const sources = await loadProjectMemory(cwd);
  return formatMemorySources(sources);
});`);

// 5. Replace buildSystemPrompt
code = code.replace(/export async function buildSystemPrompt\([\s\S]*?\n\}[\s\n]*\/\*\* Test seam/m, `export async function buildSystemPromptSections(
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
      return "# Language\\nAlways respond in " + language + ". Use " + language + " for all explanations, comments, and communications with the user. Technical terms and code identifiers should remain in their original form.";
    }),

    // --- Environment (Static parts) ---
    systemPromptSection("env_static", async () => {
      const sysCtx = await getSystemContext(cwd);
      const worktree = isGitWorktree(cwd);
      let envSection = "# Environment\\nYou have been invoked in the following environment:\\n" + sysCtx;
      if (worktree) {
        envSection += "\\n - This is a git worktree \\u2014 an isolated copy of the repository. Run all commands from this directory. Do NOT \\\`cd\\\` to the original repository root.";
      }
      if (additionalWorkingDirectories && additionalWorkingDirectories.length > 0) {
        envSection += "\\n - Additional working directories:";
        for (const dir of additionalWorkingDirectories) {
          envSection += "\\n   - " + dir;
        }
      }
      if (model) {
        envSection += "\\n - You are powered by the model " + model + ".";
        const cutoff = getKnowledgeCutoff(model);
        if (cutoff) {
          envSection += "\\n - Assistant knowledge cutoff is " + cutoff + ".";
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
        return "# Project Instructions\\n\\n" + uCtx;
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
          return "## Memory Index\\n\\n" + manifest;
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
          prompt += "# " + section.title + "\\n\\n" + section.content + "\\n\\n";
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
            .map(c => "## " + c.name + "\\n" + c.instructions)
            .join("\\n\\n");
          return "# MCP Server Instructions\\n\\nThe following MCP servers have provided instructions for how to use their tools and resources:\\n\\n" + blocks;
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
      return "date: " + new Date().toISOString().split("T")[0] + "\\ntime: " + new Date().toLocaleTimeString();
    }, "Time changes every turn"),

    // --- Session Memory (Next Day Resume) ---
    DANGEROUS_uncachedSystemPromptSection("session_memory", async () => {
      const mem = await readSessionMemory(cwd);
      if (!mem) return null;
      return "# Previous Session Memory\\n" + mem;
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
          ].join("\\n");
        }
      }
      return null;
    }, "Token budget changes every turn"),
  ];

  const resolved = await resolveSystemPromptSections(sections);
  return resolved.filter((r): r is string => r !== null && r !== "");
}

/** Test seam`);

// 6. Replace clear caches
code = code.replace(/export function clearContextCaches\(\): void \{[\s\S]*?\}/, `export function clearContextCaches(): void {
  (getSystemContext as any).cache.clear?.();
  (getUserContext as any).cache.clear?.();
  clearSystemPromptSections();
}`);

fs.writeFileSync('src/agent/context.ts', code);
