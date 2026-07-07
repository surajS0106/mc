---
name: test
description: Generate tests for a file or function
args: [target]
---

Analyze {{target}} and generate comprehensive tests:

1. Read the source code
2. Identify all public functions/methods/exports
3. For each, write tests covering:
   - Happy path
   - Edge cases (empty input, null, boundary values)
   - Error cases
4. Use the project's existing test framework (detect from package.json)
5. Place tests in the conventional location for this project

Write the test file and verify it passes.
