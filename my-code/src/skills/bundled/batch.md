---
name: batch
description: Run the same task across many files or items in parallel
args: [task, files]
---

Please run the following task across all the specified targets:

**Task:** {{task}}
**Targets:** {{files}}

Process each target independently. Where possible, work on multiple targets in parallel to save time.

For each target:
1. Apply the task
2. Verify the result is correct
3. Note any issues or special cases

After all targets are done, provide a summary table:
| Target | Status | Notes |
|---|---|---|
| ... | Done / Skipped / Failed | ... |

Flag anything that failed or was skipped and why.
