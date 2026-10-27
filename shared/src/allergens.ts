/**
 * Allergen matching. Warnings are only produced when the source actually
 * provided allergen data (`allergens !== null`). An empty result never means
 * "safe": source data can be incomplete or out of date.
 */
export function matchAllergens(foodAllergens: string[] | null, userAllergens: readonly string[]): string[] | null {
  if (foodAllergens === null) return null;
  const set = new Set(foodAllergens.map((a) => a.replace(/^[a-z]{2}:/, '')));
  return userAllergens.filter((a) => set.has(a));
}

export function matchExcludedTerms(text: string, excluded: readonly string[]): string[] {
  const haystack = text.toLowerCase();
  return excluded.filter((term) => term.trim() && haystack.includes(term.trim().toLowerCase()));
}

export const ALLERGEN_DISCLAIMER =
  'Allergen information comes from third-party product data that may be incomplete or outdated. Always check the package label; NutriTrack cannot guarantee a food is safe for you.';
