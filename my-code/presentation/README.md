# my-code · Presentation

A small React (Vite) deck for presenting **my-code**. Three full-screen sections:

1. **Intro** — title, tagline, key highlights.
2. **Feature map** — `my-code` at the center with its feature groups radiating out (hover a node to trace its connection).
3. **Comparison** — how my-code, Claude Code and Copilot each tackle the same problems.

A speaking script for a 10-minute client walkthrough is in **`SCRIPT.md`**.

## Run

```bash
cd presentation
npm install
npm run dev
```

Open the printed local URL (default http://localhost:5173).

## Build a static version (for sharing / slides)

```bash
npm run build     # outputs to dist/
npm run preview   # serve the built version locally
```

## Structure

```
presentation/
├─ index.html
├─ vite.config.js
├─ package.json
├─ SCRIPT.md              # 10-min presentation script
└─ src/
   ├─ main.jsx
   ├─ App.jsx              # deck + theme toggle
   ├─ styles.css           # tokens + light/dark theme
   └─ components/
      ├─ Intro.jsx         # section 1
      ├─ FeatureHub.jsx    # section 2 (the hub diagram)
      └─ Compare.jsx       # section 3 (comparison table)
```

## Editing the diagram

Feature nodes live in the `NODES` array in `src/components/FeatureHub.jsx`
(`{ k, ac, t, d }` = icon key, accent color, title, description). The comparison
rows live in the `ROWS` array in `src/components/Compare.jsx`. Add or remove
entries and the layout adjusts automatically.
