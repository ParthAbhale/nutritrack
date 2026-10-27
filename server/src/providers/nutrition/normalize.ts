import { emptyNutrients, nutrientCompleteness, type FoodItem, type NutrientValues, type ServingOption } from '@nutritrack/shared';

/** Accepts only finite, non-negative numbers (or numeric strings); anything else is unknown (null). */
export function num(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

export function str(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const t = value.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
}

/** Only https image URLs from an allow-listed host are passed to the browser. */
export function safeImageUrl(value: unknown, allowedHosts: readonly string[]): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') return null;
    return allowedHosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`)) ? u.toString() : null;
  } catch {
    return null;
  }
}

export function titleCase(value: string): string {
  // Many USDA branded descriptions are ALL CAPS; make them readable without altering mixed-case names.
  if (value !== value.toUpperCase()) return value;
  return value.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, p, c: string) => p + c.toUpperCase());
}

export function round(value: number, places = 2) {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

export function gramOptions(unit: 'g' | 'ml'): ServingOption[] {
  return [
    { id: `100${unit}`, label: `100 ${unit}`, grams: 100 },
    { id: `1${unit}`, label: `1 ${unit}`, grams: 1 },
  ];
}

export function finalizeFood(food: Omit<FoodItem, 'completeness' | 'fetchedAt'> & { nutrients: NutrientValues }): FoodItem {
  return { ...food, completeness: nutrientCompleteness(food.nutrients), fetchedAt: new Date().toISOString() };
}

export { emptyNutrients };
