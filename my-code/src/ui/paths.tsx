import React from "react";
import { Text } from "ink";

// Matches:
// - absolute paths: /foo/bar/baz.ext
// - relative paths with slash: ./foo, src/foo.ts, ../lib/x
// Minimum: contains a slash and looks path-ish.
const PATH_REGEX = /((?:\.{0,2}\/)?(?:[\w.\-]+\/)+[\w.\-]+(?:\.[A-Za-z0-9]+)?)/g;

export function PathifiedText({ children }: { children: string }) {
  if (!children) return null;
  const parts: Array<{ text: string; isPath: boolean }> = [];
  let last = 0;
  for (const m of children.matchAll(PATH_REGEX)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ text: children.slice(last, idx), isPath: false });
    parts.push({ text: m[0], isPath: true });
    last = idx + m[0].length;
  }
  if (last < children.length) parts.push({ text: children.slice(last), isPath: false });

  return (
    <>
      {parts.map((p, i) =>
        p.isPath ? (
          <Text key={i} color="blue">{p.text}</Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        )
      )}
    </>
  );
}
