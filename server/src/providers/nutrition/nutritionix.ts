import { z } from 'zod';
import { emptyNutrients, type FoodItem, type NutrientValues, type ServingOption } from '@nutritrack/shared';
import { env } from '../../config/env';
import { fetchJson, UpstreamError } from '../../utils/http';
import { finalizeFood, num, round, safeImageUrl, str } from './normalize';
import type { NutritionProvider, ProviderSearchOptions, ProviderSearchPage } from './types';

/**
 * Nutritionix Track API v2 (https://docs.x.nutritionix.com/).
 * Requires an approved developer account (x-app-id / x-app-key); access
 * terms, quotas and pricing are set by Nutritionix. Values are per serving
 * (serving_qty serving_unit, weighing serving_weight_grams).
 *   GET  /v2/search/instant   branded + common food search
 *   GET  /v2/search/item      branded item detail by nix_item_id or upc
 *   POST /v2/natural/nutrients common food detail by name
 */
const BASE = 'https://trackapi.nutritionix.com/v2';
const ATTRIBUTION = 'Powered by Nutritionix';
const IMAGE_HOSTS = ['nutritionix.com', 'nix-tag-images.s3.amazonaws.com', 'd2eawub7utcl6.cloudfront.net', 'd1r9wva3zcpswd.cloudfront.net'];

// USDA-style attribute ids used by Nutritionix full_nutrients.
const ATTR: Record<keyof NutrientValues, number> = {
  calories: 208, protein: 203, carbs: 205, fat: 204, saturatedFat: 606, fiber: 291, sugars: 269, sodium: 307,
};

const altMeasure = z.object({ serving_weight: z.number().optional(), measure: z.string().optional(), qty: z.number().optional() });
const nixFood = z.object({
  food_name: z.string(),
  brand_name: z.string().nullish(),
  nix_item_id: z.string().nullish(),
  tag_id: z.union([z.string(), z.number()]).nullish(),
  serving_qty: z.number().nullish(),
  serving_unit: z.string().nullish(),
  serving_weight_grams: z.number().nullish(),
  nf_calories: z.number().nullish(),
  nf_total_fat: z.number().nullish(),
  nf_saturated_fat: z.number().nullish(),
  nf_sodium: z.number().nullish(),
  nf_total_carbohydrate: z.number().nullish(),
  nf_dietary_fiber: z.number().nullish(),
  nf_sugars: z.number().nullish(),
  nf_protein: z.number().nullish(),
  nf_ingredient_statement: z.string().nullish(),
  full_nutrients: z.array(z.object({ attr_id: z.number(), value: z.number() })).nullish(),
  photo: z.object({ thumb: z.string().nullish() }).nullish(),
  upc: z.string().nullish(),
  alt_measures: z.array(altMeasure).nullish(),
});
const instantResponse = z.object({ common: z.array(nixFood).default([]), branded: z.array(nixFood).default([]) });
const foodsResponse = z.object({ foods: z.array(nixFood).default([]) });

function mapNutrients(f: z.infer<typeof nixFood>): NutrientValues {
  const fromFull = (key: keyof NutrientValues) => {
    const hit = f.full_nutrients?.find((n) => n.attr_id === ATTR[key]);
    return hit ? num(hit.value) : null;
  };
  const pick = (direct: number | null | undefined, key: keyof NutrientValues) => num(direct) ?? fromFull(key);
  return {
    ...emptyNutrients(),
    calories: pick(f.nf_calories, 'calories'),
    protein: pick(f.nf_protein, 'protein'),
    carbs: pick(f.nf_total_carbohydrate, 'carbs'),
    fat: pick(f.nf_total_fat, 'fat'),
    saturatedFat: pick(f.nf_saturated_fat, 'saturatedFat'),
    fiber: pick(f.nf_dietary_fiber, 'fiber'),
    sugars: pick(f.nf_sugars, 'sugars'),
    sodium: pick(f.nf_sodium, 'sodium'),
  };
}

