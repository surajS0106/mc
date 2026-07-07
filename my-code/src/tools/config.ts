/**
 * ConfigTool — Let the LLM read or write CLI configuration settings.
 *
 * GET: omit `value` — returns current setting value.
 * SET: provide `value` — updates the setting and persists it.
 *
 * Wraps our globalConfig.ts (key-value INI-style store).
 */

import { z } from 'zod';
import { buildTool } from './Tool.js';
import { loadConfig, setConfigKey, getConfigValue } from '../config/globalConfig.js';

// Settings the LLM is allowed to read/write with documentation
const SUPPORTED_SETTINGS: Record<string, string> = {
  model:         'Default LLM model name (e.g. "gpt-oss:120b-cloud", "gpt-4o")',
  provider:      'Default LLM provider ("ollama", "openai", "gemini")',
  contextLength: 'Max context window in tokens (number)',
  autoCompact:   'Auto-compact when context nearly full ("true" or "false")',
  theme:         'UI color theme ("dark" or "light")',
};

export const ConfigTool = buildTool({
  name: 'Config',
  description:
    'Read or write CLI configuration settings. ' +
    'Omit `value` to GET the current value; provide `value` to SET it. ' +
    'Supported settings: ' + Object.keys(SUPPORTED_SETTINGS).join(', ') + '. ' +
    'Changes are persisted to the global config file.',

  inputSchema: z.object({
    setting: z.string().describe(
      'Config key to read or write. Supported: ' +
      Object.keys(SUPPORTED_SETTINGS).join(', ') + '.'
    ),
    value: z.string().optional().describe(
      'New value to set. Omit to read the current value.'
    ),
  }),

  isReadOnly: (input) => input.value === undefined,
  isConcurrencySafe: (input) => input.value === undefined,
  isDestructive: () => false,

  async call({ setting, value }) {
    if (!SUPPORTED_SETTINGS[setting]) {
      return [
        `Error: Unknown setting "${setting}".`,
        'Supported settings:',
        ...Object.entries(SUPPORTED_SETTINGS).map(([k, v]) => `  ${k}: ${v}`),
      ].join('\n');
    }

    // GET
    if (value === undefined) {
      const current = await getConfigValue(setting);
      const display = current ?? '(not set — using CLI default)';
      return `${setting} = ${display}\n(${SUPPORTED_SETTINGS[setting]})`;
    }

    // SET
    try {
      const result = await setConfigKey(setting, value);
      return `Set ${setting} = "${value}" (saved to ${result.file})`;
    } catch (e) {
      return `Error setting "${setting}": ${e instanceof Error ? e.message : String(e)}`;
    }
  },

  getActivityDescription(input) {
    return input.value === undefined
      ? `reading config: ${input.setting}`
      : `setting config: ${input.setting} = ${input.value}`;
  },
});
