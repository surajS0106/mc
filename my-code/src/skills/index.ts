/**
 * Skill system — custom slash commands defined in markdown files.
 *
 * A skill is a `.md` file in `~/.my-code/skills/` or `<cwd>/.my-code/skills/` that
 * defines a slash command using frontmatter + prompt template.
 *
 * Example skill file (`~/.my-code/skills/review.md`):
 *
 *   ---
 *   name: review
 *   description: Review code changes for issues
 *   args: [file]
 *   ---
 *
 *   Review the following file for bugs, security issues, and code style:
 *   {{file}}
 *
 *   Focus on:
 *   - Logic errors
 *   - Missing error handling
 *   - Security vulnerabilities
 *   - Performance issues
 *
 * Usage: `/review src/app.ts`
 *
 * Modeled after beta's skills/ directory.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { SlashCommandDef, CommandContext } from "../commands/registry.js";

// ─── Skill definition ───────────────────────────────────────────────────────

export interface SkillDef {
  /** Command name (without /). */
  name: string;
  /** Short description for /help. */
  description: string;
  /** Argument names for template interpolation. */
  args: string[];
  /** The prompt template body. */
  template: string;
  /** Source file path. */
  sourcePath: string;
  /** Source: user, project, or bundled. */
  source: "user" | "project" | "bundled";
}

// ─── Frontmatter parsing ────────────────────────────────────────────────────

function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, unknown> = {};
  for (const line of match[1]!.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();

    // Parse arrays: [a, b, c]
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    }
    meta[key] = value;
  }

  return { meta, body: match[2]!.trim() };
}

// ─── Template interpolation ─────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ─── Discovery ──────────────────────────────────────────────────────────────

function userSkillDir(): string {
  return path.join(os.homedir(), ".my-code", "skills");
}

function projectSkillDir(cwd: string): string {
  return path.join(cwd, ".my-code", "skills");
}

async function listSkillFiles(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

async function loadSkillFile(filePath: string, source: "user" | "project" | "bundled"): Promise<SkillDef | null> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const { meta, body } = parseFrontmatter(content);

    const name = (meta.name as string) ?? path.basename(filePath, ".md");
    const description = (meta.description as string) ?? `Custom skill: ${name}`;
    const args = Array.isArray(meta.args) ? (meta.args as string[]) : [];

    return {
      name,
      description,
      args,
      template: body,
      sourcePath: filePath,
      source,
    };
  } catch {
    return null;
  }
}

/**
 * Load all skills from user and project directories.
 */
export async function loadSkills(cwd: string): Promise<SkillDef[]> {
  const userFiles = (await listSkillFiles(userSkillDir())).map((p) => ({
    path: p,
    source: "user" as const,
  }));
  const projectFiles = (await listSkillFiles(projectSkillDir(cwd))).map((p) => ({
    path: p,
    source: "project" as const,
  }));
  const bundledDir = path.join(import.meta.dirname, "bundled");
  const bundledFiles = (await listSkillFiles(bundledDir)).map((p) => ({
    path: p,
    source: "bundled" as const,
  }));

  const skills: SkillDef[] = [];
  for (const file of [...bundledFiles, ...userFiles, ...projectFiles]) {
    const skill = await loadSkillFile(file.path, file.source);
    if (skill) skills.push(skill);
  }
  return skills;
}

/**
 * Convert a SkillDef into a SlashCommandDef for the command registry.
 */
export function skillToCommand(skill: SkillDef): SlashCommandDef {
  return {
    name: skill.name,
    description: `${skill.description} (skill: ${skill.source})`,
    argsHint: skill.args.length > 0
      ? skill.args.map((a) => `<${a}>`).join(" ")
      : undefined,
    async execute(args: string[], ctx: CommandContext) {
      // Map positional args to named vars
      const vars: Record<string, string> = {};
      for (let i = 0; i < skill.args.length; i++) {
        vars[skill.args[i]!] = args[i] ?? "";
      }
      // Any remaining args go into {{rest}}
      vars.rest = args.slice(skill.args.length).join(" ");

      const prompt = interpolate(skill.template, vars);

      if (!prompt.trim()) {
        ctx.push(`usage: /${skill.name} ${skill.args.map((a) => `<${a}>`).join(" ")}`, "warn");
        return;
      }

      await ctx.submitPrompt(prompt);
    },
  };
}

/**
 * Format skills list for display.
 */
export function formatSkillList(skills: SkillDef[]): string {
  if (skills.length === 0) return "(no skills found — add .md files to ~/.my-code/skills/ or .my-code/skills/)";
  return skills
    .map((s) => {
      const args = s.args.length > 0 ? ` ${s.args.map((a) => `<${a}>`).join(" ")}` : "";
      return `  /${s.name}${args.padEnd(25)} ${s.description} (${s.source})`;
    })
    .join("\n");
}
