---
name: verify
description: Verify current changes work correctly end-to-end
args: []
---

Please verify that the current changes are working correctly.

Do all of the following:

1. **Find what changed** — Run `git diff` or `git diff --cached` to see the current modifications.
2. **Run tests** — If tests exist for the changed files, run them now. Show the output.
3. **Build check** — If there's a build step (`tsc --noEmit`, `npm run build`, etc.), run it and check for errors.
4. **Manual trace** — For each changed function/module, trace through the logic to confirm correctness. Check for edge cases.
5. **Report** — Clearly state: what you tested, what passed, what failed (if anything), and whether the changes are ready.

If you cannot run verification (no tests, no build), say so explicitly — do not claim success without evidence.
