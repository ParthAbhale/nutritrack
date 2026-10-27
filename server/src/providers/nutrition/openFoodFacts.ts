import { z } from 'zod';
import { emptyNutrients, type FoodItem, type ServingOption } from '@nutritrack/shared';
import { env } from '../../config/env';
import { fetchJson, UpstreamError } from '../../utils/http';
import { finalizeFood, gramOptions, num, round, safeImageUrl, str } from './normalize';
import type { NutritionProvider, ProviderSearchOptions, ProviderSearchPage } from './types';

/**
 * Open Food Facts (https://openfoodfacts.github.io/openfoodfacts-server/api/).
 * Data is under the Open Database License (ODbL); attribution is required.
 * Product reads allow ~100 req/min and search ~10 req/min, so search is only
 * used on explicit, debounced, cached queries (never per keystroke) and is
 * additionally throttled here. Every request sends an identifying User-Agent.
 * Full-text search uses the search-a-licious service at search.openfoodfacts.org.
 */
const PRODUCT_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const SEARCH_BASE = 'https://search.openfoodfacts.org/search';
const ATTRIBUTION = 'Open Food Facts contributors (openfoodfacts.org), ODbL';
const IMAGE_HOSTS = ['images.openfoodfacts.org', 'static.openfoodfacts.org'];
const FIELDS = [
  'code', 'product_name', 'product_name_en', 'brands', 'image_front_small_url', 'serving_size', 'serving_quantity',
  'serving_quantity_unit', 'nutriments', 'nutrition_data_per', 'allergens_tags', 'ingredients_text', 'ingredients_text_en',
  'categories_tags', 'product_quantity_unit', 'quantity',
].join(',');

const nutriments = z.record(z.string(), z.unknown());
const product = z.object({
  code: z.string(),
  product_name: z.string().optional(),
  product_name_en: z.string().optional(),
  brands: z.union([z.string(), z.array(z.string())]).optional(),
  image_front_small_url: z.string().optional(),
  serving_size: z.string().optional(),
  serving_quantity: z.union([z.number(), z.string()]).optional(),
  serving_quantity_unit: z.string().optional(),
  nutriments: nutriments.optional(),
  allergens_tags: z.array(z.string()).optional(),
  ingredients_text: z.string().optional(),
  ingredients_text_en: z.string().optional(),
  categories_tags: z.array(z.string()).optional(),
  product_quantity_unit: z.string().optional(),
});
const searchResponse = z.object({ hits: z.array(z.unknown()).default([]), count: z.number().optional(), page: z.number().optional(), page_count: z.number().optional() });
const productResponse = z.object({ status: z.number().optional(), product: z.unknown().optional() });

/** Simple sliding-window throttle shared by this process (search: 10/min). */
class Throttle {
  private stamps: number[] = [];
  constructor(private readonly limit: number, private readonly windowMs: number) {}
  take(): boolean {
    const now = Date.now();
    this.stamps = this.stamps.filter((t) => now - t < this.windowMs);
    if (this.stamps.length >= this.limit) return false;
    this.stamps.push(now);
    return true;
  }
}

