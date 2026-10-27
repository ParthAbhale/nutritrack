import { recipeNutrition, sumNutrients, type Meal, type Recipe as RecipeDto, type SavedMeal as SavedMealDto } from '@nutritrack/shared';
import { Recipe, SavedMeal } from '../models';
import { badRequest, notFound } from '../utils/errors';
import { resolveFood } from './foodService';
import { computeEntry, logTemplateItems } from './diaryService';
import { iso, toFoodItem, toSnapshot, toTemplateItem, toNutrients } from './serializers';
import { recordActivity } from './activityService';

type ItemInput = { food: { provider: string; foodId: string }; servingId: string; quantity: number };

/** Resolves and computes template items server-side (nutrition never comes from the client). */
async function buildItems(userId: string, items: ItemInput[], forbidRecipe = false) {
  return Promise.all(
    items.map(async (item) => {
      if (forbidRecipe && item.food.provider === 'recipe') throw badRequest('Recipes cannot contain other recipes');
      const food = await resolveFood(userId, item.food as never);
      const computed = computeEntry(food, item.servingId, item.quantity);
      return { food: toSnapshot(food), servingId: computed.servingId, servingLabel: computed.servingLabel, quantity: computed.quantity, grams: computed.consumedGrams, nutrients: computed.nutrients };
    }),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSavedMeal(d: any): SavedMealDto {
  const items = d.items.map(toTemplateItem);
  return { id: String(d._id), name: d.name, items, totals: sumNutrients(items.map((i: { nutrients: never }) => i.nutrients)), createdAt: iso(d.createdAt), updatedAt: iso(d.updatedAt) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecipe(d: any): RecipeDto {
  const ingredients = d.ingredients.map(toTemplateItem);
  return {
    id: String(d._id),
    name: d.name,
    portions: d.portions,
    notes: d.notes ?? null,
    ingredients,
    totals: sumNutrients(ingredients.map((i: { nutrients: never }) => i.nutrients)),
    perPortion: toNutrients(d.perPortion),
    gramsPerPortion: d.gramsPerPortion ?? null,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

/* --------------------------------- saved meals --------------------------------- */

export async function listSavedMeals(userId: string) {
  const docs = await SavedMeal.find({ userId }).sort({ updatedAt: -1 }).limit(100).lean();
  return docs.map(toSavedMeal);
}

export async function createSavedMeal(userId: string, input: { name: string; items: ItemInput[] }) {
  const items = await buildItems(userId, input.items);
  const doc = await SavedMeal.create({ userId, name: input.name, items });
  return toSavedMeal(doc.toObject());
}

export async function updateSavedMeal(userId: string, id: string, input: { name?: string; items?: ItemInput[] }) {
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.items !== undefined) update.items = await buildItems(userId, input.items);
  const doc = await SavedMeal.findOneAndUpdate({ _id: id, userId }, { $set: update }, { returnDocument: 'after', runValidators: true }).lean();
  if (!doc) throw notFound('Saved meal');
  return toSavedMeal(doc);
}

export async function deleteSavedMeal(userId: string, id: string) {
  const res = await SavedMeal.deleteOne({ _id: id, userId });
  if (res.deletedCount === 0) throw notFound('Saved meal');
}

/** Logs a saved meal; optional per-item quantities adjust this log only, never the template. */
export async function logSavedMeal(userId: string, id: string, input: { date: string; meal: Meal; quantities?: number[]; clientRequestId: string }) {
  const doc = await SavedMeal.findOne({ _id: id, userId }).lean();
  if (!doc) throw notFound('Saved meal');
  if (input.quantities && input.quantities.length !== doc.items.length) throw badRequest('Provide one quantity per item');
  const items = doc.items.map((item, i) => ({ food: toFoodItem(item.food), servingId: item.servingId, quantity: input.quantities?.[i] ?? item.quantity }));
  return logTemplateItems(userId, items, input);
}

/* ----------------------------------- recipes ----------------------------------- */

function recipeTotals(ingredients: { nutrients: ReturnType<typeof toNutrients>; grams: number | null }[], portions: number) {
  const r = recipeNutrition(ingredients, portions);
  return { perPortion: r.perPortion, gramsPerPortion: r.gramsPerPortion };
}

export async function listRecipes(userId: string) {
  const docs = await Recipe.find({ userId }).sort({ updatedAt: -1 }).limit(100).lean();
  return docs.map(toRecipe);
}

export async function getRecipe(userId: string, id: string) {
  const doc = await Recipe.findOne({ _id: id, userId }).lean();
  if (!doc) throw notFound('Recipe');
  return toRecipe(doc);
}

export async function createRecipe(userId: string, input: { name: string; portions: number; notes?: string | null; ingredients: ItemInput[] }) {
  const ingredients = await buildItems(userId, input.ingredients, true);
  const doc = await Recipe.create({ userId, name: input.name, portions: input.portions, notes: input.notes ?? null, ingredients, ...recipeTotals(ingredients, input.portions) });
  await recordActivity(userId, 'recipe_saved', `Saved recipe "${input.name}"`);
  return toRecipe(doc.toObject());
}

export async function updateRecipe(userId: string, id: string, input: { name?: string; portions?: number; notes?: string | null; ingredients?: ItemInput[] }) {
  const doc = await Recipe.findOne({ _id: id, userId });
  if (!doc) throw notFound('Recipe');
  if (input.name !== undefined) doc.name = input.name;
  if (input.notes !== undefined) doc.notes = input.notes;
  if (input.portions !== undefined) doc.portions = input.portions;
  const ingredients = input.ingredients ? await buildItems(userId, input.ingredients, true) : doc.toObject().ingredients.map((i) => ({ ...i, nutrients: toNutrients(i.nutrients) }));
  if (input.ingredients) doc.set('ingredients', ingredients);
  doc.set(recipeTotals(ingredients.map((i) => ({ nutrients: toNutrients(i.nutrients), grams: i.grams ?? null })), doc.portions));
  await doc.save();
  return toRecipe(doc.toObject());
}

export async function deleteRecipe(userId: string, id: string) {
  const res = await Recipe.deleteOne({ _id: id, userId });
  if (res.deletedCount === 0) throw notFound('Recipe');
}
