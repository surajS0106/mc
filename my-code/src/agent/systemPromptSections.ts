type ComputeFn = () => string | null | Promise<string | null>;

type SystemPromptSection = {
  name: string;
  compute: ComputeFn;
  cacheBreak: boolean;
};

const sectionCache = new Map<string, string | null>();

/**
 * Create a memoized system prompt section.
 * Computed once, cached until /clear or /compact.
 */
export function systemPromptSection(
  name: string,
  compute: ComputeFn,
): SystemPromptSection {
  return { name, compute, cacheBreak: false };
}

/**
 * Create a volatile system prompt section that recomputes every turn.
 * This WILL break the prompt cache when the value changes.
 * Requires a reason explaining why cache-breaking is necessary.
 */
export function DANGEROUS_uncachedSystemPromptSection(
  name: string,
  compute: ComputeFn,
  _reason: string,
): SystemPromptSection {
  return { name, compute, cacheBreak: true };
}

/**
 * Resolve all system prompt sections, returning prompt strings.
 *
 * `cacheKeyPrefix` (the cwd) namespaces the cache so engines/sub-engines with a
 * different working directory can't read another cwd's cached section.
 */
export async function resolveSystemPromptSections(
  sections: SystemPromptSection[],
  cacheKeyPrefix = "",
): Promise<(string | null)[]> {
  return Promise.all(
    sections.map(async s => {
      const key = `${cacheKeyPrefix}::${s.name}`;
      if (!s.cacheBreak && sectionCache.has(key)) {
        return sectionCache.get(key) ?? null;
      }
      const value = await s.compute();
      sectionCache.set(key, value);
      return value;
    }),
  );
}

/**
 * Clear all system prompt section state. Called on /clear and /compact.
 */
export function clearSystemPromptSections(): void {
  sectionCache.clear();
}
