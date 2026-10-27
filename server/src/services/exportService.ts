import { FoodLog, HydrationLog, WeightLog, NutritionGoal, CustomFood, Favorite, SavedMeal, Recipe, Notification, Activity, User } from '../models';
import { toCsv } from '../utils/csv';
import { assertRange } from './diaryService';
import { toUserProfile } from './serializers';

/** CSV of the authenticated user's own diary. The user id comes from the session only. */
export async function diaryCsv(userId: string, from: string, to: string): Promise<string> {
  assertRange(from, to);
  const docs = await FoodLog.find({ userId, date: { $gte: from, $lte: to }, deletedAt: null }).sort({ date: 1, meal: 1, createdAt: 1 }).lean();
  const headers = ['date', 'meal', 'food', 'brand', 'serving', 'quantity', 'grams', 'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugars_g', 'sodium_mg', 'source', 'notes'];
  const r2 = (v: number | null | undefined) => (typeof v === 'number' ? Math.round(v * 100) / 100 : null);
  const rows = docs.map((d) => [
    d.date, d.meal, d.food.name, d.food.brand, d.servingLabel, d.quantity, r2(d.consumedGrams),
    r2(d.nutrients.calories), r2(d.nutrients.protein), r2(d.nutrients.carbs), r2(d.nutrients.fat),
    r2(d.nutrients.fiber), r2(d.nutrients.sugars), r2(d.nutrients.sodium), d.food.attribution, d.notes,
  ]);
  return toCsv(headers, rows);
}

/** Full personal-data export (JSON). Excludes password hashes and session secrets. */
export async function personalDataExport(userId: string) {
  const [user, foodLogs, hydration, weights, goals, customFoods, favorites, savedMeals, recipes, notifications, activity] = await Promise.all([
    User.findById(userId).lean(),
    FoodLog.find({ userId, deletedAt: null }).select('-userId -clientRequestId -deletedAt -__v').lean(),
    HydrationLog.find({ userId }).select('-userId -clientRequestId -__v').lean(),
    WeightLog.find({ userId }).select('-userId -__v').lean(),
    NutritionGoal.find({ userId }).select('-userId -__v').lean(),
    CustomFood.find({ userId }).select('-userId -__v').lean(),
    Favorite.find({ userId }).select('-userId -__v').lean(),
    SavedMeal.find({ userId }).select('-userId -__v').lean(),
    Recipe.find({ userId }).select('-userId -__v').lean(),
    Notification.find({ userId }).select('-userId -dedupeKey -__v').lean(),
    Activity.find({ userId }).select('-userId -__v').lean(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile: user ? toUserProfile(user) : null,
    foodLogs, hydration, weights, goals, customFoods, favorites, savedMeals, recipes, notifications, activity,
  };
}
