import { emptyNutrients, type FoodItem, type ServingOption } from '@nutritrack/shared';
import { env } from '../../config/env';
import { UpstreamError } from '../../utils/http';
import { finalizeFood, gramOptions } from './normalize';
import { FIXTURE_FOODS, FIXTURE_PORTIONS, type FixtureFood } from './fixtures/foods';
import type { NutritionProvider, ProviderSearchOptions, ProviderSearchPage } from './types';

/**
 * Deterministic provider for automated tests. Disabled unless
 * ENABLE_FIXTURE_PROVIDER=true and refused in production by env validation.
 * The query "fixture-outage" simulates an upstream failure.
 */
function toFood(f: FixtureFood): FoodItem {
  const servings: ServingOption[] = [];
  if (f.servingGrams && f.servingLabel) servings.push({ id: 'label', label: `1 serving (${f.servingLabel}) – ${f.servingGrams} g`, grams: f.servingGrams });
  (FIXTURE_PORTIONS[f.id] ?? []).forEach((p, i) => servings.push({ id: `portion-${i}`, label: `${p.label} – ${p.grams} g`, grams: p.grams }));
  servings.push(...gramOptions('g'));
  return finalizeFood({
    provider: 'fixture',
    providerFoodId: f.id,
    name: f.name,
    brand: f.brand,
    barcode: f.barcode,
    imageUrl: null,
    category: f.kind === 'branded' ? 'Branded (test data)' : 'Generic (test data)',
    kind: f.kind,
    basis: { type: 'per100g' },
    nutrients: { ...emptyNutrients(), ...f.per100g },
    servings,
    defaultServingId: servings[0]!.id,
    detailed: true,
    ingredientsText: null,
    allergens: f.allergens,
    attribution: 'Synthetic test fixture data (not real product data)',
    sourceUrl: null,
  });
}

export class FixtureProvider implements NutritionProvider {
  readonly id = 'fixture' as const;
  readonly label = 'Test fixtures';
  readonly supportsBarcode = true;

  isConfigured() {
    const e = env();
    return e.ENABLE_FIXTURE_PROVIDER && e.NODE_ENV !== 'production';
  }

  async search(query: string, opts: ProviderSearchOptions): Promise<ProviderSearchPage> {
    if (query.toLowerCase().includes('fixture-outage')) throw new UpstreamError('Simulated outage', 503, false);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = FIXTURE_FOODS.filter((f) => {
      if (opts.type !== 'all' && f.kind !== opts.type) return false;
      const hay = `${f.name} ${f.brand ?? ''}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    const start = (opts.page - 1) * opts.pageSize;
    const items = matches.slice(start, start + opts.pageSize).map(toFood);
    return { items, total: matches.length, hasMore: start + opts.pageSize < matches.length };
  }

  async getFood(foodId: string): Promise<FoodItem | null> {
    const f = FIXTURE_FOODS.find((x) => x.id === foodId);
    return f ? toFood(f) : null;
  }

  async lookupBarcode(barcode: string): Promise<FoodItem | null> {
    const f = FIXTURE_FOODS.find((x) => x.barcode === barcode);
    return f ? toFood(f) : null;
  }
}
