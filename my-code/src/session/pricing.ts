import fs from "node:fs/promises";
import path from "node:path";
import { myCodeDir } from "../config/globalConfig.js";

interface ModelPrice {
  inPer1M: number;
  outPer1M: number;
}

/**
 * Pricing table keys: either `"<provider>/<model>"` (preferred for new
 * providers) or just `"<model>"` (legacy — Ollama-only). costFor() tries both.
 */
export type PricingTable = Record<string, ModelPrice>;

const BUILTIN_PRICING: PricingTable = {
  // Ollama Cloud (legacy unprefixed keys)
  "qwen3-coder:480b-cloud":     { inPer1M: 3.00, outPer1M: 9.00 },
  "gpt-oss:120b-cloud":         { inPer1M: 1.50, outPer1M: 4.50 },
  "deepseek-v3.1:671b-cloud":   { inPer1M: 2.00, outPer1M: 6.00 },
  "qwen3:235b-cloud":           { inPer1M: 2.50, outPer1M: 7.50 },
  "llama4:scout-cloud":         { inPer1M: 0.80, outPer1M: 2.40 },
  "llama4:maverick-cloud":      { inPer1M: 1.20, outPer1M: 3.60 },
  // Common local Ollama models — free
  "qwen2.5-coder:7b":           { inPer1M: 0, outPer1M: 0 },
  "qwen2.5-coder:14b":          { inPer1M: 0, outPer1M: 0 },
  "qwen2.5-coder:32b":          { inPer1M: 0, outPer1M: 0 },
  "llama3.1:8b":                { inPer1M: 0, outPer1M: 0 },
  "llama3.1:70b":               { inPer1M: 0, outPer1M: 0 },
  "mistral-nemo":               { inPer1M: 0, outPer1M: 0 },
  "codestral:latest":           { inPer1M: 0, outPer1M: 0 },
  // Future provider entries will use "openai/gpt-4o", "gemini/gemini-2.5-pro", etc.
};

export async function loadPricing(): Promise<PricingTable> {
  const userFile = path.join(myCodeDir(), "pricing.json");
  let userPricing: PricingTable = {};
  try {
    userPricing = JSON.parse(await fs.readFile(userFile, "utf8")) as PricingTable;
  } catch {
    // No user file — use built-in only
  }
  return { ...BUILTIN_PRICING, ...userPricing };
}

/**
 * Look up `provider/model` first, then bare `model` (legacy).
 * Falls back to a prefix match on the bare model id.
 */
export function costFor(
  providerOrModel: string,
  modelOrPrompt: string | number,
  promptOrCompletion: number,
  completionOrTable: number | PricingTable,
  table?: PricingTable
): number | null {
  // Backward-compat: old signature was (model, prompt, completion, table).
  let provider: string | undefined;
  let model: string;
  let prompt: number;
  let completion: number;
  let pricing: PricingTable;

  if (typeof modelOrPrompt === "number") {
    // Legacy 4-arg form.
    model = providerOrModel;
    prompt = modelOrPrompt;
    completion = promptOrCompletion;
    pricing = completionOrTable as PricingTable;
  } else {
    // New 5-arg form: (provider, model, prompt, completion, table).
    provider = providerOrModel;
    model = modelOrPrompt;
    prompt = promptOrCompletion;
    completion = completionOrTable as number;
    pricing = table as PricingTable;
  }

  const key1 = provider ? `${provider}/${model}` : null;
  const key2 = model;
  const entry =
    (key1 && pricing[key1]) ??
    pricing[key2] ??
    pricing[
      Object.keys(pricing).find((k) => model.startsWith(k.split(":")[0])) ?? ""
    ] ??
    null;

  if (!entry) return null;
  const inCost = (prompt / 1_000_000) * entry.inPer1M;
  const outCost = (completion / 1_000_000) * entry.outPer1M;
  return inCost + outCost;
}

export function formatCost(n: number): string {
  if (n === 0) return "free";
  if (n < 0.001) return "<$0.001";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
