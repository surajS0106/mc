import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { buildTool } from "./Tool.js";

const schema = z.object({
  file_path: z.string().describe("Absolute path to a .ipynb file"),
  cell_id: z
    .string()
    .optional()
    .describe("Existing cell id to target. Omit when mode=insert to append at end."),
  mode: z
    .enum(["replace", "insert", "delete"])
    .describe("replace: rewrite cell.source; insert: add a new cell; delete: remove cell"),
  cell_type: z
    .enum(["code", "markdown", "raw"])
    .optional()
    .describe("Cell type (only for insert; default: code)"),
  source: z
    .string()
    .optional()
    .describe("New source for the cell (required for replace/insert)"),
});

interface NotebookCell {
  cell_type: "code" | "markdown" | "raw";
  source: string[] | string;
  metadata?: Record<string, unknown>;
  outputs?: unknown[];
  execution_count?: number | null;
  id?: string;
}

interface Notebook {
  cells: NotebookCell[];
  metadata?: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toSourceArray(s: string): string[] {
  // Jupyter convention: keep the trailing newline on every line except the last.
  const lines = s.split("\n");
  return lines.map((l, i) => (i === lines.length - 1 ? l : l + "\n"));
}

export const notebookEditTool = buildTool({
  name: "NotebookEdit",
  description:
    "Edit cells in a Jupyter (.ipynb) notebook. Supports replace, insert, and delete on a specific cell id (or end-of-notebook for insert with no id).",
  inputSchema: schema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: (input) => input.mode === "delete",
  getPath: (input) => input.file_path,
  getActivityDescription: (input) => `${input.mode} cell in ${path.basename(input.file_path)}`,
  renderToolUse: (input) =>
    `NotebookEdit ${input.mode} ${input.cell_id ?? "(end)"} in ${input.file_path}`,
  async validateInput(input) {
    if (input.mode !== "delete" && input.source === undefined) {
      return { ok: false, message: `mode=${input.mode} requires source` };
    }
    if (input.mode !== "insert" && !input.cell_id) {
      return { ok: false, message: `mode=${input.mode} requires cell_id` };
    }
    return { ok: true };
  },
  async call(input, ctx) {
    const abs = path.isAbsolute(input.file_path)
      ? input.file_path
      : path.resolve(ctx.cwd, input.file_path);
    const raw = await fs.readFile(abs, "utf8");
    let nb: Notebook;
    try {
      nb = JSON.parse(raw) as Notebook;
    } catch (e) {
      throw new Error(`Could not parse notebook JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!Array.isArray(nb.cells)) throw new Error("Notebook has no cells array");

    const findIdx = () =>
      input.cell_id ? nb.cells.findIndex((c) => c.id === input.cell_id) : -1;

    if (input.mode === "delete") {
      const idx = findIdx();
      if (idx === -1) throw new Error(`cell_id ${input.cell_id} not found`);
      nb.cells.splice(idx, 1);
    } else if (input.mode === "replace") {
      const idx = findIdx();
      if (idx === -1) throw new Error(`cell_id ${input.cell_id} not found`);
      nb.cells[idx].source = toSourceArray(input.source!);
      if (nb.cells[idx].cell_type === "code") {
        nb.cells[idx].outputs = [];
        nb.cells[idx].execution_count = null;
      }
    } else {
      // insert
      const newCell: NotebookCell = {
        cell_type: input.cell_type ?? "code",
        source: toSourceArray(input.source!),
        metadata: {},
        id: genId(),
      };
      if (newCell.cell_type === "code") {
        newCell.outputs = [];
        newCell.execution_count = null;
      }
      const idx = input.cell_id ? findIdx() + 1 : nb.cells.length;
      if (input.cell_id && idx === 0) throw new Error(`cell_id ${input.cell_id} not found`);
      nb.cells.splice(idx, 0, newCell);
    }

    await fs.writeFile(abs, JSON.stringify(nb, null, 1) + "\n", "utf8");
    return `${input.mode} OK — notebook now has ${nb.cells.length} cells`;
  },
});
