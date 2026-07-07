import { spawn } from "node:child_process";
import { z } from "zod";
import { buildTool } from "./Tool.js";

const MAX_OUTPUT = 30_000;
const IS_WINDOWS = process.platform === "win32";

const schema = z.object({
  pattern: z.string().describe("Regex pattern"),
  path: z.string().optional().describe("File or directory to search (default = cwd)"),
  glob: z.string().optional().describe("Glob filter, e.g. '*.ts'"),
  case_insensitive: z.boolean().optional(),
  context: z.number().optional().describe("Lines of context around each match"),
});

function runCmd(
  bin: string,
  args: string[],
  signal: AbortSignal
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);
    let stdout = "";
    let stderr = "";
    const onAbort = () => child.kill();
    signal.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      signal.removeEventListener("abort", onAbort);
      resolve({ code: code ?? 0, stdout, stderr });
    });
    child.on("error", (err) => {
      signal.removeEventListener("abort", onAbort);
      reject(err);
    });
  });
}

function cap(s: string): string {
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + "\n...[truncated]" : s;
}

async function windowsFallback(
  pattern: string,
  target: string,
  globFilter: string | undefined,
  caseI: boolean,
  ctx: number,
  signal: AbortSignal
): Promise<string> {
  const safePattern = pattern.replace(/'/g, "''");
  const safePath = target.replace(/'/g, "''");
  const include = globFilter ? `-Include '${globFilter.replace(/'/g, "''")}'` : "";
  const ciFlag = caseI ? "" : "-CaseSensitive";
  const ctxFlag = ctx > 0 ? `-Context ${ctx},${ctx}` : "";
  const psCmd =
    `Get-ChildItem -Path '${safePath}' -Recurse -File ${include} | ` +
    `Select-String -Pattern '${safePattern}' ${ciFlag} ${ctxFlag} | ` +
    `ForEach-Object { $_.Path + ':' + $_.LineNumber + ':' + $_.Line } | ` +
    `Select-Object -First 500`;

  const res = await runCmd(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", psCmd],
    signal
  );
  const out = res.stdout.trim();
  return out ? cap(out) : "(no matches)";
}

async function unixFallback(
  pattern: string,
  target: string,
  globFilter: string | undefined,
  caseI: boolean,
  signal: AbortSignal
): Promise<string> {
  const grArgs = ["-rn", "--color=never"];
  if (caseI) grArgs.push("-i");
  if (globFilter) grArgs.push("--include", globFilter);
  grArgs.push("-e", pattern, target);
  const res = await runCmd("grep", grArgs, signal);
  const out = res.stdout.trim();
  return out ? cap(out) : "(no matches)";
}

export const grepTool = buildTool({
  name: "Grep",
  description:
    "Search file contents with ripgrep. Returns lines as `path:lineno:match`. Prefer this over `Bash grep`. Falls back to PowerShell Select-String (Windows) or grep (Linux/Mac) if rg is missing.",
  inputSchema: schema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Grepping ${input.pattern}`,
  renderToolUse: (input) => `Grep ${input.pattern}${input.glob ? ` (${input.glob})` : ""}`,
  async call(input, ctx) {
    const target = input.path ?? ".";
    const caseI = input.case_insensitive ?? false;
    const contextLines = input.context ?? 0;

    const rgArgs = ["--color=never", "-n", "--no-heading"];
    if (caseI) rgArgs.push("-i");
    if (contextLines > 0) rgArgs.push("-C", String(contextLines));
    if (input.glob) rgArgs.push("-g", input.glob);
    rgArgs.push("-e", input.pattern, target);

    try {
      const res = await runCmd("rg", rgArgs, ctx.abortController.signal);
      const out = res.stdout.trim();
      if (out) return cap(out);
      return "(no matches)";
    } catch {
      if (IS_WINDOWS) {
        return windowsFallback(
          input.pattern,
          target,
          input.glob,
          caseI,
          contextLines,
          ctx.abortController.signal
        );
      }
      return unixFallback(
        input.pattern,
        target,
        input.glob,
        caseI,
        ctx.abortController.signal
      );
    }
  },
});
