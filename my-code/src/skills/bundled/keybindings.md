---
name: keybindings
description: Find all keyboard shortcuts and keybindings defined in this project
args: []
---

Please find all keyboard shortcuts and keybindings defined in this project.

Look in these locations:
- `package.json` → `contributes.keybindings` (VS Code extension format)
- `.vscode/keybindings.json`
- Any file named `keybindings.*`, `shortcuts.*`, `hotkeys.*`
- Source files that call `registerKeybinding`, `addHotkey`, `Keyboard.on(`, `keydown`, or similar

For each keybinding found, extract:
- The key combination (e.g. `Ctrl+Shift+P`)
- What it does
- Where it is defined (file + line)

Present the results as a clean table:

| Shortcut | Action | Defined in |
|---|---|---|
| ... | ... | ... |

If no keybindings are found, say so clearly.
