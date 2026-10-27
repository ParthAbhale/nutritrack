/**
 * Nutrition calculation rules. This module is the single source of truth for
 * serving math and aggregation. The server uses it to compute the values it
 * persists and returns; the client uses it only to preview a calculation before
 * saving, so preview and stored values can never disagree.
 *
 * Canonical units:
 *   energy  -> kcal
 *   protein, carbs, fat, saturatedFat, fiber, sugars -> grams
 *   sodium  -> milligrams
 *   water   -> millilitres
 *   weight  -> kilograms
 *
 * A nutrient value of `null` means "unknown". It is never treated as zero.
 */

export const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat', 'saturatedFat', 'fiber', 'sugars', 'sodium'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type NutrientValues = Record<NutrientKey, number | null>;

export const CORE_NUTRIENTS = ['calories', 'protein', 'carbs', 'fat'] as const satisfies readonly NutrientKey[];

export const NUTRIENT_META: Record<NutrientKey, { label: string; unit: string }> = {
  calories: { label: 'Calories', unit: 'kcal' },
  protein: { label: 'Protein', unit: 'g' },
  carbs: { label: 'Carbohydrates', unit: 'g' },
  fat: { label: 'Fat', unit: 'g' },
  saturatedFat: { label: 'Saturated fat', unit: 'g' },
  fiber: { label: 'Fiber', unit: 'g' },
  sugars: { label: 'Sugars', unit: 'g' },
  sodium: { label: 'Sodium', unit: 'mg' },
};

/** Approximate Atwater general factors (kcal per gram). */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * The basis the source nutrient values are expressed in.
 *  - per100g / per100ml: values describe 100 g (or 100 ml) of the food.
 *  - perServing: values describe one labelled serving. `servingGrams` is the
 *    weight (or volume) of that serving when the source states it.
 */
export type NutrientBasis =
  | { type: 'per100g' }
  | { type: 'per100ml' }
  | { type: 'perServing'; servingGrams: number | null };

/**
 * A serving option a user can pick. `grams` is the weight (or millilitres for
 * per100ml foods) of ONE unit of this option, when reliably known for this
 * specific food. `isBasisServing` marks the labelled serving of a perServing
 * food. A volume option such as "1 cup" exists only if the source supplied a
 * food-specific gram weight for it.
 */
export interface ServingOption {
  id: string;
  label: string;
  grams: number | null;
  isBasisServing?: boolean;
}

export function emptyNutrients(): NutrientValues {
  return { calories: null, protein: null, carbs: null, fat: null, saturatedFat: null, fiber: null, sugars: null, sodium: null };
}

export const MAX_SERVINGS = 10000;

export class NutritionCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NutritionCalculationError';
  }
}

/**
 * Factor that converts the food's basis values into the consumed amount.
 *
 * per100g:    amountConsumedGrams = gramsPerServing x numberOfServings
 *             nutrientConsumed    = nutrientPer100g x amountConsumedGrams / 100
 * perServing: nutrientConsumed    = nutrientPerServing x numberOfServings
 *             (a non-label option such as "1 g" is first converted to label
 *              servings via servingGrams, and only when both weights are known)
 */
export function basisFactor(basis: NutrientBasis, option: ServingOption, quantity: number): number {
  validateQuantity(quantity);
  if (basis.type === 'per100g' || basis.type === 'per100ml') {
    if (option.grams === null || !(option.grams > 0)) {
      throw new NutritionCalculationError(`Serving "${option.label}" has no known weight for this food`);
    }
    const amountConsumed = option.grams * quantity;
    return amountConsumed / 100;
  }
  if (option.isBasisServing) return quantity;
  if (option.grams !== null && option.grams > 0 && basis.servingGrams !== null && basis.servingGrams > 0) {
    return (option.grams * quantity) / basis.servingGrams;
  }
  throw new NutritionCalculationError(`Serving "${option.label}" cannot be converted for this food`);
}

export function validateQuantity(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new NutritionCalculationError('Quantity must be a positive number');
  }
  if (quantity > MAX_SERVINGS) {
    throw new NutritionCalculationError(`Quantity cannot exceed ${MAX_SERVINGS}`);
  }
}

export function scaleNutrients(values: NutrientValues, factor: number): NutrientValues {
  const out = emptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    const v = values[key];
    out[key] = v === null ? null : v * factor;
  }
  return out;
}

export function calculateConsumed(
  nutrients: NutrientValues,
  basis: NutrientBasis,
  option: ServingOption,
  quantity: number,
): { nutrients: NutrientValues; consumedGrams: number | null } {
  const factor = basisFactor(basis, option, quantity);
  const consumedGrams = option.grams !== null ? option.grams * quantity : null;
  return { nutrients: scaleNutrients(nutrients, factor), consumedGrams };
}

