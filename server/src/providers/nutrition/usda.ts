import { z } from 'zod';
import { emptyNutrients, type FoodItem, type NutrientValues, type ServingOption } from '@nutritrack/shared';
import { env } from '../../config/env';
import { fetchJson, UpstreamError } from '../../utils/http';
import { finalizeFood, gramOptions, num, round, str, titleCase } from './normalize';
import type { NutritionProvider, ProviderSearchOptions, ProviderSearchPage } from './types';

/**
 * USDA FoodData Central (https://fdc.nal.usda.gov/api-guide).
 * Search/detail nutrient values for all data types are per 100 g (or 100 ml
 * for branded liquids). Branded foods carry a label serving size; generic
 * foods carry food-specific portion gram weights in the detail endpoint only.
 */
const BASE = 'https://api.nal.usda.gov/fdc/v1';
const ATTRIBUTION = 'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.';

// FDC nutrient ids (with legacy nutrient numbers as fallback).
const NUTRIENT_IDS: Record<keyof NutrientValues, { ids: number[]; numbers: string[] }> = {
  calories: { ids: [1008, 2047, 2048], numbers: ['208', '957', '958'] },
  protein: { ids: [1003], numbers: ['203'] },
  carbs: { ids: [1005, 1050], numbers: ['205', '205.2'] },
  fat: { ids: [1004, 1085], numbers: ['204', '298'] },
  saturatedFat: { ids: [1258], numbers: ['606'] },
  fiber: { ids: [1079], numbers: ['291'] },
  sugars: { ids: [2000, 1063], numbers: ['269', '269.3'] },
  sodium: { ids: [1093], numbers: ['307'] },
};

const searchNutrient = z.object({
  nutrientId: z.number().optional(),
  nutrientNumber: z.string().optional(),
  unitName: z.string().optional(),
  value: z.number().optional(),
});
const detailNutrient = z.object({
  nutrient: z.object({ id: z.number().optional(), number: z.string().optional(), unitName: z.string().optional() }).optional(),
  amount: z.number().optional(),
});
const searchFood = z.object({
  fdcId: z.number(),
  description: z.string(),
  dataType: z.string().optional(),
  brandOwner: z.string().optional(),
  brandName: z.string().optional(),
  gtinUpc: z.string().optional(),
  foodCategory: z.string().optional(),
  ingredients: z.string().optional(),
  servingSize: z.number().optional(),
  servingSizeUnit: z.string().optional(),
  householdServingFullText: z.string().optional(),
  foodNutrients: z.array(searchNutrient).default([]),
});
const searchResponse = z.object({ totalHits: z.number().default(0), currentPage: z.number().default(1), totalPages: z.number().default(0), foods: z.array(searchFood).default([]) });
const portion = z.object({
  gramWeight: z.number().optional(),
  amount: z.number().optional(),
  modifier: z.string().optional(),
  portionDescription: z.string().optional(),
  measureUnit: z.object({ name: z.string().optional() }).optional(),
});
const detailFood = searchFood.omit({ foodNutrients: true }).extend({
  foodNutrients: z.array(detailNutrient).default([]),
  brandedFoodCategory: z.string().optional(),
  foodCategory: z.union([z.string(), z.object({ description: z.string().optional() })]).optional(),
  foodPortions: z.array(portion).default([]),
});

type RawNutrient = { id?: number; number?: string; unit?: string; value?: number };

function mapNutrients(raw: RawNutrient[]): NutrientValues {
  const out = emptyNutrients();
  for (const key of Object.keys(NUTRIENT_IDS) as (keyof NutrientValues)[]) {
    const spec = NUTRIENT_IDS[key];
    // Prefer ids in declared order (e.g. Energy 1008 before Atwater 2047/2048).
    for (let i = 0; i < spec.ids.length; i++) {
      const hit = raw.find((n) => n.id === spec.ids[i] || n.number === spec.numbers[i]);
      if (!hit) continue;
      if (key === 'calories' && hit.unit && hit.unit.toUpperCase() !== 'KCAL') continue;
      const v = num(hit.value);
      if (v !== null) {
        out[key] = v;
        break;
      }
    }
  }
  return out;
}

function isLiquidUnit(unit?: string) {
  return !!unit && /^(ml|mlt)$/i.test(unit);
}

function portionLabel(p: z.infer<typeof portion>): string | null {
  const amount = p.amount && p.amount > 0 ? p.amount : 1;
  if (p.portionDescription && !/quantity not specified/i.test(p.portionDescription)) return p.portionDescription;
  const unit = p.measureUnit?.name && p.measureUnit.name !== 'undetermined' ? p.measureUnit.name : '';
  const text = [amount, unit, p.modifier].filter(Boolean).join(' ').trim();
  return text || null;
}

