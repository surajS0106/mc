---
name: debug
description: Systematic debugging — reproduce, isolate, root-cause, fix, verify
args: [error]
---

Help me debug this issue using a strict systematic approach:

{{error}}

Follow this exact process — do NOT skip steps:

1. **Reproduce** — Confirm you can trigger the issue reliably. Read the error message carefully. Identify the file and line number if shown.
2. **Isolate** — Narrow down to the exact function/line causing it. Read the relevant source code.
3. **Root cause** — Explain WHY it happens (not just what). Trace the data flow.
4. **Fix** — Make the minimal change that resolves the root cause. Do not fix symptoms.
5. **Verify** — Run tests or re-trace the logic to confirm the fix works and didn't break anything else.

Do NOT make guesses. Do NOT try random fixes. Read the actual code, trace the actual call stack, inspect the actual data.
