export type EffortLevel = 'low' | 'medium' | 'high' | 'max';
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'max'] as const satisfies readonly EffortLevel[];
export type EffortValue = EffortLevel | number;

export function isEffortLevel(value: string): value is EffortLevel {
  return (EFFORT_LEVELS as readonly string[]).includes(value);
}

export function isValidNumericEffort(value: number): boolean {
  return Number.isInteger(value);
}

export function parseEffortValue(value: unknown): EffortValue | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && isValidNumericEffort(value)) {
    return value;
  }
  const str = String(value).toLowerCase();
  if (isEffortLevel(str)) {
    return str as EffortLevel;
  }
  const numericValue = parseInt(str, 10);
  if (!isNaN(numericValue) && isValidNumericEffort(numericValue)) {
    return numericValue;
  }
  return undefined;
}
