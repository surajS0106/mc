---
name: simplify
description: Simplify complex code while preserving its exact behaviour
args: [file]
---

Please simplify {{file}} while preserving its exact observable behaviour.

First, read the file and explain what it currently does in 2–3 sentences.

Then apply these rules:
- Do NOT change what the code does — only how it does it
- Remove unnecessary abstraction and indirection (helpers used once, wrapper functions, re-exported types)
- Prefer direct, flat code over deep nesting
- Remove dead code, unused imports, unused variables
- Remove redundant comments that just describe what the code already says
- Keep the result readable and idiomatic for the language

Make the minimal changes needed. Do not refactor the whole file — target complexity hotspots only.

After simplifying, summarise: what you removed and why, and confirm the behaviour is unchanged.
