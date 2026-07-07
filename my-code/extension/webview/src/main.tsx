import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import css from "./styles.css";

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");
createRoot(rootEl).render(<App />);
