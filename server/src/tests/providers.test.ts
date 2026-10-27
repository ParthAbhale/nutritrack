import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateConsumed } from '@nutritrack/shared';
import { __test as usda } from '../providers/nutrition/usda';
import { __test as off } from '../providers/nutrition/openFoodFacts';
import { __test as nix } from '../providers/nutrition/nutritionix';
import { csvCell, toCsv } from '../utils/csv';
import { computeStreak } from '../services/progressService';
import { computePeriodStats } from '../services/analyticsService';
import { emptyTotals, addToTotals, emptyNutrients } from '@nutritrack/shared';

const sample = (name: string) => JSON.parse(readFileSync(new URL(`./samples/${name}`, import.meta.url), 'utf8'));

describe('USDA normalization (recorded real responses)', () => {
  it('maps branded search results per 100 g with label serving', () => {
    const parsed = usda.searchResponse.parse(sample('usda-search-branded.json'));
    const f = parsed.foods[1]!;
    const food = usda.buildFood(f, usda.mapNutrients(f.foodNutrients.map((n) => ({ id: n.nutrientId, number: n.nutrientNumber, unit: n.unitName, value: n.value }))), [], true);
    expect(food).toMatchObject({ provider: 'usda', kind: 'branded', basis: { type: 'per100g' }, brand: "Wild Oats Marketplace", name: 'Peanut Butter' });
    expect(food.nutrients).toMatchObject({ calories: 594, protein: 21.9, fat: 46.9, carbs: 25 });
    const label = food.servings.find((s) => s.id === 'label')!;
    expect(label.grams).toBe(32);
    expect(calculateConsumed(food.nutrients, food.basis, label, 1).nutrients.calories).toBeCloseTo(190.08);
    expect(food.allergens).toBeNull();
  });

  it('maps generic detail with food-specific portions', () => {
    const f = usda.detailFood.parse(sample('usda-detail-generic.json'));
    const nutrients = usda.mapNutrients(f.foodNutrients.map((n) => ({ id: n.nutrient?.id, number: n.nutrient?.number, unit: n.nutrient?.unitName, value: n.amount })));
    const food = usda.buildFood(f, nutrients, f.foodPortions, true);
    expect(food.kind).toBe('generic');
    expect(food.nutrients.calories).toBe(101);
    const cup = food.servings.find((s) => s.label.startsWith('1 cup'))!;
    expect(cup.grams).toBe(164);
  });

  it('treats absent nutrients as unknown', () => {
    expect(usda.mapNutrients([{ id: 1008, unit: 'KCAL', value: 100 }]).protein).toBeNull();
    expect(usda.mapNutrients([{ id: 1008, unit: 'kJ', value: 418 }]).calories).toBeNull();
  });
});

describe('Open Food Facts normalization', () => {
  it('maps product data, converts sodium to mg, and keeps allergen tags', () => {
    const food = off.mapProduct(sample('off-product.json').product)!;
    expect(food).toMatchObject({ provider: 'openfoodfacts', name: 'Nutella', brand: 'Ferrero', barcode: '3017624010701' });
    expect(food.nutrients.calories).toBe(539);
    expect(food.nutrients.sodium).toBeCloseTo(43);
    expect(food.nutrients.fiber).toBeNull();
    expect(food.allergens).toEqual(['nuts']);
    expect(food.imageUrl).toMatch(/^https:\/\/images\.openfoodfacts\.org\//);
  });

  it('rejects untrusted image hosts and malformed products', () => {
    const food = off.mapProduct({ code: '123', product_name: 'X', image_front_small_url: 'http://evil.example/x.png', nutriments: { 'energy-kcal_100g': 'abc' } })!;
    expect(food.imageUrl).toBeNull();
    expect(food.nutrients.calories).toBeNull();
    expect(food.completeness).toBe('unknown');
    expect(off.mapProduct({ product_name: 'no code' })).toBeNull();
  });
});

describe('Nutritionix normalization (documented v2 shape)', () => {
  it('maps per-serving values and alternative measures', () => {
    const food = nix.mapFood(
      {
        food_name: 'Creamy Peanut Butter', brand_name: 'Some Brand', nix_item_id: 'abc123def456', serving_qty: 2, serving_unit: 'tbsp',
        serving_weight_grams: 32, nf_calories: 190, nf_protein: 7, nf_total_carbohydrate: 8, nf_total_fat: 16,
        alt_measures: [{ serving_weight: 16, measure: 'tbsp', qty: 1 }],
      },
      true,
    );
    expect(food.basis).toEqual({ type: 'perServing', servingGrams: 32 });
    const label = food.servings.find((s) => s.id === 'label')!;
    expect(calculateConsumed(food.nutrients, food.basis, label, 0.5).nutrients.calories).toBe(95);
    const tbsp = food.servings.find((s) => s.id === 'alt-0')!;
    expect(calculateConsumed(food.nutrients, food.basis, tbsp, 1).nutrients.calories).toBe(95);
    expect(food.nutrients.sodium).toBeNull();
  });
});

describe('CSV safety', () => {
  it('escapes quotes, commas, newlines and formula prefixes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=1+1')).toBe(`"'=1+1"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(null)).toBe('');
    expect(toCsv(['x'], [['line\nbreak']])).toBe('x\r\n"line\nbreak"\r\n');
  });
});

describe('streaks and period stats', () => {
  it('keeps a streak alive until today ends and tracks the longest run', () => {
    expect(computeStreak(['2026-10-24', '2026-10-25', '2026-10-26'], '2026-10-27')).toMatchObject({ current: 3, pendingToday: true });
    expect(computeStreak(['2026-10-20', '2026-10-21', '2026-10-27'], '2026-10-27')).toMatchObject({ current: 1, longest: 2 });
    expect(computeStreak([], '2026-10-27')).toMatchObject({ current: 0, longest: 0, lastLoggedDate: null });
    expect(computeStreak(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01').current).toBe(3);
  });

  it('does not count future days as missed', () => {
    const t = emptyTotals();
    addToTotals(t, { ...emptyNutrients(), calories: 2000 });
    const stats = computePeriodStats('2026-10-01', '2026-10-31', '2026-10-10', new Map([['2026-10-05', t]]), new Map(), () => null);
    expect(stats.daysInPeriod).toBe(31);
    expect(stats.elapsedDays).toBe(10);
    expect(stats.consistencyPercent).toBeCloseTo(10);
  });
});
