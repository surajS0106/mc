import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { marked, type Token, type Tokens } from "marked";
import { theme } from "./theme.js";

/**
 * Markdown renderer for Ink.
 *
 * Designed to be cheap enough to call on every streaming chunk (30+ times/sec)
 * by mirroring the perf tricks Claude Code uses:
 *
 *   1. Module-level LRU token cache keyed by content hash. Same content =
 *      same tokens; React unmount/remount doesn't re-parse.
 *   2. Fast-path "is this even markdown?" — single regex against first 500
 *      chars; if no MD syntax, skip marked.lexer entirely (saves ~3ms on
 *      long plain text).
 *   3. useMemo on the render output so identical-content re-renders are
 *      no-ops.
 *
 * Inline syntax (bold/italic/code/link) is rendered through a small custom
 * tokenizer because Ink isn't React-DOM — we can't use marked's HTML output.
 */

type HighlightFn = (code: string, opts: { language: string; ignoreIllegals?: boolean }) => string;
let cachedHighlight: HighlightFn | null | undefined;
function tryLoadHighlight(): HighlightFn | null {
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

interface Props {
  content: string;
  dim?: boolean;
}

// ── Token cache ──────────────────────────────────────────────────────────────

const TOKEN_CACHE_MAX = 500;
const tokenCache = new Map<string, Token[]>();

// FNV-1a 32-bit — fast non-crypto hash, good enough to key content.
function hashContent(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Mix length in to defuse trivial collisions on truncated streams.
  return (h >>> 0).toString(16) + ":" + s.length;
}

// One regex covering all markdown syntax markers we render. Checked against
// the first 500 chars only (markdown almost always shows up early).
const MD_SYNTAX_RE = /[#*`|[>\-_~]|\n\n|^\d+\. |\n\d+\. /;
function hasMarkdownSyntax(s: string): boolean {
  return MD_SYNTAX_RE.test(s.length > 500 ? s.slice(0, 500) : s);
}

function lex(content: string): Token[] {
  // Plain text fast-path — synthesize a single paragraph token, skip the lexer.
  if (!hasMarkdownSyntax(content)) {
    return [
      {
        type: "paragraph",
        raw: content,
        text: content,
        tokens: [{ type: "text", raw: content, text: content } as Tokens.Text],
      } as unknown as Token,
    ];
  }
  const key = hashContent(content);
  const hit = tokenCache.get(key);
  if (hit) {
    // Promote to MRU
    tokenCache.delete(key);
    tokenCache.set(key, hit);
    return hit;
  }
  const tokens = marked.lexer(content);
  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    const oldest = tokenCache.keys().next().value;
    if (oldest !== undefined) tokenCache.delete(oldest);
  }
  tokenCache.set(key, tokens);
  return tokens;
}

// ── Component ────────────────────────────────────────────────────────────────

export function Markdown({ content, dim }: Props): React.ReactElement {
  const tokens = useMemo(() => lex(content), [content]);
  return (
    <Box flexDirection="column">
      {tokens.map((token, i) => (
        <BlockToken key={i} token={token} dim={dim ?? false} />
      ))}
    </Box>
  );
}

function BlockToken({ token, dim }: { token: Token; dim: boolean }): React.ReactElement | null {
  switch (token.type) {
    case "space":
      return null;

    case "heading": {
      const t = token as Tokens.Heading;
      const level = Math.min(3, Math.max(1, t.depth)) as 1 | 2 | 3;
      const color = level === 1 ? theme.accent : level === 2 ? theme.text : theme.suggestion;
      return (
        <Box marginTop={level === 1 ? 1 : 0} marginBottom={0}>
          <Text bold color={color} dimColor={dim}>
            {renderInlineTokens(t.tokens ?? [{ type: "text", raw: t.text, text: t.text } as Tokens.Text])}
          </Text>
        </Box>
      );
    }

    case "paragraph": {
      const t = token as Tokens.Paragraph;
      return (
        <Box>
          <Text dimColor={dim}>
            {renderInlineTokens(t.tokens ?? [{ type: "text", raw: t.text, text: t.text } as Tokens.Text])}
          </Text>
        </Box>
      );
    }

    case "code": {
      const t = token as Tokens.Code;
      let rendered = t.text;
      if (t.lang) {
        const hl = tryLoadHighlight();
        if (hl) {
          try {
            rendered = hl(t.text, { language: t.lang, ignoreIllegals: true });
          } catch {
            // unknown language — fall back to plain
          }
        }
      }
      return (
        <Box flexDirection="column" marginY={0}>
          {t.lang ? (
            <Text color={theme.muted} dimColor>{t.lang}</Text>
          ) : null}
          <Box
            paddingLeft={2}
            borderStyle="single"
            borderColor={theme.divider}
            borderLeft
            borderRight={false}
            borderTop={false}
            borderBottom={false}
          >
            <Text dimColor={dim}>{rendered}</Text>
          </Box>
        </Box>
      );
    }

    case "list": {
      const t = token as Tokens.List;
      const totalDigits = String(t.items.length).length;
      return (
        <Box flexDirection="column">
          {t.items.map((item, i) => (
            <Box key={i}>
              <Text color={theme.muted} dimColor>
                {t.ordered
                  ? `  ${String(i + 1).padStart(totalDigits)}. `
                  : "  • "}
              </Text>
              <Text dimColor={dim}>
                {renderInlineTokens(item.tokens ?? [{ type: "text", raw: item.text, text: item.text } as Tokens.Text])}
              </Text>
            </Box>
          ))}
        </Box>
      );
    }

    case "blockquote": {
      const t = token as Tokens.Blockquote;
      return (
        <Box paddingLeft={2} borderStyle="single" borderColor="gray" borderLeft borderRight={false} borderTop={false} borderBottom={false}>
          <Box flexDirection="column">
            {(t.tokens ?? []).map((sub, i) => (
              <BlockToken key={i} token={sub} dim={true} />
            ))}
          </Box>
        </Box>
      );
    }

    case "hr":
      return (
        <Box>
          <Text color="gray" dimColor>{"─".repeat(40)}</Text>
        </Box>
      );

    case "html":
    case "text": {
      const t = token as Tokens.Text;
      return (
        <Text dimColor={dim}>
          {renderInlineTokens(t.tokens ?? [{ type: "text", raw: t.text ?? "", text: t.text ?? "" } as Tokens.Text])}
        </Text>
      );
    }

    default:
      // Unknown block — render its raw text so nothing is silently dropped.
      return <Text dimColor={dim}>{(token as { raw?: string }).raw ?? ""}</Text>;
  }
}

// marked HTML-escapes entities in token `text` (for HTML output safety). We
// render straight to the terminal, so decode them back to plain characters —
// otherwise the user sees `I&#39;m` and `&quot;`. (&amp; decoded last to avoid
// double-decoding sequences like `&amp;lt;`.)
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// ── Inline rendering ─────────────────────────────────────────────────────────
//
// marked lexes inline tokens for us — we just walk them and emit Ink <Text>.

function renderInlineTokens(tokens: readonly Token[]): React.ReactElement {
  return (
    <>
      {tokens.map((tok, i) => (
        <InlineToken key={i} token={tok} />
      ))}
    </>
  );
}

function InlineToken({ token }: { token: Token }): React.ReactElement {
  switch (token.type) {
    case "strong": {
      const t = token as Tokens.Strong;
      return (
        <Text bold>
          {t.tokens ? renderInlineTokens(t.tokens) : t.text}
        </Text>
      );
    }
    case "em": {
      const t = token as Tokens.Em;
      return (
        <Text italic>
          {t.tokens ? renderInlineTokens(t.tokens) : t.text}
        </Text>
      );
    }
    case "codespan": {
      const t = token as Tokens.Codespan;
      return <Text color={theme.warning}>{decodeEntities(t.text)}</Text>;
    }
    case "link": {
      const t = token as Tokens.Link;
      return (
        <Text underline color={theme.suggestion}>
          {t.tokens ? renderInlineTokens(t.tokens) : t.text}
        </Text>
      );
    }
    case "del": {
      const t = token as Tokens.Del;
      return (
        <Text strikethrough>
          {t.tokens ? renderInlineTokens(t.tokens) : t.text}
        </Text>
      );
    }
    case "br":
      return <Text>{"\n"}</Text>;
    case "escape": {
      const t = token as Tokens.Escape;
      return <Text>{t.text}</Text>;
    }
    case "text":
    default: {
      const t = token as Tokens.Text;
      // Some text tokens have nested inline tokens (e.g. inside list items).
      if (t.tokens) return renderInlineTokens(t.tokens);
      return <Text>{decodeEntities(t.text ?? (token as { raw?: string }).raw ?? "")}</Text>;
    }
  }
}
