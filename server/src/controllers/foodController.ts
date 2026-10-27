import type { Request, Response } from 'express';
import type { CustomFoodInput, FoodRef, SearchQuery } from '@nutritrack/shared';
import * as foods from '../services/foodService';
import { valid } from '../middleware/validate';

const uid = (req: Request) => req.auth!.userId;

/** Aborts provider calls when the browser cancels a stale search request. */
function abortOnClose(req: Request, res: Response) {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
}

export async function search(req: Request, res: Response) {
  const query = valid<SearchQuery>(req, 'query');
  const result = await foods.searchFoods(query, abortOnClose(req, res));
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.json({ data: { items: result.items, provider: result.provider, warnings: result.warnings }, meta: result.meta });
}

export async function getFood(req: Request, res: Response) {
  const { provider, foodId } = valid<{ provider: FoodRef['provider']; foodId: string }>(req, 'params');
  const food = provider === 'custom' || provider === 'recipe'
    ? await foods.resolveFood(uid(req), { provider, foodId })
    : await foods.getExternalFood(provider, foodId, abortOnClose(req, res));
  res.json({ data: food });
}

export async function barcode(req: Request, res: Response) {
  res.json({ data: await foods.lookupBarcode(valid<{ barcode: string }>(req, 'params').barcode, abortOnClose(req, res)) });
}

export async function listCustom(req: Request, res: Response) {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : undefined;
  res.json({ data: await foods.listCustomFoods(uid(req), q) });
}

export async function createCustom(req: Request, res: Response) {
  res.status(201).json({ data: await foods.createCustomFood(uid(req), valid<CustomFoodInput>(req, 'body')) });
}

export async function updateCustom(req: Request, res: Response) {
  res.json({ data: await foods.updateCustomFood(uid(req), valid<{ foodId: string }>(req, 'params').foodId, valid(req, 'body')) });
}

export async function deleteCustom(req: Request, res: Response) {
  await foods.deleteCustomFood(uid(req), valid<{ foodId: string }>(req, 'params').foodId);
  res.status(204).end();
}

export async function recent(req: Request, res: Response) {
  res.json({ data: await foods.recentFoods(uid(req)) });
}

export async function history(req: Request, res: Response) {
  res.json({ data: await foods.listSearchHistory(uid(req)) });
}

export async function addHistory(req: Request, res: Response) {
  await foods.recordSearch(uid(req), valid<{ query: string }>(req, 'body').query);
  res.status(204).end();
}

export async function clearHistory(req: Request, res: Response) {
  await foods.clearSearchHistory(uid(req));
  res.status(204).end();
}

export async function listFavorites(req: Request, res: Response) {
  res.json({ data: await foods.listFavorites(uid(req)) });
}

export async function addFavorite(req: Request, res: Response) {
  res.status(201).json({ data: await foods.addFavorite(uid(req), valid<{ food: FoodRef }>(req, 'body').food) });
}

export async function removeFavorite(req: Request, res: Response) {
  await foods.removeFavorite(uid(req), valid<{ favoriteId: string }>(req, 'params').favoriteId);
  res.status(204).end();
}
