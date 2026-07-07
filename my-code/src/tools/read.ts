import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { buildTool } from "./Tool.js";

const schema = z.object({
  file_path: z.string().describe("Absolute path to the file to read"),
  offset: z.number().optional().describe("1-indexed line number to start from (default 1)"),
  limit: z.number().optional().describe("Number of lines to read (default 2000)"),
});

export const readTool = buildTool({
  name: "Read",
  description:
    "Read a file from the filesystem. Returns content with line numbers in cat -n style. Use offset/limit for large files.",
  inputSchema: schema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getPath: (input) => input.file_path,
  getActivityDescription: (input) => `Reading ${path.basename(input.file_path)}`,
  renderToolUse: (input) => `Read ${input.file_path}`,
  async call(input, ctx) {
    const abs = path.isAbsolute(input.file_path)
      ? input.file_path
      : path.resolve(ctx.cwd, input.file_path);
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(abs, { withFileTypes: true });
      return entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .sort()
        .join("\n");
    }
    const content = await fs.readFile(abs, "utf8");
    // Track this file for staleness detection by later Edit/Write calls.
    await ctx.fileStateCache.markRead(abs, content);

    const offset = input.offset ?? 1;
    const limit = input.limit ?? 2000;
    const lines = content.split("\n");
    const start = Math.max(0, offset - 1);
    const end = Math.min(lines.length, start + limit);
    const numbered = lines
      .slice(start, end)
      .map((line, i) => `${String(start + i + 1).padStart(6)}\t${line}`)
      .join("\n");
    const suffix =
      end < lines.length
        ? `\n... (${lines.length - end} more lines, pass offset=${end + 1})`
        : "";
    return numbered + suffix;
  },
});
