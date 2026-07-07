import { z } from "zod";
import { buildTool } from "./Tool.js";

const schema = z.object({
  query: z.string().min(1).describe("Search query"),
  max_results: z
    .number()
    .int()
    .positive()
    .max(20)
    .optional()
    .describe("Max results to return (default 10, max 20)"),
});

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

/**
 * DuckDuckGo HTML endpoint — no API key required. Returns a basic results
 * list. If DDG changes their markup we'll need to revisit; the parser is
 * intentionally tolerant.
 */
async function searchDDG(query: string, max: number): Promise<SearchHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15_000);
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; my-code/0.3; +https://github.com/)",
        Accept: "text/html",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`DDG returned HTTP ${res.status}`);
    html = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  const hits: SearchHit[] = [];
  // Crude block parser: each result lives in <div class="result"> ... </div>.
  const blockRe = /<div[^>]*class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/g;
  for (const m of html.match(blockRe) ?? []) {
    const titleMatch = m.match(
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
    );
    const snippetMatch = m.match(
      /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/
    );
    if (!titleMatch) continue;
    const rawHref = titleMatch[1];
    let resolvedUrl = rawHref;
    // DDG wraps real URLs in /l/?uddg=... — unwrap them.
    const uddg = rawHref.match(/[?&]uddg=([^&]+)/);
    if (uddg) {
      try {
        resolvedUrl = decodeURIComponent(uddg[1]);
      } catch {
        // fall through
      }
    }
    const title = stripTags(titleMatch[2]).trim();
    const snippet = snippetMatch ? stripTags(snippetMatch[1]).trim() : "";
    if (title && resolvedUrl.startsWith("http")) {
      hits.push({ title, url: resolvedUrl, snippet });
      if (hits.length >= max) break;
    }
  }
  return hits;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
}

export const webSearchTool = buildTool({
  name: "WebSearch",
  description:
    "Search the web. Returns title / URL / snippet for the top matches. Backed by DuckDuckGo HTML; no API key required.",
  inputSchema: schema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Searching: ${input.query}`,
  renderToolUse: (input) => `WebSearch ${JSON.stringify(input.query)}`,
  async call(input) {
    const max = input.max_results ?? 10;
    const hits = await searchDDG(input.query, max);
    if (hits.length === 0) return `(no results for ${JSON.stringify(input.query)})`;
    return hits
      .map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}${h.snippet ? `\n   ${h.snippet}` : ""}`)
      .join("\n\n");
  },
});