function mapFood(f: z.infer<typeof nixFood>, detailed: boolean): FoodItem {
  const qty = num(f.serving_qty) ?? 1;
  const unit = str(f.serving_unit, 30) ?? 'serving';
  const grams = num(f.serving_weight_grams);
  const servings: ServingOption[] = [
    { id: 'label', label: `${round(qty, 2)} ${unit}${grams ? ` – ${round(grams, 1)} g` : ''}`, grams, isBasisServing: true },
  ];
  (f.alt_measures ?? []).forEach((m, i) => {
    const w = num(m.serving_weight);
    const mq = num(m.qty) ?? 1;
    const label = str(m.measure, 30);
    if (w && w > 0 && label && !(label === unit && mq === qty)) servings.push({ id: `alt-${i}`, label: `${round(mq, 2)} ${label} – ${round(w, 1)} g`, grams: w });
  });
  if (grams) servings.push({ id: '1g', label: '1 g', grams: 1 }, { id: '100g', label: '100 g', grams: 100 });
  const branded = Boolean(f.nix_item_id);
  return finalizeFood({
    provider: 'nutritionix',
    providerFoodId: branded ? `item:${f.nix_item_id}` : `common:${f.food_name.toLowerCase()}`,
    name: str(f.food_name) ?? 'Unnamed food',
    brand: str(f.brand_name),
    barcode: str(f.upc, 20),
    imageUrl: safeImageUrl(f.photo?.thumb, IMAGE_HOSTS),
    category: branded ? 'Branded' : 'Common food',
    kind: branded ? 'branded' : 'generic',
    basis: { type: 'perServing', servingGrams: grams },
    nutrients: mapNutrients(f),
    servings,
    defaultServingId: 'label',
    detailed,
    ingredientsText: str(f.nf_ingredient_statement, 2000),
    allergens: null,
    attribution: ATTRIBUTION,
    sourceUrl: null,
  });
}

export class NutritionixProvider implements NutritionProvider {
  readonly id = 'nutritionix' as const;
  readonly label = 'Nutritionix';
  readonly supportsBarcode = true;

  isConfigured() {
    const e = env();
    return Boolean(e.NUTRITIONIX_APP_ID && e.NUTRITIONIX_API_KEY);
  }

  private headers() {
    const e = env();
    return { 'x-app-id': e.NUTRITIONIX_APP_ID ?? '', 'x-app-key': e.NUTRITIONIX_API_KEY ?? '', 'x-remote-user-id': '0' };
  }

  async search(query: string, opts: ProviderSearchOptions): Promise<ProviderSearchPage> {
    // Instant search is not paginated; it returns a bounded result set on page 1.
    if (opts.page > 1) return { items: [], total: null, hasMore: false };
    const u = new URL(`${BASE}/search/instant`);
    u.searchParams.set('query', query);
    u.searchParams.set('detailed', 'true');
    u.searchParams.set('branded', String(opts.type !== 'generic'));
    u.searchParams.set('common', String(opts.type !== 'branded'));
    const raw = await fetchJson(u.toString(), { headers: this.headers(), timeoutMs: env().PROVIDER_TIMEOUT_MS, signal: opts.signal });
    const parsed = instantResponse.safeParse(raw);
    if (!parsed.success) throw new UpstreamError('Unexpected Nutritionix search response', 200, false);
    const items = [...parsed.data.branded.map((f) => mapFood(f, true)), ...parsed.data.common.map((f) => mapFood(f, false))];
    return { items: items.slice(0, opts.pageSize * 2), total: items.length, hasMore: false };
  }

  async getFood(foodId: string, signal?: AbortSignal): Promise<FoodItem | null> {
    const [kind, value] = [foodId.slice(0, foodId.indexOf(':')), foodId.slice(foodId.indexOf(':') + 1)];
    if (kind === 'item' && /^[a-f\d]{6,40}$/i.test(value)) {
      const raw = await fetchJson(`${BASE}/search/item?nix_item_id=${encodeURIComponent(value)}`, { headers: this.headers(), timeoutMs: env().PROVIDER_TIMEOUT_MS, signal });
      const parsed = foodsResponse.safeParse(raw);
      const f = parsed.success ? parsed.data.foods[0] : undefined;
      return f ? mapFood(f, true) : null;
    }
    if (kind === 'common' && value.length > 0 && value.length <= 100) {
      const raw = await fetchJson(`${BASE}/natural/nutrients`, {
        method: 'POST',
        body: { query: `1 ${value}` },
        headers: this.headers(),
        timeoutMs: env().PROVIDER_TIMEOUT_MS,
        signal,
        retries: 0,
      });
      const parsed = foodsResponse.safeParse(raw);
      const f = parsed.success ? parsed.data.foods[0] : undefined;
      return f ? { ...mapFood(f, true), providerFoodId: foodId } : null;
    }
    return null;
  }

  async lookupBarcode(barcode: string, signal?: AbortSignal): Promise<FoodItem | null> {
    const raw = await fetchJson(`${BASE}/search/item?upc=${encodeURIComponent(barcode)}`, { headers: this.headers(), timeoutMs: env().PROVIDER_TIMEOUT_MS, signal });
    if (raw === null) return null;
    const parsed = foodsResponse.safeParse(raw);
    const f = parsed.success ? parsed.data.foods[0] : undefined;
    return f ? mapFood(f, true) : null;
  }
}

export const __test = { mapFood };
