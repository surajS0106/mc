import { z } from "zod";
import { buildTool } from "./Tool.js";

const schema = z.object({
  url: z.string().url().describe("Absolute http(s) URL to fetch"),
  format: z
    .enum(["text", "html", "raw"])
    .optional()
    .describe("text (default): strip tags + collapse whitespace; html: keep tags; raw: bytes as utf-8"),
  max_chars: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Truncate the response body to this many characters (default 50_000)"),
});

const DEFAULT_MAX = 50_000;
const TIMEOUT_MS = 20_000;

function htmlToText(html: string): string {
  // Strip script/style blocks first to avoid leaking JS/CSS into the result.
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ");
  // Block-level elements get newlines so paragraphs survive.
  s = s.replace(/<\/?(p|br|div|h[1-6]|li|tr|article|section|hr)[^>]*>/gi, "\n");
  // Strip remaining tags.
  s = s.replace(/<[^>]+>/g, " ");
  // Decode the most common entities.
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Collapse whitespace.
  s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

export const webFetchTool = buildTool({
  name: "WebFetch",
  description:
    "Fetch a web page over http(s) and return its content. Default format is plain text (HTML stripped). Useful for documentation lookups.",
  inputSchema: schema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  getActivityDescription: (input) => `Fetching ${input.url}`,
  renderToolUse: (input) => `WebFetch ${input.url}`,
  async call(input) {
    const max = input.max_chars ?? DEFAULT_MAX;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(input.url, {
        method: "GET",
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "my-code/0.3 (+https://github.com/)",
          Accept: "text/html, text/plain, application/json, */*",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} from ${input.url}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    let out: string;
    if (input.format === "raw" || input.format === "html") {
      out = body;
    } else if (contentType.includes("application/json")) {
      try {
        out = JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        out = body;
      }
    } else if (contentType.includes("text/html") || /<html[\s>]/i.test(body)) {
      out = htmlToText(body);
    } else {
      out = body;
    }
    if (out.length > max) {
      out = out.slice(0, max) + `\n…[truncated at ${max} chars; full length ${body.length}]`;
    }
    return `${input.url}  (${contentType || "?"})  ${out.length} chars\n\n${out}`;
  },
});
