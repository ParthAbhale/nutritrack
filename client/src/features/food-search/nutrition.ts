import { calculateConsumed, NutritionCalculationError, type FoodItem, type NutrientValues } from '@nutritrack/shared';

/**
 * Client-side PREVIEW using the exact shared function the server uses to
 * compute stored values, so the preview always matches what gets saved.
 */
export function previewNutrition(food: FoodItem, servingId: string, quantity: number): { nutrients: NutrientValues; grams: number | null } | { error: string } {
  const option = food.servings.find((s) => s.id === servingId);
  if (!option) return { error: 'Choose a serving size' };
  try {
    const r = calculateConsumed(food.nutrients, food.basis, option, quantity);
    return { nutrients: r.nutrients, grams: r.consumedGrams };
  } catch (err) {
    if (err instanceof NutritionCalculationError) return { error: err.message };
    throw err;
  }
}

export function defaultServingNutrition(food: FoodItem) {
  const r = previewNutrition(food, food.defaultServingId, 1);
  return 'error' in r ? null : r;
}

export const PROVIDER_LABEL: Record<FoodItem['provider'], string> = {
  nutritionix: 'Nutritionix',
  usda: 'USDA',
  openfoodfacts: 'Open Food Facts',
  custom: 'Custom',
  recipe: 'Recipe',
  fixture: 'Test data',
};

export function basisLabel(food: FoodItem) {
  if (food.basis.type === 'per100g') return 'Values per 100 g';
  if (food.basis.type === 'per100ml') return 'Values per 100 ml';
  return 'Values per labelled serving';
}
