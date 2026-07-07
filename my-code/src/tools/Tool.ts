import type { z } from "zod";
import type { FileStateCache } from "../utils/fileStateCache.js";
import type { AppState } from "../state/AppState.js";
import type { ChatMessage } from "../agent/types.js";
import type { ToolRegistry } from "./registry.js";

export type AnyToolInput = z.ZodType<Record<string, unknown>>;

export interface ToolUseContext {
  abortController: AbortController;
  fileStateCache: FileStateCache;
  getAppState: () => AppState;
  setAppState: (updater: (prev: AppState) => AppState) => void;
  messages: ChatMessage[];
  toolUseId: string;
  cwd: string;
  spawnSubAgent?: (task: string, allowed_tools?: string[], context?: string, onProgress?: ToolProgressCallback) => Promise<string>;
  /** Creates a scoped sub-engine for background agent spawning. Provided by QueryEngine. */
  createSubEngine?: (abortController: AbortController) => import("../agent/QueryEngine.js").SubEngineHandle;
  /** The full tool registry — used by ToolSearch. Provided by QueryEngine. */
  registry?: ToolRegistry;
}

export type PermissionResult =
  | { behavior: "allow"; reason?: string }
  | { behavior: "deny"; reason: string; locked?: boolean }
  | { behavior: "ask"; reason?: string };

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export interface ToolProgress {
  type: "status" | "output";
  message: string;
}

export type ToolProgressCallback = (progress: ToolProgress) => void;

export interface ToolDef<Input extends AnyToolInput = AnyToolInput, Output = string> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Input;
  /**
   * Optional JSON-Schema override sent to the LLM in place of `zodToJsonSchema(inputSchema)`.
   * Used by MCP-wrapped tools that already have a server-provided schema and don't want
   * the registry to derive one from a permissive zod placeholder.
   */
  readonly jsonSchemaOverride?: unknown;

  /** True when the tool only reads state. Enables parallel execution. */
  isReadOnly?(input: z.infer<Input>): boolean;
  /** True when safe to run concurrently with other concurrency-safe tools. */
  isConcurrencySafe?(input: z.infer<Input>): boolean;
  /** True for irreversible operations (delete, overwrite). */
  isDestructive?(input: z.infer<Input>): boolean;

  /** Custom input validation beyond the zod schema. */
  validateInput?(
    input: z.infer<Input>,
    ctx: ToolUseContext
  ): Promise<ValidationResult>;

  /** Tool-specific permission logic. Defaults to "allow" (defer to engine). */
  checkPermissions?(
    input: z.infer<Input>,
    ctx: ToolUseContext
  ): Promise<PermissionResult>;

  /** Defaults to true. False disables the tool (e.g. feature-flagged). */
  isEnabled?(): boolean;

  /** Returns the file path this tool operates on, if any. Used for staleness checks. */
  getPath?(input: z.infer<Input>): string | undefined;

  /** Present-tense activity line for the spinner. */
  getActivityDescription?(input: z.infer<Input>): string;

  call(
    input: z.infer<Input>,
    ctx: ToolUseContext,
    onProgress?: ToolProgressCallback
  ): Promise<Output>;

  /** Render the tool invocation header (shown before result). */
  renderToolUse?(input: z.infer<Input>): string;

  /** Render the tool's successful result for the transcript. */
  renderToolResult?(
    input: z.infer<Input>,
    output: Output
  ):
    | { kind: "text"; text: string }
    | { kind: "diff"; filePath: string; before: string; after: string; startLine?: number };
}

export interface Tool<Input extends AnyToolInput = AnyToolInput, Output = string>
  extends Required<
    Pick<
      ToolDef<Input, Output>,
      | "name"
      | "description"
      | "inputSchema"
      | "call"
      | "isReadOnly"
      | "isConcurrencySafe"
      | "isDestructive"
      | "isEnabled"
    >
  > {
  // optionals stay optional
  validateInput?: ToolDef<Input, Output>["validateInput"];
  checkPermissions?: ToolDef<Input, Output>["checkPermissions"];
  getPath?: ToolDef<Input, Output>["getPath"];
  getActivityDescription?: ToolDef<Input, Output>["getActivityDescription"];
  renderToolUse?: ToolDef<Input, Output>["renderToolUse"];
  renderToolResult?: ToolDef<Input, Output>["renderToolResult"];
  jsonSchemaOverride?: unknown;
  /** Convenience flag — true when permissions must be checked before calling. */
  requiresPermission: boolean;
}

const DEFAULTS = {
  isReadOnly: (_input: unknown) => false,
  isConcurrencySafe: (_input: unknown) => false,
  isDestructive: (_input: unknown) => false,
  isEnabled: () => true,
};

/**
 * Build a Tool from a partial definition, filling safe fail-closed defaults.
 * A tool "requires permission" when it is not read-only OR is destructive.
 */
export function buildTool<Input extends AnyToolInput, Output = string>(
  def: ToolDef<Input, Output>
): Tool<Input, Output> {
  const isReadOnly = def.isReadOnly ?? DEFAULTS.isReadOnly;
  const isDestructive = def.isDestructive ?? DEFAULTS.isDestructive;
  // Concurrency-safe defaults to isReadOnly when unspecified.
  const isConcurrencySafe =
    def.isConcurrencySafe ?? ((input: z.infer<Input>) => isReadOnly(input as never));

  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    call: def.call,
    validateInput: def.validateInput,
    checkPermissions: def.checkPermissions,
    getPath: def.getPath,
    getActivityDescription: def.getActivityDescription,
    renderToolUse: def.renderToolUse,
    renderToolResult: def.renderToolResult,
    jsonSchemaOverride: def.jsonSchemaOverride,
    isReadOnly: isReadOnly as (input: z.infer<Input>) => boolean,
    isConcurrencySafe: isConcurrencySafe as (input: z.infer<Input>) => boolean,
    isDestructive: isDestructive as (input: z.infer<Input>) => boolean,
    isEnabled: def.isEnabled ?? DEFAULTS.isEnabled,
    // Write/Edit/Bash/Delete all require permission by default.
    // Read-only non-destructive tools do not.
    get requiresPermission() {
      return !isReadOnly({} as never) || isDestructive({} as never);
    },
  };
}

export type Tools = readonly Tool[];
