import { useEffect, useState } from "react";
import { THINKING_VERBS } from "../verbs.js";

export function Spinner({ visible }: { visible: boolean }) {
  const [verb, setVerb] = useState<string>(() => pick());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const verbInt = window.setInterval(() => setVerb(pick()), 5000);
    const dotInt = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => {
      clearInterval(verbInt);
      clearInterval(dotInt);
    };
  }, [visible]);

  if (!visible) return null;
  const dots = ".".repeat((tick % 4) + 1);
  return (
    <span className="spinner">
      <span className="spinner-verb">{verb}</span>
      <span className="spinner-dots">{dots}</span>
    </span>
  );
}

let last = "";
function pick(): string {
  let v = last;
  while (v === last) {
    v = THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)]!;
  }
  last = v;
  return v;
}
