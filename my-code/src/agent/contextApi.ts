import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from "./context.js";
import type { SystemPrompt } from "./systemPromptType.js";

export type CacheScope = 'global' | 'org';
export type SystemPromptBlock = {
  text: string;
  cacheScope: CacheScope | null;
};

/**
 * Split system prompt blocks by content type for API matching and cache control.
 */
export function splitSysPromptPrefix(
  systemPrompt: SystemPrompt,
): SystemPromptBlock[] {
  const boundaryIndex = systemPrompt.findIndex(
    s => s === SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
  );
  
  if (boundaryIndex !== -1) {
    const staticBlocks: string[] = [];
    const dynamicBlocks: string[] = [];

    for (let i = 0; i < systemPrompt.length; i++) {
      const block = systemPrompt[i];
      if (!block || block === SYSTEM_PROMPT_DYNAMIC_BOUNDARY) continue;

      if (i < boundaryIndex) {
        staticBlocks.push(block);
      } else {
        dynamicBlocks.push(block);
      }
    }

    const result: SystemPromptBlock[] = [];
    const staticJoined = staticBlocks.join('\n\n');
    if (staticJoined) {
      result.push({ text: staticJoined, cacheScope: 'global' });
    }
    const dynamicJoined = dynamicBlocks.join('\n\n');
    if (dynamicJoined) {
      result.push({ text: dynamicJoined, cacheScope: null });
    }
    return result;
  }

  // Fallback if no boundary
  const restJoined = systemPrompt.filter(Boolean).join('\n\n');
  return restJoined ? [{ text: restJoined, cacheScope: 'org' }] : [];
}
