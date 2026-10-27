import { describe, expect, it } from 'vitest';
import { emptyNutrients, type FoodItem } from '@nutritrack/shared';
import { previewNutrition, defaultServingNutrition } from '@/features/food-search/nutrition';
import { safeRedirect } from '@/features/auth/redirect';
import { passwordStrength } from '@/features/auth/PasswordInput';
import { suggestMeal } from '@/lib/stores';
import { formatWater, formatWeight } from '@/lib/format';

export const food: FoodItem = {
  provider: 'usda', providerFoodId: '1', name: 'Peanut Butter', brand: 'Brand', barcode: null, imageUrl: null, category: null, kind: 'branded',
  basis: { type: 'per100g' }, nutrients: { ...emptyNutrients(), calories: 594, protein: 21.9, carbs: 25, fat: 46.9 },
  servings: [{ id: 'label', label: '1 serving – 32 g', grams: 32 }, { id: '1g', label: '1 g', grams: 1 }, { id: 'cup', label: '1 cup', grams: null }],
  defaultServingId: 'label', completeness: 'complete', detailed: true, ingredientsText: null, allergens: ['peanuts'], attribution: 'USDA', sourceUrl: null, fetchedAt: '2026-01-01T00:00:00Z',
};

describe('serving preview', () => {
  it('matches the server formula for per-100 g foods', () => {
    const r = previewNutrition(food, 'label', 1.5);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.grams).toBe(48);
    expect(r.nutrients.calories).toBeCloseTo(285.12);
    expect(r.nutrients.fiber).toBeNull();
    expect(defaultServingNutrition(food)?.nutrients.calories).toBeCloseTo(190.08);
  });

  it('returns an error instead of guessing unknown conversions', () => {
    expect(previewNutrition(food, 'cup', 1)).toMatchObject({ error: expect.stringContaining('no known weight') });
    expect(previewNutrition(food, 'missing', 1)).toEqual({ error: 'Choose a serving size' });
  });
});

describe('helpers', () => {
  it('only allows relative in-app redirects', () => {
    expect(safeRedirect('/diary?date=2026-01-01')).toBe('/diary?date=2026-01-01');
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/login', null]) expect(safeRedirect(bad)).toBe('/dashboard');
  });
  it('scores password strength', () => {
    expect(passwordStrength('short').score).toBe(0);
    expect(passwordStrength('Password1234').score).toBeLessThanOrEqual(1);
    expect(passwordStrength('Correct-Horse-Battery-9').score).toBe(4);
  });
  it('suggests a meal by time of day', () => {
    expect(suggestMeal(new Date(2026, 0, 1, 7))).toBe('breakfast');
    expect(suggestMeal(new Date(2026, 0, 1, 13))).toBe('lunch');
    expect(suggestMeal(new Date(2026, 0, 1, 19))).toBe('dinner');
    expect(suggestMeal(new Date(2026, 0, 1, 23))).toBe('snacks');
  });
  it('formats canonical units for display', () => {
    expect(formatWater(250)).toBe('250 ml');
    expect(formatWater(1500)).toBe('1.5 L');
    expect(formatWater(2000)).toBe('2 L');
    expect(formatWater(473.176, 'imperial')).toBe('16 fl oz');
    expect(formatWeight(70, 'imperial')).toBe('154.3 lb');
  });
});
