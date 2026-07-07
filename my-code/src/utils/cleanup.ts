/**
 * Graceful shutdown registry — ensures cleanup handlers fire on exit.
 * Modeled after beta's utils/gracefulShutdown.ts + utils/cleanupRegistry.ts.
 */

type CleanupFn = () => void | Promise<void>;

const cleanupHandlers: CleanupFn[] = [];
let isShuttingDown = false;
let setupDone = false;

/**
 * Register a cleanup function that runs on process exit.
 * Handlers run in LIFO order (last registered = first to run).
 */
export function registerCleanup(fn: CleanupFn): () => void {
  cleanupHandlers.push(fn);
  return () => {
    const idx = cleanupHandlers.indexOf(fn);
    if (idx !== -1) cleanupHandlers.splice(idx, 1);
  };
}

/**
 * Run all cleanup handlers. Safe to call multiple times — only the first
 * invocation actually runs handlers.
 */
export async function runCleanup(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  // Run in reverse order (LIFO)
  const handlers = [...cleanupHandlers].reverse();
  for (const fn of handlers) {
    try {
      await fn();
    } catch {
      // Swallow errors during cleanup — we're shutting down anyway.
    }
  }
}

/**
 * Synchronous cleanup for process.exit paths where we can't await.
 */
export function runCleanupSync(): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  const handlers = [...cleanupHandlers].reverse();
  for (const fn of handlers) {
    try {
      const result = fn();
      // If it returns a promise, we can't await it in a sync context.
      // Best effort: the handler should have a sync fallback.
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch(() => {});
      }
    } catch {
      // Swallow
    }
  }
}

/**
 * Set up process-level signal handlers. Call once at startup.
 */
export function setupGracefulShutdown(): void {
  if (setupDone) return;
  setupDone = true;

  // SIGINT (Ctrl+C) — allow one interrupt to trigger cleanup, second to force-kill.
  let interrupted = false;
  process.on("SIGINT", () => {
    if (interrupted) {
      process.exit(130);
    }
    interrupted = true;
    runCleanup().then(() => process.exit(130)).catch(() => process.exit(130));
  });

  // SIGTERM
  process.on("SIGTERM", () => {
    runCleanup().then(() => process.exit(0)).catch(() => process.exit(1));
  });

  // Uncaught exceptions — log and exit
  process.on("uncaughtException", (error) => {
    process.stderr.write(`\nFatal: ${error.message}\n`);
    if (error.stack) process.stderr.write(error.stack + "\n");
    runCleanupSync();
    process.exit(1);
  });

  // Unhandled rejections
  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    process.stderr.write(`\nUnhandled rejection: ${msg}\n`);
    // Don't exit — just log. Many libraries fire unhandled rejections non-fatally.
  });

  // Normal exit
  process.on("exit", () => {
    runCleanupSync();
  });
}
