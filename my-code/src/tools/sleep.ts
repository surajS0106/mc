import { z } from "zod";
import { buildTool } from "./Tool.js";

const schema = z.object({
  ms: z
    .number()
    .int()
    .min(0)
    .max(60_000)
    .describe("Milliseconds to sleep (max 60_000)"),
});

export const sleepTool = buildTool({
  name: "Sleep",
  description: "Pause for the given number of milliseconds. Useful in scripted demos and rate-limited polling.",
  inputSchema: schema,
  isReadOnly: () => true,
  isConcurrencySafe: () => false,
  getActivityDescription: (input) => `Sleeping ${input.ms}ms`,
  renderToolUse: (input) => `Sleep ${input.ms}ms`,
  async call(input, ctx) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, input.ms);
      ctx.abortController.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Error("aborted"));
        },
        { once: true }
      );
    });
    return `slept ${input.ms}ms`;
  },
});
