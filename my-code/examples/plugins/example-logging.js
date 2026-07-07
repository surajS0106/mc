/**
 * Example plugin: Logging
 *
 * This plugin demonstrates the PluginAPI by:
 *   1. Registering a PreToolUse hook that logs all tool invocations
 *   2. Adding a prompt section with project-specific instructions
 *   3. Registering a custom slash command
 *
 * To use: copy this file to ~/.ig/plugins/ or <project>/.ig/plugins/
 */

export function register(api) {
  // 1. Hook: log all tool calls
  api.registerHook("PreToolUse", (args) => {
    api.log(`tool: ${args.toolName}(${Object.keys(args.input).join(", ")})`);
    // Return nothing to allow the tool to proceed
  });

  // 2. Prompt section: add project conventions
  api.addPromptSection({
    title: "Project Conventions (via plugin)",
    content: [
      "- Use TypeScript strict mode",
      "- Prefer async/await over callbacks",
      "- All public functions must have JSDoc comments",
      "- Use named exports, not default exports",
    ].join("\n"),
  });

  // 3. Custom command: /greet
  api.registerCommand({
    name: "greet",
    description: "Example plugin command",
    execute(args, ctx) {
      ctx.push(`👋 Hello from the example plugin! Args: ${args.join(" ") || "(none)"}`);
    },
  });

  api.log("example-logging plugin loaded");
}
