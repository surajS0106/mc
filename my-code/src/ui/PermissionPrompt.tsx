import React, { useEffect, useState } from "react";
import fs from "node:fs/promises";
import { Box, Text, useInput } from "ink";
import type { PermissionChoice } from "./types-perms.js";
import { theme } from "./theme.js";
import { ARROW_RIGHT } from "./figures.js";
import { StructuredDiff } from "./StructuredDiff.js";

interface Props {
  toolName: string;
  args: Record<string, unknown>;
  suggestedRules: { session: string; project: string };
  onDecide: (d: PermissionChoice) => void;
  /**
   * When true, only "Allow once" and "Don't allow" are shown — no session /
   * project caching. Used for irreversible sends (mail, chat) where a
   * stale "yes for session" could silently dispatch a later wrong-target
   * send.
   */
  alwaysPrompt?: boolean;
}

interface Option {
  choice: PermissionChoice;
  label: string;
  detail?: string;
  hint: string;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// Edit preview: read the target file and render a real line-numbered diff of
// the proposed change. Falls back to a bare old/new listing if the file can't
// be read or the old_string isn't found in it.
function EditPreview({ args }: { args: Record<string, unknown> }) {
  const file = String(args.file_path ?? "");
  const oldStr = String(args.old_string ?? "");
  const newStr = String(args.new_string ?? "");
  const [before, setBefore] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fs.readFile(file, "utf8")
      .then((c) => !cancelled && setBefore(c))
      .catch(() => !cancelled && setBefore(""));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const header = (
    <Text>
      <Text color={theme.toolEdit}>edit </Text>
      <Text bold color={theme.text}>{file}</Text>
    </Text>
  );

  if (before && oldStr && before.includes(oldStr)) {
    const after = before.replace(oldStr, newStr);
    return (
      <Box flexDirection="column">
        {header}
        <StructuredDiff filePath={file} before={before} after={after} context={2} compact />
      </Box>
    );
  }

  const oldLines = oldStr.split("\n").slice(0, 3);
  const newLines = newStr.split("\n").slice(0, 3);
  return (
    <Box flexDirection="column">
      {header}
      {oldLines.map((l, i) => (
        <Text key={"o" + i} color={theme.danger} dimColor>{"  - "}{truncate(l, 100)}</Text>
      ))}
      {newLines.map((l, i) => (
        <Text key={"n" + i} color={theme.success} dimColor>{"  + "}{truncate(l, 100)}</Text>
      ))}
    </Box>
  );
}

function Preview({ toolName, args }: { toolName: string; args: Record<string, unknown> }) {
  if (toolName === "Bash") {
    const cmd = String(args.command ?? "");
    const cwd = String(args.cwd ?? process.cwd());
    return (
      <Box flexDirection="column">
        <Text>
          <Text color={theme.toolShell}>$ </Text>
          <Text bold color={theme.text}>{cmd}</Text>
        </Text>
        <Text color={theme.muted} dimColor>{"  in "}{cwd}</Text>
      </Box>
    );
  }

  if (toolName === "Write") {
    const file = String(args.file_path ?? "");
    const content = String(args.content ?? "");
    const lines = content.split("\n");
    const bytes = Buffer.byteLength(content, "utf8");
    return (
      <Box flexDirection="column">
        <Text>
          <Text color={theme.toolEdit}>write </Text>
          <Text bold color={theme.text}>{file}</Text>
          <Text color={theme.muted} dimColor>{"  "}{lines.length} lines · {bytes}B</Text>
        </Text>
        {lines.slice(0, 4).map((l, i) => (
          <Text key={i} color={theme.success} dimColor>{"  + "}{truncate(l, 100)}</Text>
        ))}
        {lines.length > 4 && (
          <Text color={theme.muted} dimColor>{"    … +"}{lines.length - 4} more lines</Text>
        )}
      </Box>
    );
  }

  if (toolName === "Edit") {
    return <EditPreview args={args} />;
  }

  // Generic
  const lines = JSON.stringify(args, null, 2).split("\n").slice(0, 6);
  return (
    <Box flexDirection="column">
      {lines.map((l, i) => (
        <Text key={i} color={theme.muted} dimColor>{"  "}{truncate(l, 100)}</Text>
      ))}
    </Box>
  );
}

export function PermissionPrompt({ toolName, args, suggestedRules, onDecide, alwaysPrompt }: Props) {
  const options: Option[] = alwaysPrompt
    ? [
        { choice: "once", label: "Allow this send", hint: "y" },
        { choice: "no", label: "Don't send", hint: "n / esc" },
      ]
    : [
        { choice: "once", label: "Allow once", hint: "y" },
        {
          choice: "session",
          label: "Allow for this session",
          detail: suggestedRules.session,
          hint: "a",
        },
        {
          choice: "project",
          label: "Allow always for this project",
          detail: suggestedRules.project,
          hint: "p",
        },
        { choice: "no", label: "Don't allow", hint: "n / esc" },
      ];

  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    const k = input.toLowerCase();
    if (key.upArrow) return setSelected((i) => Math.max(0, i - 1));
    if (key.downArrow) return setSelected((i) => Math.min(options.length - 1, i + 1));
    if (key.return) return onDecide(options[selected].choice);
    if (key.escape || k === "n") return onDecide("no");
    if (k === "y" || k === "1") return onDecide("once");
    if (!alwaysPrompt && (k === "a" || k === "2")) return onDecide("session");
    if (!alwaysPrompt && (k === "p" || k === "3")) return onDecide("project");
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.warning}
      paddingX={2}
      paddingY={0}
      marginY={1}
    >
      {/* Header */}
      <Box marginBottom={1} flexDirection="column">
        <Text color={theme.warning} bold>
          {alwaysPrompt ? "⚠ Confirm send" : "⚠ Permission Required"}
        </Text>
        {alwaysPrompt && (
          <Text color={theme.muted} dimColor>
            Sends always require fresh confirmation — caching is disabled.
          </Text>
        )}
      </Box>

      {/* What does it want to do */}
      <Box marginBottom={1} flexDirection="column">
        <Text>
          <Text bold color={theme.text}>{toolName}</Text>
          <Text color={theme.muted}>{alwaysPrompt ? " wants to send" : " wants to run"}</Text>
        </Text>
        <Box marginTop={0}>
          <Preview toolName={toolName} args={args} />
        </Box>
      </Box>

      {/* Options — arrow-keyed */}
      <Box flexDirection="column">
        {options.map((opt, i) => {
          const isSelected = i === selected;
          const labelColor = isSelected
            ? opt.choice === "no"
              ? theme.danger
              : theme.accent
            : theme.text;
          return (
            <Box key={opt.choice}>
              <Box width={2}>
                <Text color={isSelected ? theme.accent : theme.muted}>
                  {isSelected ? ARROW_RIGHT : " "}
                </Text>
              </Box>
              <Text color={labelColor} bold={isSelected}>{opt.label}</Text>
              {opt.detail && (
                <Text color={theme.muted} dimColor>{"  ("}{opt.detail}{")"}</Text>
              )}
              <Text color={theme.muted} dimColor>{"  "}{opt.hint}</Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>↑↓ navigate · enter select · esc to deny</Text>
      </Box>
    </Box>
  );
}