function buildFood(
  f: z.infer<typeof searchFood> | z.infer<typeof detailFood>,
  nutrients: NutrientValues,
  portions: z.infer<typeof portion>[],
  detailed: boolean,
): FoodItem {
  const branded = f.dataType === 'Branded';
  const liquid = isLiquidUnit(f.servingSizeUnit);
  const unit = liquid ? 'ml' : 'g';
  const servings: ServingOption[] = [];
  const servingSize = num(f.servingSize);
  if (branded && servingSize && servingSize > 0 && (liquid || /^(g|grm)$/i.test(f.servingSizeUnit ?? ''))) {
    const household = str(f.householdServingFullText, 40);
    servings.push({ id: 'label', label: `1 serving${household ? ` (${household.toLowerCase()})` : ''} – ${round(servingSize, 1)} ${unit}`, grams: servingSize });
  }
  portions.forEach((p, i) => {
    const grams = num(p.gramWeight);
    const label = portionLabel(p);
    if (grams && grams > 0 && label) servings.push({ id: `portion-${i}`, label: `${label} – ${round(grams, 1)} g`, grams });
  });
  servings.push(...gramOptions(unit));
  const category = typeof f.foodCategory === 'string' ? f.foodCategory : (f.foodCategory?.description ?? ('brandedFoodCategory' in f ? f.brandedFoodCategory : undefined));
  const brand = str(f.brandName) ?? str(f.brandOwner);
  return finalizeFood({
    provider: 'usda',
    providerFoodId: String(f.fdcId),
    name: titleCase(str(f.description) ?? 'Unnamed food'),
    brand: brand ? titleCase(brand) : null,
    barcode: str(f.gtinUpc, 20),
    imageUrl: null,
    category: str(category) ?? str(f.dataType),
    kind: branded ? 'branded' : 'generic',
    basis: liquid ? { type: 'per100ml' } : { type: 'per100g' },
    nutrients,
    servings,
    defaultServingId: servings[0]!.id,
    detailed,
    ingredientsText: str(f.ingredients, 2000),
    allergens: null, // FDC does not publish allergen tags
    attribution: ATTRIBUTION,
    sourceUrl: `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`,
  });
}

const DATA_TYPES = {
  all: 'Branded,Foundation,SR Legacy,Survey (FNDDS)',
  branded: 'Branded',
  generic: 'Foundation,SR Legacy,Survey (FNDDS)',
} as const;

export class UsdaProvider implements NutritionProvider {
  readonly id = 'usda' as const;
  readonly label = 'USDA FoodData Central';
  readonly supportsBarcode = true;

  isConfigured() {
    return Boolean(env().USDA_API_KEY);
  }

  private url(path: string, params: Record<string, string | number>) {
    const u = new URL(`${BASE}${path}`);
    u.searchParams.set('api_key', env().USDA_API_KEY ?? '');
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    return u.toString();
  }

  async search(query: string, opts: ProviderSearchOptions): Promise<ProviderSearchPage> {
    const raw = await fetchJson(this.url('/foods/search', { query, pageSize: opts.pageSize, pageNumber: opts.page, dataType: DATA_TYPES[opts.type] }), {
      timeoutMs: env().PROVIDER_TIMEOUT_MS,
      signal: opts.signal,
    });
    const parsed = searchResponse.safeParse(raw);
    if (!parsed.success) throw new UpstreamError('Unexpected USDA search response', 200, false);
    const items = parsed.data.foods.map((f) =>
      buildFood(f, mapNutrients(f.foodNutrients.map((n) => ({ id: n.nutrientId, number: n.nutrientNumber, unit: n.unitName, value: n.value }))), [], f.dataType === 'Branded'),
    );
    return { items, total: parsed.data.totalHits, hasMore: parsed.data.currentPage < parsed.data.totalPages };
  }

  async getFood(foodId: string, signal?: AbortSignal): Promise<FoodItem | null> {
    if (!/^\d{1,10}$/.test(foodId)) return null;
    const raw = await fetchJson(this.url(`/food/${foodId}`, {}), { timeoutMs: env().PROVIDER_TIMEOUT_MS, signal });
    if (raw === null) return null;
    const parsed = detailFood.safeParse(raw);
    if (!parsed.success) throw new UpstreamError('Unexpected USDA food response', 200, false);
    const f = parsed.data;
    const nutrients = mapNutrients(f.foodNutrients.map((n) => ({ id: n.nutrient?.id, number: n.nutrient?.number, unit: n.nutrient?.unitName, value: n.amount })));
    return buildFood(f, nutrients, f.foodPortions, true);
  }

  async lookupBarcode(barcode: string, signal?: AbortSignal): Promise<FoodItem | null> {
    const page = await this.search(barcode, { page: 1, pageSize: 5, type: 'branded', signal });
    const normalized = barcode.replace(/^0+/, '');
    return page.items.find((i) => i.barcode && i.barcode.replace(/^0+/, '') === normalized) ?? null;
  }
}

export const __test = { mapNutrients, buildFood, searchResponse, detailFood };
