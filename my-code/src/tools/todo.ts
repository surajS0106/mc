import { z } from "zod";
import { buildTool } from "./Tool.js";

export interface TodoItem {
  content: string;
  activeForm?: string;
  status: "pending" | "in_progress" | "completed";
}

const itemSchema = z.object({
  content: z.string().describe("Imperative form, e.g. 'Run tests'"),
  activeForm: z.string().optional().describe("Present continuous, e.g. 'Running tests'"),
  status: z.enum(["pending", "in_progress", "completed"]),
});

const schema = z.object({
  todos: z.array(itemSchema),
});

const state: { todos: TodoItem[] } = { todos: [] };

export function getTodos(): TodoItem[] {
  return state.todos;
}

export function renderTodos(todos: TodoItem[]): string {
  if (!todos.length) return "(no tasks)";
  return todos
    .map((t) => {
      const mark =
        t.status === "completed" ? "[x]" : t.status === "in_progress" ? "[~]" : "[ ]";
      const label = t.status === "in_progress" && t.activeForm ? t.activeForm : t.content;
      return `${mark} ${label}`;
    })
    .join("\n");
}

export const todoTool = buildTool({
  name: "TodoWrite",
  description:
    "Replace the entire task list. Send the full updated list each time. Keep exactly one item in_progress. Mark items completed immediately after finishing.",
  inputSchema: schema,
  isReadOnly: () => true, // writes in-memory state, not files — safe to parallelize
  isConcurrencySafe: () => false, // but not concurrent with itself
  getActivityDescription: () => "Updating task list",
  renderToolUse: (input) => `TodoWrite (${input.todos.length} items)`,
  async call(input) {
    state.todos = input.todos;
    return renderTodos(input.todos);
  },
});
