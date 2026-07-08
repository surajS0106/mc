import type { PromptCommand } from '../types/command.js';

const bundledSkillsRegistry = new Map<string, PromptCommand>();

export function registerBundledSkill(skill: PromptCommand) {
  bundledSkillsRegistry.set(skill.name, skill);
}

export function getBundledSkills(): PromptCommand[] {
  return Array.from(bundledSkillsRegistry.values());
}
