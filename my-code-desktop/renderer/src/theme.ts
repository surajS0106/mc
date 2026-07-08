/** Accent theming — applied to CSS custom properties at runtime. */

export const DEFAULT_ACCENT = "#c96442";
export const DEFAULT_ACCENT_HOVER = "#d97757";

export interface AccentPreset {
  name: string;
  accent: string;
  hover: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: "Terracotta", accent: "#c96442", hover: "#d97757" },
  { name: "Cyan / Teal", accent: "#19c2c2", hover: "#2dd4d4" },
  { name: "Violet", accent: "#8b7ff5", hover: "#a196f8" },
  { name: "Emerald", accent: "#3fb950", hover: "#56d364" },
  { name: "Sky", accent: "#4a9eff", hover: "#69b0ff" },
  { name: "Blurple", accent: "#6472f5", hover: "#7f8bf8" },
  { name: "Rose", accent: "#f2618f", hover: "#f57ba3" },
  { name: "Amber", accent: "#f0a53e", hover: "#f4b75f" },
  { name: "Lime", accent: "#a6d84a", hover: "#b8e26a" },
];

/** Write the accent onto :root so every `var(--accent)` updates instantly. */
export function applyAccent(accent?: string, accentHover?: string): void {
  const root = document.documentElement;
  root.style.setProperty("--accent", accent || DEFAULT_ACCENT);
  root.style.setProperty("--accent-hover", accentHover || accent || DEFAULT_ACCENT_HOVER);
}

// ── Appearance: colour mode, chat font, reduced motion ──
// Backed by `data-theme` / `data-font` attributes and a `reduce-motion` class on
// <html>; the CSS in styles.css keys off those. The app shipped dark-only, so an
// absent preference keeps it dark rather than silently following the OS.
export type ThemeMode = "system" | "light" | "dark";
export type ChatFont = "sans" | "serif" | "mono";
export const DEFAULT_MODE: ThemeMode = "dark";
export const DEFAULT_FONT: ChatFont = "sans";

function systemPrefersLight(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  } catch {
    return false;
  }
}

let currentMode: ThemeMode = DEFAULT_MODE;

/** Resolve "system" against the OS and stamp `data-theme` on <html>. */
export function applyMode(mode: ThemeMode = DEFAULT_MODE): void {
  currentMode = mode;
  const light = mode === "light" || (mode === "system" && systemPrefersLight());
  document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
}

export function applyFont(font: ChatFont = DEFAULT_FONT): void {
  document.documentElement.setAttribute("data-font", font);
}

export function applyReduceMotion(on?: boolean): void {
  document.documentElement.classList.toggle("reduce-motion", !!on);
}

/** Apply all appearance prefs at once (used on boot and after settings close). */
export function applyAppearance(t: { mode?: ThemeMode; font?: ChatFont; reduceMotion?: boolean }): void {
  applyMode(t.mode ?? DEFAULT_MODE);
  applyFont(t.font ?? DEFAULT_FONT);
  applyReduceMotion(t.reduceMotion);
}

// Follow the OS live while the user is on "system".
try {
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (currentMode === "system") applyMode("system");
  });
} catch {
  /* older webview — no live system sync */
}
