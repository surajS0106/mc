/**
 * Phase 2 — Auto-Memory Permission Guard (Beta parity)
 *
 * Exact port of Beta's `extractMemories.ts → createAutoMemCanUseTool()`.
 *
 * When the background memory agent (extractMemories or autoDream) runs as a
 * forked sub-engine, it must NOT be allowed to read/write arbitrary files in
 * the user's codebase. This function creates a "policy island" — a restricted
 * permission function that:
 *
 *   ✅ ALLOW: read, grep, glob — unrestricted (inherently read-only)
 *   ✅ ALLOW: bash — ONLY if tool.isReadOnly() confirms the command is safe
 *             (ls, find, cat, stat, wc, head, tail — never redirects, writes)
 *   ✅ ALLOW: write/edit — ONLY when the target file_path is inside memoryDir
 *   ❌ DENY:  everything else
 *
 * This is called "Policy Island" in Beta's codebase comments.
 */

import type { Tool, ToolUseContext } from "../../tools/Tool.js";

export type CanUseToolResult =
  | { behavior: "allow"; updatedInput: Record<string, unknown> }
  | { behavior: "deny"; message: string };

export type CanUseToolFn = (
  tool: Tool,
  input: Record<string, unknown>
) => Promise<CanUseToolResult>;

// Tool names — must match what my-code's tool registry uses
const READ_TOOLS = new Set(["read", "grep", "glob"]);
const WRITE_TOOLS = new Set(["write", "edit"]);
const BASH_TOOL = "bash";

function denyAutoMemTool(tool: Tool, reason: string): CanUseToolResult {
  return {
    behavior: "deny",
    message: `[autoMem] denied ${tool.name}: ${reason}`,
  };
}

/**
 * Creates the restricted canUseTool function for memory background agents.
 * Shared by extractMemories and autoDream.
 *
 * @param memoryDir  Absolute path to the memory directory (e.g. ~/.my-code/projects/<hash>/memory)
 */
export function createAutoMemCanUseTool(memoryDir: string): CanUseToolFn {
  return async (tool: Tool, input: Record<string, unknown>): Promise<CanUseToolResult> => {
    // Allow read/grep/glob — inherently read-only, no restriction
    if (READ_TOOLS.has(tool.name)) {
      return { behavior: "allow", updatedInput: input };
    }

    // Allow bash ONLY when the tool's own isReadOnly() check passes.
    // This gates commands like cat, ls, find, stat, wc, head, tail.
    // Anything with redirects (>, >>, |tee) or writes gets denied.
    if (tool.name === BASH_TOOL) {
      const isReadOnly = tool.isReadOnly(input as never);
      if (isReadOnly) {
        return { behavior: "allow", updatedInput: input };
      }
      return denyAutoMemTool(
        tool,
        "Only read-only shell commands are permitted (ls, find, grep, cat, stat, wc, head, tail). Commands that write or redirect output will be denied."
      );
    }

    // Allow write/edit ONLY when the target file_path is strictly inside memoryDir.
    // This prevents the memory agent from writing anywhere in the codebase.
    if (WRITE_TOOLS.has(tool.name) && "file_path" in input) {
      const filePath = input.file_path;
      if (typeof filePath === "string") {
        // Normalize slashes for Windows compatibility (Beta runs on macOS/Linux)
        const norm = (p: string) => p.replace(/\\/g, "/");
        if (norm(filePath).startsWith(norm(memoryDir))) {
          return { behavior: "allow", updatedInput: input };
        }
      }
    }

    // Deny everything else
    return denyAutoMemTool(
      tool,
      `only read/grep/glob, read-only bash, and write/edit within ${memoryDir} are allowed`
    );
  };
}
