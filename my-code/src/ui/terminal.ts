// Terminal capability detection — used to degrade glyphs and colors gracefully
// so the UI never garbles on a *genuinely* legacy Windows console. Modern
// Windows 10/11 conhost (cmd.exe) handles unicode + truecolor fine, so we only
// fall back on truly old consoles or when explicitly forced.
//
// Overrides:
//   MY_CODE_ASCII=1          → force ASCII glyphs (preview the legacy look)
//   MY_CODE_FORCE_UNICODE=1  → force unicode on a console we'd treat as legacy
//   NO_COLOR=1               → disable truecolor (honours the no-color convention)

import os from "node:os";

function isModernTerminal(): boolean {
  if (process.env.WT_SESSION || process.env.WT_PROFILE_ID) return true; // Windows Terminal
  if (process.env.ConEmuANSI === "ON") return true;
  if (process.env.TERM_PROGRAM) return true; // VS Code, iTerm, Hyper, Apple Terminal…
  return false;
}

// Legacy = old Windows conhost predating reliable VT + UTF-8 (before Win10 1703 /
// build 15063, which brought stable 24-bit color and proper UTF-8 to cmd.exe).
function isLegacyWindowsConsole(): boolean {
  if (process.platform !== "win32") return false;
  if (isModernTerminal()) return false;
  const build = Number(os.release().split(".")[2] ?? "0");
  return !(build >= 15063);
}

const isDumb = process.env.TERM === "dumb";

export const supportsUnicode: boolean = (() => {
  if (process.env.MY_CODE_ASCII === "1") return false;
  if (process.env.MY_CODE_FORCE_UNICODE === "1") return true;
  if (isDumb) return false;
  return !isLegacyWindowsConsole();
})();

export const supportsTrueColor: boolean = (() => {
  if (process.env.NO_COLOR) return false;
  if (isDumb) return false;
  const ct = process.env.COLORTERM;
  if (ct === "truecolor" || ct === "24bit") return true;
  return !isLegacyWindowsConsole();
})();
