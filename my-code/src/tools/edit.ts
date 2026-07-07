import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { buildTool } from "./Tool.js";

const schema = z.object({
  file_path: z.string().describe("Absolute path to the file"),
  old_string: z.string().describe("Exact text to replace"),
  new_string: z.string().describe("Replacement text"),
  replace_all: z.boolean().optional().describe("Replace all occurrences (default false)"),
});

// Bridge the 1-based file line where the edit begins from call() (which has the
// pre-edit content) to renderToolResult() (which only receives input + output).
// Keyed by the exact input object reference the engine passes to both.
const startLineByInput = new WeakMap<object, number>();

export const editTool = buildTool({
  name: "Edit",
  description:
    "Replace an exact string in a file. old_string must appear exactly once unless replace_all is true. Read the file first so old_string matches exactly including whitespace.",
  inputSchema: schema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => true,
  getPath: (input) => input.file_path,
  getActivityDescription: (input) => `Editing ${path.basename(input.file_path)}`,
  renderToolUse: (input) => `Edit ${input.file_path}`,
  async validateInput(input) {
    if (input.old_string === input.new_string) {
      return { ok: false, message: "old_string and new_string are identical" };
    }
    return { ok: true };
  },
  async call(input, ctx) {
    const abs = path.isAbsolute(input.file_path)
      ? input.file_path
      : path.resolve(ctx.cwd, input.file_path);

    // Must have been Read (or at least touched) first, or the LLM is editing blind.
    // We allow edits on untracked files (a valid workflow is: user mentions a path,
    // agent edits directly). But if it WAS tracked and changed, bail.
    if (ctx.fileStateCache.has(abs) && (await ctx.fileStateCache.isStale(abs))) {
      throw new Error(
        `File ${abs} changed on disk since last read. Re-read before editing.`
      );
    }

    const content = await fs.readFile(abs, "utf8");
    if (!content.includes(input.old_string)) {
      throw new Error(
        `old_string not found in ${abs}. Read the file and copy the exact text including whitespace.`
      );
    }
    // Real file line where the (first) match begins — for the diff gutter.
    const startLine = content.slice(0, content.indexOf(input.old_string)).split("\n").length;
    startLineByInput.set(input, startLine);
    const occurrences = content.split(input.old_string).length - 1;
    const replaceAll = input.replace_all ?? false;
    if (!replaceAll && occurrences > 1) {
      throw new Error(
        `old_string appears ${occurrences} times in ${abs}. Provide a larger unique snippet or set replace_all=true.`
      );
    }
    const next = replaceAll
      ? content.split(input.old_string).join(input.new_string)
      : content.replace(input.old_string, input.new_string);

    // Record file history for undo support (Phase 4.7)
    try {
      const { FileHistory } = await import("../utils/fileHistory.js");
      const history: InstanceType<typeof FileHistory> = (globalThis as any).__renoFileHistory;
      if (history) await history.record(abs, next, "Edit", 0);
    } catch {}

    await fs.writeFile(abs, next, "utf8");
    await ctx.fileStateCache.markWritten(abs, next);
    return `Edited ${abs} (${occurrences} replacement${occurrences === 1 ? "" : "s"})`;
  },
  renderToolResult(input) {
    // Surface a structured diff (with the real start line) so the UI can render
    // a side-by-side diff with authoritative file line numbers.
    return {
      kind: "diff",
      filePath: input.file_path,
      before: input.old_string,
      after: input.new_string,
      startLine: startLineByInput.get(input) ?? 1,
    };
  },
});
