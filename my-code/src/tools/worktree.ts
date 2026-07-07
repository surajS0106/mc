import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { z } from "zod";
import { buildTool } from "./Tool.js";

const exec = promisify(execFile);

const enterSchema = z.object({
  branch: z.string().describe("Branch name to check out into the new worktree"),
  path: z
    .string()
    .optional()
    .describe("Worktree path (default: ../<repo>-<branch> next to current repo)"),
  create_branch: z
    .boolean()
    .optional()
    .describe("If the branch does not exist, create it (default false)"),
});

const exitSchema = z.object({
  path: z
    .string()
    .optional()
    .describe("Worktree path to remove (default: the active one tracked in app state)"),
  force: z.boolean().optional().describe("Pass --force to git worktree remove"),
});

async function git(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await exec("git", args, { cwd, timeout: 30_000 });
    return stdout.trim();
  } catch (e: unknown) {
    const stderr = (e as { stderr?: string }).stderr ?? "";
    throw new Error(`git ${args.join(" ")} failed: ${stderr || (e instanceof Error ? e.message : String(e))}`);
  }
}

export const enterWorktreeTool = buildTool({
  name: "EnterWorktree",
  description:
    "Create a git worktree for a separate branch and remember its path in app state. Useful for experiments that should not touch the main checkout. Run from inside a git repo.",
  inputSchema: enterSchema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,
  getActivityDescription: (input) => `Creating worktree for ${input.branch}`,
  renderToolUse: (input) => `EnterWorktree ${input.branch}${input.path ? ` at ${input.path}` : ""}`,
  async call(input, ctx) {
    // Sanity: must be inside a git repo.
    await git(["rev-parse", "--show-toplevel"], ctx.cwd);

    const repoRoot = await git(["rev-parse", "--show-toplevel"], ctx.cwd);
    const repoName = path.basename(repoRoot);
    const wtPath = input.path ?? path.resolve(repoRoot, "..", `${repoName}-${input.branch}`);

    const args = ["worktree", "add"];
    if (input.create_branch) args.push("-b", input.branch);
    args.push(wtPath);
    if (!input.create_branch) args.push(input.branch);

    const out = await git(args, ctx.cwd);
    ctx.setAppState((s) => ({ ...s, worktreePath: wtPath }));
    return `worktree at ${wtPath}\n${out}`;
  },
});

export const exitWorktreeTool = buildTool({
  name: "ExitWorktree",
  description:
    "Remove a git worktree. By default removes the worktree tracked in app state (set by EnterWorktree).",
  inputSchema: exitSchema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => true,
  getActivityDescription: (input) => `Removing worktree ${input.path ?? "(active)"}`,
  renderToolUse: (input) => `ExitWorktree ${input.path ?? "(active)"}`,
  async call(input, ctx) {
    const target = input.path ?? ctx.getAppState().worktreePath;
    if (!target) {
      throw new Error("No active worktree tracked in app state; pass `path` explicitly.");
    }
    const args = ["worktree", "remove"];
    if (input.force) args.push("--force");
    args.push(target);
    const out = await git(args, ctx.cwd);
    ctx.setAppState((s) => ({
      ...s,
      worktreePath: s.worktreePath === target ? null : s.worktreePath,
    }));
    return `removed worktree ${target}\n${out}`;
  },
});
