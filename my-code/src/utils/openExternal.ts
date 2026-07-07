import { spawn } from "node:child_process";

/** Open a URL in the user's default browser, cross-platform. Best-effort. */
export function openExternal(url: string): void {
  try {
    if (process.platform === "win32") {
      // `start` is a cmd builtin; first quoted arg is the window title.
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // best-effort — ignore failures
  }
}
