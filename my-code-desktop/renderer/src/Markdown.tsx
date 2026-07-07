/**
 * Tiny markdown renderer for assistant bubbles.
 *
 * Models emit `**bold**`, `- bullets`, `# headers`, `` `code` ``, and
 * fenced code blocks even when the persona says "plain text". Without
 * this, Sunday's replies show literal asterisks (see screenshot).
 *
 * Intentionally not a CommonMark parser — covers the subset the model
 * actually emits.
 */

import React from "react";

export interface MarkdownProps {
  content: string;
}

export function Markdown({ content }: MarkdownProps): React.ReactElement {
  const lines = content.split("\n");
  const blocks: React.ReactElement[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block ```…```
    if (line.trim().startsWith("```")) {
      const end = lines.findIndex(
        (l, k) => k > i && l.trim().startsWith("```")
      );
      const stop = end === -1 ? lines.length : end;
      const code = lines.slice(i + 1, stop).join("\n");
      blocks.push(
        <pre key={key++} className="md-code-block">
          {code}
        </pre>
      );
      i = stop + 1;
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={key++} className="md-h">
          {renderInline(line.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={key++} className="md-h">
          {renderInline(line.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={key++} className="md-h">
          {renderInline(line.slice(2))}
        </h2>
      );
      i++;
      continue;
    }

    // Bullet list item: collapse consecutive bullets into one <ul>.
    const bulletMatch = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        const m = /^(\s*)[-*]\s+(.*)$/.exec(cur);
        if (!m) break;
        items.push(
          <li key={items.length} className="md-li">
            {renderInline(m[2])}
          </li>
        );
        i++;
      }
      blocks.push(
        <ul key={key++} className="md-ul">
          {items}
        </ul>
      );
      continue;
    }

    // Blank line → paragraph break
    if (line.trim() === "") {
      blocks.push(<div key={key++} className="md-spacer" />);
      i++;
      continue;
    }

    // Plain paragraph line
    blocks.push(
      <p key={key++} className="md-p">
        {renderInline(line)}
      </p>
    );
    i++;
  }
  return <div className="md">{blocks}</div>;
}

/**
 * Tokenize one line on **bold**, *italic*, _italic_, and `code`. Order
 * matters — bold first so single-* italic doesn't swallow `**bold**`.
 */
function renderInline(line: string): React.ReactNode[] {
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  const out: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > lastIdx) {
      out.push(<span key={key++}>{line.slice(lastIdx, m.index)}</span>);
    }
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(
        <strong key={key++} className="md-strong">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("`")) {
      out.push(
        <code key={key++} className="md-code">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("*") || tok.startsWith("_")) {
      out.push(
        <em key={key++} className="md-em">
          {tok.slice(1, -1)}
        </em>
      );
    }
    lastIdx = re.lastIndex;
  }
  if (lastIdx < line.length) {
    out.push(<span key={key++}>{line.slice(lastIdx)}</span>);
  }
  return out;
}
