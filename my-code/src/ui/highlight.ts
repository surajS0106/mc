import path from "node:path";

// cli-highlight has transitive CJS deps (supports-color/has-flag) that Bun
// can't always resolve on Windows. Lazy-load it with a try/catch so failure
// degrades to plain text instead of crashing the CLI.
type HighlightFn = (
  code: string,
  opts: { language?: string; ignoreIllegals?: boolean }
) => string;
let cachedHighlight: HighlightFn | null | undefined;
function loadHighlight(): HighlightFn | null {
  if (cachedHighlight !== undefined) return cachedHighlight;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("cli-highlight") as { highlight?: HighlightFn };
    cachedHighlight = mod.highlight ?? null;
  } catch {
    cachedHighlight = null;
  }
  return cachedHighlight;
}

const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".html": "html",
  ".css": "css",
  ".scss": "scss",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".sql": "sql",
  ".java": "java",
  ".kt": "kotlin",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".swift": "swift",
  ".php": "php",
  ".lua": "lua",
  ".dart": "dart",
};

export function languageForPath(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_TO_LANG[ext];
}

export function highlightCode(code: string, filePathOrLang?: string): string {
  const hl = loadHighlight();
  if (!hl) return code;
  try {
    let language: string | undefined;
    if (filePathOrLang) {
      language =
        EXT_TO_LANG[path.extname(filePathOrLang).toLowerCase()] ?? filePathOrLang;
    }
    return hl(code, { language, ignoreIllegals: true });
  } catch {
    return code;
  }
}
