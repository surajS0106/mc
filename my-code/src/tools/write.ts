import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { buildTool } from "./Tool.js";

const schema = z.object({
  file_path: z.string().describe("Absolute path to the file"),
  content: z.string().describe("Full content to write"),
});

export const writeTool = buildTool({
  name: "Write",
  description:
    "Write content to a file, creating parent directories if needed. Overwrites existing files. Use Edit for modifying existing files.",
  inputSchema: schema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => true,
  getPath: (input) => input.file_path,
  getActivityDescription: (input) => `Writing ${path.basename(input.file_path)}`,
  renderToolUse: (input) =>
    `Write ${input.file_path} (${Buffer.byteLength(input.content, "utf8")} bytes)`,
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

    // Staleness check: if we Read this file, but it changed on disk since,
    // refuse the overwrite so we don't silently clobber someone else's edit.
    if (ctx.fileStateCache.has(abs) && (await ctx.fileStateCache.isStale(abs))) {
      throw new Error(
        `File ${abs} changed on disk since last read. Re-read before writing.`
      );
    }

    await fs.mkdir(path.dirname(abs), { recursive: true });

    // Record file history for undo support (Phase 4.7)
    try {
      const { FileHistory } = await import("../utils/fileHistory.js");
      const history: InstanceType<typeof FileHistory> = (globalThis as any).__renoFileHistory;
      if (history) await history.record(abs, input.content, "Write", 0);
    } catch {}

    await fs.writeFile(abs, input.content, "utf8");
    await ctx.fileStateCache.markWritten(abs, input.content);
    return `Wrote ${Buffer.byteLength(input.content, "utf8")} bytes to ${abs}`;
  },
});
