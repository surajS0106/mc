import { z } from "zod";
import { buildTool, type Tool } from "../../../src/tools/Tool.js";
import { backgroundShells } from "./BackgroundShellRegistry.js";

const outputSchema = z.object({
  bash_id: z
    .string()
    .describe("The bash_id returned from a Bash call with run_in_background=true."),
});

const killSchema = z.object({
  bash_id: z.string(),
});

/**
 * Reads new output from a background bash process since the last call.
 * Cursor advances on each call so successive calls only see new lines.
 */
export const bashOutputTool: Tool = buildTool({
  name: "BashOutput",
  description:
    "Read new stdout/stderr from a background bash process started with run_in_background=true. Returns lines emitted since the previous BashOutput call (or since start, on first call). Also reports current status (running/exited/killed) and exit code if available.",
  inputSchema: outputSchema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Reading ${input.bash_id} output`,
  async call(input) {
    const result = backgroundShells.getNewOutput(input.bash_id);
    if (!result) {
      return `Unknown bash_id: ${input.bash_id}. Use the bash_id returned from a Bash call with run_in_background=true.`;
    }
    const status =
      result.status === "running"
        ? "running"
        : result.status === "exited"
          ? `exited (code=${result.exitCode ?? "?"})`
          : result.status;
    if (result.lines.length === 0) {
      return `[${input.bash_id} status=${status}] (no new output)`;
    }
    return [
      `[${input.bash_id} status=${status}] +${result.lines.length} line(s):`,
      ...result.lines,
    ].join("\n");
  },
});

export const killBashTool: Tool = buildTool({
  name: "KillBash",
  description:
    "Stop a background bash process started with run_in_background=true. Sends SIGTERM, then SIGKILL after 2 seconds.",
  inputSchema: killSchema,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => true,
  getActivityDescription: (input) => `Killing ${input.bash_id}`,
  async call(input) {
    const ok = backgroundShells.kill(input.bash_id);
    if (!ok) return `Unknown bash_id: ${input.bash_id}`;
    return `Killed ${input.bash_id}`;
  },
});
