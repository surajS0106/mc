const fs = require('fs');
let code = fs.readFileSync('src/agent/context.ts', 'utf8');

code = code.replace(
  /import \{ getAutoMemPath \} from ["'][^"']+["'];/,
  `import { getAutoMemPath } from "../memdir/paths.js";
import { memoize } from "lodash-es";
import { systemPromptSection, DANGEROUS_uncachedSystemPromptSection, resolveSystemPromptSections, clearSystemPromptSections } from "./systemPromptSections.js";
import { readSessionMemory } from "../services/sessionMemory/index.js";

export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY = "====== DYNAMIC BOUNDARY ======";`
);

fs.writeFileSync('src/agent/context.ts', code);
