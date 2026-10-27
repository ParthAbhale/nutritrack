import { describe, expect, it } from 'vitest';
import {
  basisFactor, calculateConsumed, emptyNutrients, goalProgress, macroCalories, NutritionCalculationError,
  recipeNutrition, roundForDisplay, sumNutrients, type NutrientValues,
} from '../nutrition';
import { estimateEnergyNeeds, MIN_SUGGESTED_CALORIES } from '../energy';
import { matchAllergens } from '../allergens';

const per100: NutrientValues = { ...emptyNutrients(), calories: 588, protein: 25, carbs: 20, fat: 50 };

describe('serving calculations', () => {
  it('applies the per-100 g formula using grams per serving', () => {
    const { nutrients, consumedGrams } = calculateConsumed(per100, { type: 'per100g' }, { id: 's', label: '2 tbsp', grams: 32 }, 1.5);
    expect(consumedGrams).toBe(48);
    expect(nutrients.calories).toBeCloseTo(282.24, 6);
    expect(nutrients.protein).toBeCloseTo(12, 6);
    expect(nutrients.fiber).toBeNull();
  });

  it('applies the per-serving formula without the per-100 g scaling', () => {
    const perServing: NutrientValues = { ...emptyNutrients(), calories: 190, protein: 7, carbs: 8, fat: 15 };
    const basis = { type: 'perServing', servingGrams: 32 } as const;
    const label = { id: 'serving', label: '1 serving', grams: 32, isBasisServing: true };
    expect(calculateConsumed(perServing, basis, label, 0.5).nutrients.calories).toBe(95);
    expect(calculateConsumed(perServing, basis, label, 2).nutrients.protein).toBe(14);
    // a gram option converts through the serving weight
    expect(calculateConsumed(perServing, basis, { id: 'g', label: '1 g', grams: 1 }, 16).nutrients.calories).toBeCloseTo(95, 6);
  });

  it('refuses conversions it cannot justify', () => {
    expect(() => basisFactor({ type: 'per100g' }, { id: 'cup', label: '1 cup', grams: null }, 1)).toThrow(NutritionCalculationError);
    expect(() => basisFactor({ type: 'perServing', servingGrams: null }, { id: 'g', label: '1 g', grams: 1 }, 10)).toThrow(NutritionCalculationError);
  });

  it('validates quantity', () => {
    const opt = { id: 'g', label: '1 g', grams: 1 };
    for (const q of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 101]) {
      expect(() => basisFactor({ type: 'per100g' }, opt, q)).toThrow(NutritionCalculationError);
    }
    expect(basisFactor({ type: 'per100g' }, opt, 1.25)).toBeCloseTo(0.0125, 10);
  });

  it('keeps zero values distinct from missing values', () => {
    const water: NutrientValues = { ...emptyNutrients(), calories: 0, protein: 0, carbs: 0, fat: 0 };
    const out = calculateConsumed(water, { type: 'per100ml' }, { id: 'ml', label: '250 ml', grams: 250 }, 1).nutrients;
    expect(out.calories).toBe(0);
    expect(out.sodium).toBeNull();
  });
});

describe('aggregation', () => {
  it('sums known values and counts missing ones', () => {
    const a = { ...emptyNutrients(), calories: 100, protein: 10, carbs: null, fat: 1 };
    const b = { ...emptyNutrients(), calories: 50.5, protein: 0, carbs: 5, fat: null };
    const t = sumNutrients([a, b]);
    expect(t.values.calories).toBe(150.5);
    expect(t.values.protein).toBe(10);
    expect(t.values.carbs).toBe(5);
    expect(t.missing.carbs).toBe(1);
    expect(t.missing.fat).toBe(1);
    expect(t.values.fiber).toBeNull();
    expect(t.missing.fiber).toBe(2);
    expect(t.count).toBe(2);
  });

  it('computes macro calories and does not clamp goal progress', () => {
    expect(macroCalories({ protein: 10, carbs: 20, fat: 10 }).total).toBe(210);
    const over = goalProgress(2400, 2000);
    expect(over.percent).toBeCloseTo(120);
    expect(over.remaining).toBe(-400);
    expect(over.status).toBe('over');
    expect(goalProgress(1950, 2000).status).toBe('met');
    expect(goalProgress(1000, 2000).status).toBe('under');
    expect(goalProgress(500, null).status).toBe('no-target');
  });

  it('divides recipes into portions', () => {
    const r = recipeNutrition(
      [
        { nutrients: { ...emptyNutrients(), calories: 400, protein: 20, carbs: 40, fat: 10 }, grams: 300 },
        { nutrients: { ...emptyNutrients(), calories: 200, protein: 10, carbs: 0, fat: 20 }, grams: 100 },
      ],
      4,
    );
    expect(r.perPortion.calories).toBe(150);
    expect(r.perPortion.protein).toBe(7.5);
    expect(r.gramsPerPortion).toBe(100);
    expect(() => recipeNutrition([], 0)).toThrow();
  });

  it('rounds only for display', () => {
    expect(roundForDisplay(282.24, 'calories')).toBe('282');
    expect(roundForDisplay(12.04)).toBe('12');
    expect(roundForDisplay(12.06)).toBe('12.1');
    expect(roundForDisplay(null)).toBe('—');
  });
});

describe('energy estimates', () => {
  it('never suggests below the safety floor', () => {
    const e = estimateEnergyNeeds({ weightKg: 45, heightCm: 150, ageYears: 60, sex: 'female', activityLevel: 'sedentary', goal: 'lose' });
    expect(e.suggestedCalories).toBeGreaterThanOrEqual(MIN_SUGGESTED_CALORIES);
    expect(e.notes.length).toBeGreaterThan(0);
  });
  it('limits deficits to 500 kcal', () => {
    const e = estimateEnergyNeeds({ weightKg: 120, heightCm: 190, ageYears: 30, sex: 'male', activityLevel: 'active', goal: 'lose' });
    expect(e.maintenanceCalories - e.suggestedCalories).toBeLessThanOrEqual(510);
  });
});

describe('allergens', () => {
  it('returns null when the source has no allergen data', () => {
    expect(matchAllergens(null, ['nuts'])).toBeNull();
    expect(matchAllergens(['en:nuts', 'en:milk'], ['nuts', 'gluten'])).toEqual(['nuts']);
  });
});