/**
 * Totals with missing-data accounting. `values[key]` is the sum of all known
 * values (null when no item reported the nutrient at all) and `missing[key]`
 * counts items whose value was unknown, so the UI can say "at least X g".
 */
export interface NutrientTotals {
  values: NutrientValues;
  missing: Record<NutrientKey, number>;
  count: number;
}

export function emptyTotals(): NutrientTotals {
  const missing = {} as Record<NutrientKey, number>;
  for (const key of NUTRIENT_KEYS) missing[key] = 0;
  return { values: emptyNutrients(), missing, count: 0 };
}

export function sumNutrients(items: readonly NutrientValues[]): NutrientTotals {
  const totals = emptyTotals();
  for (const item of items) addToTotals(totals, item);
  return totals;
}

export function addToTotals(totals: NutrientTotals, item: NutrientValues): void {
  totals.count += 1;
  for (const key of NUTRIENT_KEYS) {
    const v = item[key];
    if (v === null) totals.missing[key] += 1;
    else totals.values[key] = (totals.values[key] ?? 0) + v;
  }
}

export function mergeTotals(list: readonly NutrientTotals[]): NutrientTotals {
  const out = emptyTotals();
  for (const t of list) {
    out.count += t.count;
    for (const key of NUTRIENT_KEYS) {
      out.missing[key] += t.missing[key];
      const v = t.values[key];
      if (v !== null) out.values[key] = (out.values[key] ?? 0) + v;
    }
  }
  return out;
}

export function nutrientCompleteness(values: NutrientValues): 'complete' | 'partial' | 'unknown' {
  const known = CORE_NUTRIENTS.filter((k) => values[k] !== null).length;
  if (known === CORE_NUTRIENTS.length) return 'complete';
  return known === 0 ? 'unknown' : 'partial';
}

/** Calories attributable to each macro using the general factors. */
export function macroCalories(values: Pick<NutrientValues, 'protein' | 'carbs' | 'fat'>) {
  const protein = values.protein === null ? null : values.protein * KCAL_PER_GRAM.protein;
  const carbs = values.carbs === null ? null : values.carbs * KCAL_PER_GRAM.carbs;
  const fat = values.fat === null ? null : values.fat * KCAL_PER_GRAM.fat;
  const total = (protein ?? 0) + (carbs ?? 0) + (fat ?? 0);
  return { protein, carbs, fat, total };
}

export interface GoalProgress {
  consumed: number;
  target: number | null;
  /** target - consumed; negative when exceeded. */
  remaining: number | null;
  /** Unclamped percentage, e.g. 112 when 12% over. */
  percent: number | null;
  status: 'no-target' | 'under' | 'met' | 'over';
}

/** A day "meets" a calorie goal when within +/-10% of the target. */
export const GOAL_TOLERANCE = 0.1;

export function goalProgress(consumed: number | null, target: number | null | undefined): GoalProgress {
  const c = consumed ?? 0;
  if (target === null || target === undefined || target <= 0) {
    return { consumed: c, target: null, remaining: null, percent: null, status: 'no-target' };
  }
  const ratio = c / target;
  const status = ratio > 1 + GOAL_TOLERANCE ? 'over' : ratio >= 1 - GOAL_TOLERANCE ? 'met' : 'under';
  return { consumed: c, target, remaining: target - c, percent: ratio * 100, status };
}

/** Display rounding only. Never use before storing or aggregating. */
export function roundForDisplay(value: number | null, key: NutrientKey | 'water' | 'weight' = 'protein'): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (key === 'calories' || key === 'sodium' || key === 'water') return String(Math.round(value));
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Recipe totals. Ingredients are already-calculated consumed values; per-portion
 * values divide the total by the portion count.
 */
export function recipeNutrition(ingredients: readonly { nutrients: NutrientValues; grams: number | null }[], portions: number) {
  if (!Number.isFinite(portions) || portions <= 0) throw new NutritionCalculationError('Portions must be a positive number');
  const totals = sumNutrients(ingredients.map((i) => i.nutrients));
  // A recipe nutrient is only "known" if every ingredient reported it; otherwise the
  // total understates it, which we surface via `missing`.
  const perPortion = scaleNutrients(totals.values, 1 / portions);
  const allWeightsKnown = ingredients.every((i) => i.grams !== null);
  const totalGrams = allWeightsKnown ? ingredients.reduce((s, i) => s + (i.grams ?? 0), 0) : null;
  return {
    total: totals,
    perPortion,
    gramsPerPortion: totalGrams !== null && totalGrams > 0 ? totalGrams / portions : null,
  };
}