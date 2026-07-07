import { useDeferredValue, useMemo } from "react";
import { Marked } from "marked";
import hljs from "highlight.js/lib/common";

const marked = new Marked({
  gfm: true,
  breaks: true,
  async: false,
  renderer: {
    code({ text, lang }) {
      const language = (lang || "").trim().split(/\s+/)[0] || "";
      let html: string;
      if (language && hljs.getLanguage(language)) {
        try {
          html = hljs.highlight(text, { language, ignoreIllegals: true }).value;
        } catch {
          html = escapeHtml(text);
        }
      } else {
        html = escapeHtml(text);
      }
      const langLabel = language
        ? `<span class="lang">${escapeHtml(language)}</span>`
        : "";
      return `<pre class="codeblock"><div class="codeblock-toolbar">${langLabel}<button class="copy-btn" data-copy="1">Copy</button></div><code class="hljs ${
        language ? `language-${escapeHtml(language)}` : ""
      }">${html}</code></pre>`;
    },
    link({ href, title, tokens }) {
      const safe = (href || "").replace(/"/g, "&quot;");
      const inner = tokens
        .map((t) =>
          // marked passes through inline tokens; we just want the rendered text
          "raw" in t ? escapeHtml((t as { raw: string }).raw) : "",
        )
        .join("");
      return `<a href="${safe}" title="${escapeHtml(title || "")}">${inner}</a>`;
    },
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function MarkdownView({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  // Defer parsing during streaming so React batches re-renders.
  // When the stream ends, the deferred value catches up to the latest text.
  const deferred = useDeferredValue(text);
  const html = useMemo(() => {
    if (!deferred) return "";
    try {
      return marked.parse(deferred) as string;
    } catch {
      return escapeHtml(deferred).replace(/\n/g, "<br/>");
    }
  }, [deferred]);
  return (
    <div
      className={`markdown${streaming ? " streaming" : ""}`}
      onClick={onClickInside}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function onClickInside(e: React.MouseEvent<HTMLDivElement>) {
  const target = e.target as HTMLElement;
  if (target.dataset.copy === "1") {
    const pre = target.closest("pre");
    const code = pre?.querySelector("code");
    if (code?.textContent) {
      navigator.clipboard.writeText(code.textContent).catch(() => {});
      target.textContent = "Copied";
      setTimeout(() => {
        target.textContent = "Copy";
      }, 1200);
    }
  }
}
