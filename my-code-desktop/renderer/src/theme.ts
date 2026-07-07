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