function mapProduct(raw: unknown): FoodItem | null {
  const parsed = product.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const name = str(p.product_name_en) ?? str(p.product_name);
  if (!name) return null;
  const n = p.nutriments ?? {};
  const liquid = (p.product_quantity_unit ?? '').toLowerCase() === 'ml';
  const unit = liquid ? 'ml' : 'g';
  // OFF normalizes to *_100g; sodium is reported in grams, converted to mg.
  const sodiumG = num(n['sodium_100g']);
  let calories = num(n['energy-kcal_100g']);
  if (calories === null) {
    const kj = num(n['energy-kj_100g']);
    calories = kj === null ? null : kj / 4.184;
  }
  const nutrients = {
    ...emptyNutrients(),
    calories,
    protein: num(n['proteins_100g']),
    carbs: num(n['carbohydrates_100g']),
    fat: num(n['fat_100g']),
    saturatedFat: num(n['saturated-fat_100g']),
    fiber: num(n['fiber_100g']),
    sugars: num(n['sugars_100g']),
    sodium: sodiumG === null ? null : sodiumG * 1000,
  };
  const servings: ServingOption[] = [];
  const servingQty = num(p.serving_quantity);
  const servingUnit = (p.serving_quantity_unit ?? unit).toLowerCase();
  if (servingQty && servingQty > 0 && (servingUnit === 'g' || servingUnit === 'ml')) {
    const label = str(p.serving_size, 40);
    servings.push({ id: 'label', label: `1 serving${label ? ` (${label})` : ''} – ${round(servingQty, 1)} ${servingUnit}`, grams: servingQty });
  }
  servings.push(...gramOptions(unit));
  const brands = Array.isArray(p.brands) ? p.brands : (p.brands ?? '').split(',');
  const brand = str(brands.map((b) => b.trim()).filter(Boolean)[0]);
  const category = p.categories_tags?.at(-1)?.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ') ?? null;
  return finalizeFood({
    provider: 'openfoodfacts',
    providerFoodId: p.code,
    name,
    brand,
    barcode: /^\d{6,14}$/.test(p.code) ? p.code : null,
    imageUrl: safeImageUrl(p.image_front_small_url, IMAGE_HOSTS),
    category: str(category),
    kind: 'branded',
    basis: liquid ? { type: 'per100ml' } : { type: 'per100g' },
    nutrients,
    servings,
    defaultServingId: servings[0]!.id,
    detailed: true,
    ingredientsText: str(p.ingredients_text_en ?? p.ingredients_text, 2000),
    // allergens_tags present (even empty) means the product page declares allergens.
    allergens: p.allergens_tags ? p.allergens_tags.map((t) => t.replace(/^[a-z]{2}:/, '')) : null,
    attribution: ATTRIBUTION,
    sourceUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(p.code)}`,
  });
}

export class OpenFoodFactsProvider implements NutritionProvider {
  readonly id = 'openfoodfacts' as const;
  readonly label = 'Open Food Facts';
  readonly supportsBarcode = true;
  private searchThrottle = new Throttle(10, 60_000);
  private productThrottle = new Throttle(90, 60_000);

  isConfigured() {
    return env().OPEN_FOOD_FACTS_ENABLED;
  }

  private headers() {
    return { 'User-Agent': env().OPEN_FOOD_FACTS_USER_AGENT };
  }

  async search(query: string, opts: ProviderSearchOptions): Promise<ProviderSearchPage> {
    if (opts.type === 'generic') return { items: [], total: 0, hasMore: false }; // OFF only holds packaged products
    if (!this.searchThrottle.take()) throw new UpstreamError('Open Food Facts search rate limit reached', 429, false);
    const u = new URL(SEARCH_BASE);
    u.searchParams.set('q', query);
    u.searchParams.set('page', String(opts.page));
    u.searchParams.set('page_size', String(opts.pageSize));
    u.searchParams.set('fields', FIELDS);
    const raw = await fetchJson(u.toString(), { headers: this.headers(), timeoutMs: env().PROVIDER_TIMEOUT_MS, signal: opts.signal, retries: 0 });
    const parsed = searchResponse.safeParse(raw);
    if (!parsed.success) throw new UpstreamError('Unexpected Open Food Facts search response', 200, false);
    const items = parsed.data.hits.map(mapProduct).filter((f): f is FoodItem => f !== null);
    const pageCount = parsed.data.page_count ?? 0;
    return { items, total: parsed.data.count ?? null, hasMore: (parsed.data.page ?? opts.page) < pageCount };
  }

  async getFood(foodId: string, signal?: AbortSignal): Promise<FoodItem | null> {
    if (!/^[\w-]{1,30}$/.test(foodId)) return null;
    if (!this.productThrottle.take()) throw new UpstreamError('Open Food Facts rate limit reached', 429, false);
    const raw = await fetchJson(`${PRODUCT_BASE}/${encodeURIComponent(foodId)}.json?fields=${FIELDS}`, {
      headers: this.headers(),
      timeoutMs: env().PROVIDER_TIMEOUT_MS,
      signal,
    });
    if (raw === null) return null;
    const parsed = productResponse.safeParse(raw);
    if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) return null;
    return mapProduct(parsed.data.product);
  }

  lookupBarcode(barcode: string, signal?: AbortSignal) {
    return this.getFood(barcode, signal);
  }
}

export const __test = { mapProduct };
