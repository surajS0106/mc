import type { ChatProvider } from "./provider.js";
import type { ChatMessage } from "./types.js";
import { readSessionMemory } from "../services/sessionMemory/index.js";

export interface CompactOptions {
  provider?: ChatProvider;
  model?: string;
  cwd: string;
  keepTail?: number; // how many recent messages to preserve verbatim
  focus?: string; // optional user instruction to preserve a thread
  onProgress?: (chunk: string) => void;
}

export interface CompactResult {
  messages: ChatMessage[];
  droppedCount: number;
  summaryTokens?: number;
  summary: string;
}

const SUMMARY_SYSTEM =
  "You are a conversation summarizer for a coding agent. Your output replaces a long tool-using transcript. " +
  "Keep it under 800 tokens. Preserve: files read/edited (full paths), key decisions, command outcomes, outstanding TODOs, user preferences, errors encountered. " +
  "Drop: boilerplate, duplicate tool invocations, verbose tool outputs (just note what was learned). " +
  "Write as compact notes, not prose. Use bullet-like lines.";

export async function compactMessages(
  messages: ChatMessage[],
  opts: CompactOptions
): Promise<CompactResult> {
  const keepTail = opts.keepTail ?? 4;
  if (messages.length === 0) {
    return { messages, droppedCount: 0, summary: "" };
  }
  const [system, ...rest] = messages;
  const tail = rest.slice(-keepTail);
  const older = rest.slice(0, Math.max(0, rest.length - keepTail));

  if (older.length === 0) {
    return { messages, droppedCount: 0, summary: "" };
  }

  // --- Phase 22: Session Memory Compaction ---
  // If the background worker has been maintaining session-memory.md,
  // we can use it to instantly compact the transcript for 0 tokens!
  const sessionMemory = await readSessionMemory(opts.cwd);
  if (sessionMemory) {
    const next: ChatMessage[] = [
      system,
      { role: "user", content: `[Earlier conversation summary]\n${sessionMemory.trim()}` },
      ...tail,
    ];
    return {
      messages: next,
      droppedCount: older.length,
      summaryTokens: 0,
      summary: "Used existing session memory file.",
    };
  }

  if (!opts.provider || !opts.model) {
    throw new Error("Cannot run LLM compaction without provider and model");
  }

  // Serialize older messages as a transcript for the summarizer.
  const transcript = older
    .map((m) => {
      const role = m.role;
      let content = m.content || "";
      if (m.tool_calls && m.tool_calls.length) {
        const calls = m.tool_calls
          .map((c) => `${c.function.name}(${JSON.stringify(c.function.arguments)})`)
          .join(", ");
        content = content ? `${content}\n[tool_calls: ${calls}]` : `[tool_calls: ${calls}]`;
      }
      // Truncate huge tool outputs to keep the summarizer input reasonable
      if (role === "tool" && content.length > 2000) {
        content = content.slice(0, 2000) + "\n…[truncated]";
      }
      return `<<${role}>>\n${content}`;
    })
    .join("\n\n");

  const focusNote = opts.focus
    ? `\n\nSPECIAL INSTRUCTION: Preserve detail on this topic: ${opts.focus}`
    : "";

  const summarizerMessages: ChatMessage[] = [
    { role: "system", content: SUMMARY_SYSTEM + focusNote },
    {
      role: "user",
      content:
        "Summarize this earlier conversation between a user and a coding agent:\n\n" +
        transcript,
    },
  ];

  let summary = "";
  let completion = 0;
  for await (const chunk of opts.provider.streamChat({
    model: opts.model,
    messages: summarizerMessages,
  })) {
    if (chunk.message?.content) {
      summary += chunk.message.content;
      opts.onProgress?.(chunk.message.content);
    }
    if (chunk.done && chunk.eval_count) completion = chunk.eval_count;
  }

  const next: ChatMessage[] = [
    system,
    { role: "user", content: `[Earlier conversation summary]\n${summary.trim()}` },
    ...tail,
  ];

  return {
    messages: next,
    droppedCount: older.length,
    summaryTokens: completion || undefined,
    summary: summary.trim(),
  };
}
