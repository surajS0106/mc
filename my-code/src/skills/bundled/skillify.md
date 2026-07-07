---
name: skillify
description: Turn a task description into a reusable skill .md file
args: [task]
---

Please turn the following task into a reusable skill file:

{{task}}

Create a new `.md` file in `.my-code/skills/` with this exact format:

```
---
name: <short-lowercase-name>
description: <one-line description of what it does>
args: [<arg1>, <arg2>]
---

<well-crafted prompt template>

Use {{arg1}} and {{arg2}} as placeholders where the user's input should go.
```

Guidelines for a good skill:
- Name should be a single word or hyphenated phrase (e.g. `fix-types`, `add-tests`)
- Description should finish the sentence "This skill will..."
- Prompt should be specific enough to get consistent results but general enough to reuse
- Include step-by-step instructions in the prompt where helpful
- List args only if the skill genuinely needs variable input

After creating the file, show me the full contents and confirm where it was saved.
