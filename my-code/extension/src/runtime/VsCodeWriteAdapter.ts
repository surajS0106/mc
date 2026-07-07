import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { buildTool, type Tool } from "../../../src/tools/Tool.js";
import type { DiffPreviewRegistry } from "./DiffPreviewRegistry.js";

const editSchema = z.object({
  file_path: z.string(),
  old_string: z.string(),
  new_string: z.string(),
  replace_all: z.boolean().optional(),
});

const writeSchema = z.object({
  file_path: z.string(),
  content: z.string(),
});

export type DiffDecision = "apply" | "reject";

export interface WriteAdapterDeps {
  registry: DiffPreviewRegistry;
  /** Surface a staged diff to the webview. Resolves with the user's decision. */
  requestDecision: (req: {
    toolUseId: string;
    op: "Edit" | "Write";
    filePath: string;
    before: string;
    after: string;
  }) => Promise<DiffDecision>;
  /** True when the diff should be applied without prompting (mode bypass, accept-edits, or a saved rule auto-allows this exact call). */
  shouldAutoApply: (op: "Edit" | "Write", input: Record<string, unknown>) => boolean;
}

/**
 * Tool wrappers that stage Edit/Write through vscode.diff and apply via
 * WorkspaceEdit (so changes go through the editor undo stack).
 */
export function buildVsCodeEditTool(deps: WriteAdapterDeps): Tool {
  return buildTool({
    name: "Edit",
    description:
      "Replace an exact string in a file. old_string must appear exactly once unless replace_all is true. Read the file first so old_string matches exactly including whitespace.",
    inputSchema: editSchema,
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => true,
    getPath: (input) => input.file_path,
    getActivityDescription: (input) =>
      `Editing ${path.basename(input.file_path)}`,
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

      if (ctx.fileStateCache.has(abs) && (await ctx.fileStateCache.isStale(abs))) {
        throw new Error(
          `File ${abs} changed on disk since last read. Re-read before editing.`,
        );
      }

      const before = await fs.readFile(abs, "utf8");
      if (!before.includes(input.old_string)) {
        throw new Error(
          `old_string not found in ${abs}. Read the file and copy the exact text including whitespace.`,
        );
      }
      const occurrences = before.split(input.old_string).length - 1;
      const replaceAll = input.replace_all ?? false;
      if (!replaceAll && occurrences > 1) {
        throw new Error(
          `old_string appears ${occurrences} times in ${abs}. Provide a larger unique snippet or set replace_all=true.`,
        );
      }
      const after = replaceAll
        ? before.split(input.old_string).join(input.new_string)
        : before.replace(input.old_string, input.new_string);

      await applyEdit({
        toolUseId: ctx.toolUseId,
        op: "Edit",
        absPath: abs,
        before,
        after,
        input,
        deps,
      });

      await ctx.fileStateCache.markWritten(abs, after);
      return `Edited ${abs} (${occurrences} replacement${
        occurrences === 1 ? "" : "s"
      })`;
    },
  });
}

export function buildVsCodeWriteTool(deps: WriteAdapterDeps): Tool {
  return buildTool({
    name: "Write",
    description:
      "Write content to a file, creating parent directories if needed. Overwrites existing files. Use Edit for modifying existing files.",
    inputSchema: writeSchema,
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => true,
    getPath: (input) => input.file_path,
    getActivityDescription: (input) =>
      `Writing ${path.basename(input.file_path)}`,
    async validateInput(input) {
      if (!input.file_path.trim()) {
        return { ok: false, message: "file_path must not be empty" };
      }
      return { ok: true };
    },
    async call(input, ctx) {
      const abs = path.isAbsolute(input.file_path)
        ? input.file_path
        : path.resolve(ctx.cwd, input.file_path);

      if (ctx.fileStateCache.has(abs) && (await ctx.fileStateCache.isStale(abs))) {
        throw new Error(
          `File ${abs} changed on disk since last read. Re-read before writing.`,
        );
      }

      let before = "";
      try {
        before = await fs.readFile(abs, "utf8");
      } catch {
        before = "";
      }

      await fs.mkdir(path.dirname(abs), { recursive: true });
      await applyEdit({
        toolUseId: ctx.toolUseId,
        op: "Write",
        absPath: abs,
        before,
        after: input.content,
        input,
        deps,
      });

      await ctx.fileStateCache.markWritten(abs, input.content);
      return `Wrote ${Buffer.byteLength(input.content, "utf8")} bytes to ${abs}`;
    },
  });
}

async function applyEdit(args: {
  toolUseId: string;
  op: "Edit" | "Write";
  absPath: string;
  before: string;
  after: string;
  input: Record<string, unknown>;
  deps: WriteAdapterDeps;
}): Promise<void> {
  const { toolUseId, op, absPath, before, after, input, deps } = args;
  deps.registry.stage(toolUseId, absPath, before, after);

  let decision: DiffDecision = "apply";
  if (!deps.shouldAutoApply(op, input)) {
    decision = await deps.requestDecision({
      toolUseId,
      op,
      filePath: absPath,
      before,
      after,
    });
  }

  if (decision === "reject") {
    deps.registry.clear(toolUseId);
    throw new Error("User rejected the proposed edit.");
  }

  // Apply via WorkspaceEdit for undo stack integration. Fall back to fs.writeFile
  // if the file is outside the workspace and WorkspaceEdit refuses.
  const uri = vscode.Uri.file(absPath);
  let applied = false;
  try {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    if (op === "Write" && !before) {
      // New file path
      await fs.writeFile(absPath, after, "utf8");
      applied = true;
    } else {
      const we = new vscode.WorkspaceEdit();
      const doc = await vscode.workspace.openTextDocument(uri);
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(doc.getText().length),
      );
      we.replace(uri, fullRange, after);
      applied = await vscode.workspace.applyEdit(we);
      if (applied) {
        const updated = await vscode.workspace.openTextDocument(uri);
        await updated.save();
      }
    }
  } catch {
    applied = false;
  }
  if (!applied) {
    await fs.writeFile(absPath, after, "utf8");
  }

  deps.registry.clear(toolUseId);
}
