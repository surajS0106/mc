// Rotating "thinking" verbs shown while the agent is busy.
// Real software-build verbs — the shell should read like a compiler console.
export const THINKING_VERBS: string[] = [
  "Compiling", "Transpiling", "Bundling", "Linking", "Resolving",
  "Indexing", "Parsing", "Linting", "Refactoring", "Patching",
  "Scaffolding", "Provisioning", "Initializing", "Hydrating", "Caching",
  "Optimizing", "Minifying", "Tokenizing", "Analyzing", "Tracing",
  "Profiling", "Mapping", "Diffing", "Merging", "Staging",
  "Building", "Assembling", "Wiring", "Injecting", "Bootstrapping",
  "Allocating", "Synthesizing", "Vectorizing", "Sharding", "Encoding",
  "Decoding", "Querying", "Serializing", "Instrumenting", "Marshalling",
  "Rendering", "Spawning", "Piping", "Streaming", "Buffering",
  "Deploying", "Packaging", "Validating", "Normalizing", "Reconciling",
  "Reindexing", "Rebasing", "Pruning", "Hashing", "Mounting",
  "Booting", "Negotiating", "Reticulating",
];

let lastVerb = "";
export function pickVerb(): string {
  let v = lastVerb;
  while (v === lastVerb) {
    v = THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
  }
  lastVerb = v;
  return v;
}

// Context-aware label for a running tool — maps a tool name to the build verb
// that best describes what it's doing, so the tool line reads "Scanning · Read …".
const TOOL_VERBS: Record<string, string> = {
  Read: "Scanning",
  Glob: "Searching",
  Grep: "Searching",
  Edit: "Patching",
  Write: "Patching",
  MultiEdit: "Patching",
  Bash: "Executing",
  WebFetch: "Fetching",
  WebSearch: "Fetching",
  TodoWrite: "Planning",
  Task: "Orchestrating",
};

export function verbForTool(name: string): string {
  return TOOL_VERBS[name] ?? "Running";
}
