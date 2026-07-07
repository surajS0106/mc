---
name: loop
description: Repeat an action with slight variation across many targets
args: [action, targets]
---

Please perform the following action on each of the specified targets:

**Action:** {{action}}
**Targets:** {{targets}}

Work through each target one at a time:
1. Apply the action to the target
2. Verify it completed correctly
3. Note any variation or special case
4. Move to the next target

Do not skip targets silently — if a target cannot be processed, say why.

After all targets are done, provide a brief summary:
- How many targets were processed successfully
- Any that were skipped or failed (and why)
- Any patterns or surprises noticed across targets
