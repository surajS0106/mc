import type { PermissionChoice } from "../../../src/config/permissions.js";
import type { PermissionPromptFn } from "../../../src/agent/events.js";

export interface PendingPermission {
  toolUseId: string;
  name: string;
  args: Record<string, unknown>;
  suggestedRules: { session: string; project: string };
  resolve: (choice: PermissionChoice) => void;
}

/**
 * Bridges QueryEngine.requestPermission ↔ webview ApprovalBar.
 *
 * QueryEngine awaits a Promise; the webview eventually posts a decision.
 * Match-up is by toolUseId — at most one pending per turn (engine serializes).
 */
export class PermissionBridge {
  private pending = new Map<string, PendingPermission>();
  private notify: (req: {
    toolUseId: string;
    name: string;
    args: Record<string, unknown>;
    suggestedRules: { session: string; project: string };
  }) => void;

  constructor(
    notify: PermissionBridge["notify"],
  ) {
    this.notify = notify;
  }

  /** Plug into QueryEngine via setRequestPermission. */
  prompt: PermissionPromptFn = (req) => {
    return new Promise<PermissionChoice>((resolve) => {
      const entry: PendingPermission = {
        toolUseId: req.toolUseId,
        name: req.name,
        args: req.args,
        suggestedRules: req.suggestedRules,
        resolve,
      };
      this.pending.set(req.toolUseId, entry);
      this.notify({
        toolUseId: req.toolUseId,
        name: req.name,
        args: req.args,
        suggestedRules: req.suggestedRules,
      });
      const onAbort = () => {
        const p = this.pending.get(req.toolUseId);
        if (!p) return;
        this.pending.delete(req.toolUseId);
        p.resolve("no");
      };
      req.signal.addEventListener("abort", onAbort, { once: true });
    });
  };

  /** Webview replied. */
  resolve(toolUseId: string, choice: PermissionChoice): void {
    const p = this.pending.get(toolUseId);
    if (!p) return;
    this.pending.delete(toolUseId);
    p.resolve(choice);
  }

  /** Resolve any pending requests as "no" (e.g. on view dispose). */
  cancelAll(): void {
    for (const p of this.pending.values()) p.resolve("no");
    this.pending.clear();
  }
}
