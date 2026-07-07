import type { ToolSchema } from "../agent/types.js";
import type { Tool, Tools } from "./Tool.js";
import { zodToJsonSchema } from "../utils/zodToJsonSchema.js";

export type { Tool, Tools } from "./Tool.js";

function normalizeToolName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    const direct = this.tools.get(name);
    if (direct) return direct;
    // LLMs frequently mis-style tool names — capital letters
    // ("Outlook_list_mail"), CamelCase ("OutlookListMail"), hyphens
    // ("outlook-list-mail"), etc. Normalize aggressively (lowercase +
    // strip non-alphanumeric) so we resolve all of those to the same
    // canonical entry instead of forcing an error-and-retry roundtrip.
    const target = normalizeToolName(name);
    for (const [k, v] of this.tools) {
      if (normalizeToolName(k) === target) return v;
    }
    return undefined;
  }

  has(name: string): boolean {
    return !!this.get(name);
  }

  list(): Tools {
    return [...this.tools.values()];
  }

  /** Serialize all enabled tools into the function-calling schema (OpenAI/Ollama shape). */
  toolSchema(): ToolSchema[] {
    return this.list()
      .filter((t) => t.isEnabled())
      .map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.jsonSchemaOverride ?? zodToJsonSchema(t.inputSchema),
        },
      }));
  }

  /** @deprecated Use `toolSchema()` — same shape, neutral name. */
  ollamaSchema(): ToolSchema[] {
    return this.toolSchema();
  }
}
