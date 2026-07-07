---
name: review
description: Review code changes for bugs and issues
args: [file]
---

Review the following file for bugs, security issues, and code quality:
{{file}}

Focus on:
- Logic errors and edge cases
- Missing error handling
- Security vulnerabilities (injection, SSRF, path traversal)
- Performance issues
- Type safety concerns
- Code conventions (consistent naming, proper error messages)

After the review, provide:
1. A severity rating (critical / warning / clean)
2. Specific issues with line numbers
3. Suggested fixes
