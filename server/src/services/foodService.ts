import { Types } from 'mongoose';
import {
  nutrientCompleteness, type CustomFoodInput, type FoodItem, type FoodRef, type PageMeta, type SearchQuery,
  type SearchableProviderId, type ServingOption,
} from '@nutritrack/shared';
import { CustomFood, Favorite, FoodCache, FoodLog, Recipe, SavedMeal, SearchHistory } from '../models';
import { configuredProviders, getProvider } from '../providers/nutrition/registry';
import type { NutritionProvider, ProviderSearchPage } from '../providers/nutrition/types';
import { AppError, notFound, providerUnavailable } from '../utils/errors';
import { UpstreamError } from '../utils/http';
import { TtlCache } from '../utils/ttlCache';
import { logger } from '../config/logger';
import { toCustomFood, toFoodItem, toNutrients, toSnapshot, iso } from './serializers';

/** Public, non-personal provider responses only. */
const searchCache = new TtlCache<ProviderSearchPage>(500, 10 * 60_000);
const foodCacheKey = (provider: string, id: string) => `${provider}:${id}`;

export function normalizeQuery(q: string): string {
  return q.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function dedupe(items: FoodItem[]): FoodItem[] {
  const seen = new Set<string>();
  return items.filter((f) => {
    // Same provider id, or identical name + brand + barcode, is the same product.
    // Different brands are never merged.
    const keys = [`id:${f.provider}:${f.providerFoodId}`, `sig:${f.name.toLowerCase()}|${(f.brand ?? '').toLowerCase()}|${f.barcode ?? ''}`];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
}

async function cacheFoods(items: FoodItem[], overwrite: boolean) {
  if (items.length === 0) return;
  try {
    await FoodCache.bulkWrite(
      items.map((food) => ({
        updateOne: {
          filter: { key: foodCacheKey(food.provider, food.providerFoodId) },
          update: overwrite
            ? { $set: { food: toSnapshot(food), cachedAt: new Date() } }
            : { $setOnInsert: { food: toSnapshot(food), cachedAt: new Date() } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  } catch (err) {
    logger().warn({ err: err instanceof Error ? err.message : err }, 'Food cache write failed');
  }
}

async function searchWith(provider: NutritionProvider, q: string, query: SearchQuery, signal?: AbortSignal) {
  const key = [provider.id, query.type, query.page, query.pageSize, q].join('|');
  const cached = searchCache.get(key);
  if (cached) return cached;
  const page = await provider.search(q, { page: query.page, pageSize: query.pageSize, type: query.type, signal });
  page.items = dedupe(page.items);
  searchCache.set(key, page);
  void cacheFoods(page.items, false);
  return page;
}

export async function searchFoods(query: SearchQuery, signal?: AbortSignal): Promise<{ items: FoodItem[]; provider: SearchableProviderId; warnings: string[]; meta: PageMeta }> {
  const q = normalizeQuery(query.q);
  let chain: NutritionProvider[];
  if (query.source === 'auto') {
    chain = configuredProviders();
  } else {
    const p = getProvider(query.source);
    if (!p || !p.isConfigured()) throw new AppError(400, 'PROVIDER_NOT_CONFIGURED', 'That food database is not configured on this server.');
    chain = [p];
  }
  if (chain.length === 0) throw new AppError(503, 'PROVIDER_NOT_CONFIGURED', 'No nutrition database is configured. Add API credentials on the server or create a custom food.');

  const warnings: string[] = [];
  for (const provider of chain) {
    try {
      const page = await searchWith(provider, q, query, signal);
      return {
        items: page.items,
        provider: provider.id,
        warnings,
        meta: { page: query.page, pageSize: query.pageSize, total: page.total, hasMore: page.hasMore },
      };
    } catch (err) {
      if (!(err instanceof UpstreamError)) throw err;
      logger().warn({ provider: provider.id, status: err.status }, 'Food search provider failed');
      warnings.push(`${provider.label} is unavailable right now${err.status === 429 ? ' (rate limit reached)' : ''}.`);
    }
  }
  throw providerUnavailable(`${warnings.join(' ')} Please retry in a moment, or add a custom food.`);
}

/** Detail lookup for external providers, using the shared cache when it holds a detailed record. */
export async function getExternalFood(providerId: string, foodId: string, signal?: AbortSignal): Promise<FoodItem> {
  const cached = await FoodCache.findOne({ key: foodCacheKey(providerId, foodId) }).lean();
  if (cached?.food?.detailed) return toFoodItem(cached.food);
  const provider = getProvider(providerId);
  if (!provider || !provider.isConfigured()) {
    if (cached) return toFoodItem(cached.food);
    throw new AppError(400, 'PROVIDER_NOT_CONFIGURED', 'That food database is not configured on this server.');
  }
  try {
    const food = await provider.getFood(foodId, signal);
    if (!food) throw notFound('Food');
    await cacheFoods([food], true);
    return food;
  } catch (err) {
    if (err instanceof UpstreamError && cached) return toFoodItem(cached.food); // degrade to the search-level record
    if (err instanceof UpstreamError) throw providerUnavailable(`${provider.label} is unavailable right now. Please retry.`);
    throw err;
  }
}

export async function lookupBarcode(barcode: string, signal?: AbortSignal): Promise<FoodItem> {
  const chain = configuredProviders().filter((p) => p.supportsBarcode && p.lookupBarcode);
  if (chain.length === 0) throw new AppError(503, 'PROVIDER_NOT_CONFIGURED', 'No barcode-capable food database is configured.');
  let failures = 0;
  for (const provider of chain) {
    try {
      const food = await provider.lookupBarcode!(barcode, signal);
      if (food) {
        await cacheFoods([food], true);
        return food;
      }
    } catch (err) {
      if (!(err instanceof UpstreamError)) throw err;
      failures += 1;
    }
  }
  if (failures === chain.length) throw providerUnavailable('Barcode lookup is unavailable right now. Please retry.');
  throw new AppError(404, 'NOT_FOUND', `No product was found for barcode ${barcode}. You can search by name or create a custom food.`);
}

/* --------------------------------- custom foods --------------------------------- */

export function customFoodToItem(doc: Parameters<typeof toCustomFood>[0]): FoodItem {
  const c = toCustomFood(doc);
  const servings: ServingOption[] = [{ id: 'label', label: `1 ${c.servingLabel}${c.servingGrams ? ` – ${c.servingGrams} g` : ''}`, grams: c.servingGrams, isBasisServing: true }];
  if (c.servingGrams) servings.push({ id: '1g', label: '1 g', grams: 1 }, { id: '100g', label: '100 g', grams: 100 });
  return {
    provider: 'custom',
    providerFoodId: c.id,
    name: c.name,
    brand: c.brand,
    barcode: null,
    imageUrl: null,
    category: 'Custom food',
    kind: 'custom',
    basis: { type: 'perServing', servingGrams: c.servingGrams },
    nutrients: c.nutrients,
    servings,
    defaultServingId: 'label',
    completeness: nutrientCompleteness(c.nutrients),
    detailed: true,
    ingredientsText: null,
    allergens: null,
    attribution: 'Manually entered by you',
    sourceUrl: null,
    fetchedAt: c.updatedAt,
  };
}

export function recipeToItem(doc: { _id: unknown; name: string; perPortion: unknown; gramsPerPortion?: number | null; portions: number; updatedAt?: Date }): FoodItem {
  const gramsPerPortion = doc.gramsPerPortion ?? null;
  const servings: ServingOption[] = [{ id: 'portion', label: `1 portion${gramsPerPortion ? ` – ${Math.round(gramsPerPortion)} g` : ''}`, grams: gramsPerPortion, isBasisServing: true }];
  if (gramsPerPortion) servings.push({ id: '1g', label: '1 g', grams: 1 }, { id: '100g', label: '100 g', grams: 100 });
  const nutrients = toNutrients(doc.perPortion);
  return {
    provider: 'recipe',
    providerFoodId: String(doc._id),
    name: doc.name,
    brand: null,
    barcode: null,
    imageUrl: null,
    category: `Recipe · ${doc.portions} portions`,
    kind: 'recipe',
    basis: { type: 'perServing', servingGrams: gramsPerPortion },
    nutrients,
    servings,
    defaultServingId: 'portion',
    completeness: nutrientCompleteness(nutrients),
    detailed: true,
    ingredientsText: null,
    allergens: null,
    attribution: 'Your recipe (calculated from its ingredients)',
    sourceUrl: null,
    fetchedAt: iso(doc.updatedAt),
  };
}

export async function listCustomFoods(userId: string, search?: string) {
  const filter: Record<string, unknown> = { userId };
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
  const docs = await CustomFood.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
  return docs.map(toCustomFood);
}

export async function createCustomFood(userId: string, input: CustomFoodInput) {
  const doc = await CustomFood.create({ ...input, userId });
  return toCustomFood(doc.toObject());
}

export async function updateCustomFood(userId: string, id: string, input: Partial<CustomFoodInput>) {
  const doc = await CustomFood.findOneAndUpdate({ _id: id, userId }, { $set: input }, { returnDocument: 'after', runValidators: true }).lean();
  if (!doc) throw notFound('Custom food');
  return toCustomFood(doc);
}

export async function deleteCustomFood(userId: string, id: string) {
  const result = await CustomFood.deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) throw notFound('Custom food');
  await Favorite.deleteMany({ userId, provider: 'custom', providerFoodId: id });
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves a food reference into a trusted FoodItem for logging. Nutrition
 * values always come from the server (provider/cache/owned records), never
 * from the client. Ownership is enforced for custom foods and recipes.
 */
export async function resolveFood(userId: string, ref: FoodRef, signal?: AbortSignal): Promise<FoodItem> {
  if (ref.provider === 'custom') {
    if (!Types.ObjectId.isValid(ref.foodId)) throw notFound('Custom food');
    const doc = await CustomFood.findOne({ _id: ref.foodId, userId }).lean();
    if (!doc) throw notFound('Custom food');
    return customFoodToItem(doc);
  }
  if (ref.provider === 'recipe') {
    if (!Types.ObjectId.isValid(ref.foodId)) throw notFound('Recipe');
    const doc = await Recipe.findOne({ _id: ref.foodId, userId }).lean();
    if (!doc) throw notFound('Recipe');
    return recipeToItem(doc);
  }
  const cached = await FoodCache.findOne({ key: foodCacheKey(ref.provider, ref.foodId) }).lean();
  if (cached) return toFoodItem(cached.food);
  try {
    return await getExternalFood(ref.provider, ref.foodId, signal);
  } catch (err) {
    // Provider down or record gone: fall back to the user's own saved snapshots
    // (favorites, diary history, saved meals, recipes).
    const fav = await Favorite.findOne({ userId, provider: ref.provider, providerFoodId: ref.foodId }).lean();
    if (fav) return toFoodItem(fav.food);
    const last = await FoodLog.findOne({ userId, 'food.provider': ref.provider, 'food.providerFoodId': ref.foodId }).sort({ createdAt: -1 }).lean();
    if (last) return toFoodItem(last.food);
    const match = { 'food.provider': ref.provider, 'food.providerFoodId': ref.foodId };
    const meal = await SavedMeal.findOne({ userId, items: { $elemMatch: match } }).lean();
    const fromMeal = meal?.items.find((i) => i.food.provider === ref.provider && i.food.providerFoodId === ref.foodId);
    if (fromMeal) return toFoodItem(fromMeal.food);
    const recipe = await Recipe.findOne({ userId, ingredients: { $elemMatch: match } }).lean();
    const fromRecipe = recipe?.ingredients.find((i) => i.food.provider === ref.provider && i.food.providerFoodId === ref.foodId);
    if (fromRecipe) return toFoodItem(fromRecipe.food);
    throw err;
  }
}

/* -------------------------------- search history -------------------------------- */

export async function recordSearch(userId: string, query: string) {
  const q = normalizeQuery(query);
  if (q.length < 2) return;
  await SearchHistory.updateOne({ userId, query: q }, { $set: { lastUsedAt: new Date() } }, { upsert: true });
  const stale = await SearchHistory.find({ userId }).sort({ lastUsedAt: -1 }).skip(15).select('_id').lean();
  if (stale.length) await SearchHistory.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
}

export async function listSearchHistory(userId: string) {
  const docs = await SearchHistory.find({ userId }).sort({ lastUsedAt: -1 }).limit(15).lean();
  return docs.map((d) => ({ query: d.query, lastUsedAt: iso(d.lastUsedAt) }));
}

export async function clearSearchHistory(userId: string) {
  await SearchHistory.deleteMany({ userId });
}

/* -------------------------------- recent & favorites ------------------------------ */

export async function recentFoods(userId: string, limit = 20) {
  const rows = await FoodLog.aggregate([
    { $match: { userId: new Types.ObjectId(userId) } },
    { $sort: { createdAt: -1 } },
    { $limit: 500 },
    {
      $group: {
        _id: { p: '$food.provider', id: '$food.providerFoodId' },
        food: { $first: '$food' },
        lastServingId: { $first: '$servingId' },
        lastQuantity: { $first: '$quantity' },
        lastMeal: { $first: '$meal' },
        lastLoggedAt: { $first: '$createdAt' },
        timesLogged: { $sum: 1 },
      },
    },
    { $sort: { lastLoggedAt: -1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => ({
    food: toFoodItem(r.food),
    lastServingId: r.lastServingId,
    lastQuantity: r.lastQuantity,
    lastMeal: r.lastMeal,
    lastLoggedAt: iso(r.lastLoggedAt),
    timesLogged: r.timesLogged,
  }));
}

export async function listFavorites(userId: string) {
  const docs = await Favorite.find({ userId }).sort({ createdAt: -1 }).limit(200).lean();
  return docs.map((d) => ({ id: String(d._id), food: toFoodItem(d.food), createdAt: iso(d.createdAt) }));
}

export async function addFavorite(userId: string, ref: FoodRef) {
  const food = await resolveFood(userId, ref);
  const doc = await Favorite.findOneAndUpdate(
    { userId, provider: food.provider, providerFoodId: food.providerFoodId },
    { $setOnInsert: { food: toSnapshot(food) } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  return { id: String(doc._id), food: toFoodItem(doc.food), createdAt: iso(doc.createdAt) };
}

export async function removeFavorite(userId: string, favoriteId: string) {
  const result = await Favorite.deleteOne({ _id: favoriteId, userId });
  if (result.deletedCount === 0) throw notFound('Favorite');
}
