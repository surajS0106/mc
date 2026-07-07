export type TranscriptItem =
  | { kind: "user"; content: string; id: string }
  | { kind: "assistant"; content: string; id: string }
  | {
      kind: "reasoning";
      id: string;
      content: string;
      durationMs: number;
      expanded?: boolean;
    }
  | {
      kind: "tool";
      id: string;
      name: string;
      args: Record<string, unknown>;
      result?: string;
      isError?: boolean;
      expanded?: boolean;
      /** Authoritative structured diff from the tool (real file line numbers). */
      diff?: ToolDiff;
      /** Nesting depth — 0 = top-level, 1 = subagent child. */
      depth?: number;
      /** For depth>0: the parent (Agent) tool's id, for tree grouping. */
      parentId?: string;
      /** Completed child tool calls of a subagent, rendered as a ├ │ └ tree. */
      children?: ToolChild[];
    }
  | { kind: "system"; content: string; id: string; tone?: "info" | "warn" | "error" };

/** Structured diff carried from a tool (e.g. Edit) so the UI shows real line numbers. */
export interface ToolDiff {
  filePath: string;
  before: string;
  after: string;
  /** 1-based file line where `before`/`after` begin. */
  startLine: number;
}

/** A completed child tool call of a subagent (Agent tool). */
export interface ToolChild {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface SessionStats {
  promptTokens: number;
  completionTokens: number;
}
