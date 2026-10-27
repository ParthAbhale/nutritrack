import { Types } from 'mongoose';
import {
  addToTotals, eachDate, emptyTotals, goalProgress, macroCalories, mergeTotals, MEALS, monthBounds,
  type CalendarDay, type DailySummary, type GoalSnapshot, type MealSummary, type MonthlyCalendar, type NutrientTotals,
  type PeriodStats, type RangeAnalytics, type RangeDay,
} from '@nutritrack/shared';
import { FoodLog, HydrationLog, WeightLog } from '../models';
import { goalForDate, goalResolver } from './goalService';
import { assertRange } from './diaryService';
import { toDiaryEntry, toNutrients } from './serializers';
import { getUser, userToday } from './userService';

/*
 * All totals (meal, day, month, range) are produced by the shared
 * `addToTotals`/`mergeTotals` functions so every view applies identical rules:
 * known values are summed, unknown values are counted as missing (never as zero),
 * and deleted entries are excluded.
 */

function progressFor(totals: NutrientTotals, waterMl: number, goal: GoalSnapshot | null) {
  return {
    calories: goalProgress(totals.values.calories, goal?.calories),
    protein: goalProgress(totals.values.protein, goal?.protein),
    carbs: goalProgress(totals.values.carbs, goal?.carbs),
    fat: goalProgress(totals.values.fat, goal?.fat),
    water: goalProgress(waterMl, goal?.waterMl),
  };
}

async function waterByDate(userId: string, from: string, to: string): Promise<Map<string, number>> {
  const rows = await HydrationLog.aggregate<{ _id: string; total: number }>([
    { $match: { userId: new Types.ObjectId(userId), date: { $gte: from, $lte: to } } },
    { $group: { _id: '$date', total: { $sum: '$amountMl' } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.total]));
}


export async function dailySummary(userId: string, date: string): Promise<DailySummary> {
  const [user, docs, water, goal] = await Promise.all([
    getUser(userId),
    FoodLog.find({ userId, date, deletedAt: null }).sort({ createdAt: 1 }).lean(),
    waterByDate(userId, date, date),
    goalForDate(userId, date),
  ]);
  const entries = docs.map(toDiaryEntry);
  const meals: MealSummary[] = MEALS.map((meal) => {
    const mealEntries = entries.filter((e) => e.meal === meal);
    const totals = emptyTotals();
    mealEntries.forEach((e) => addToTotals(totals, e.nutrients));
    const name = user.meals?.find((m) => m.id === meal)?.name ?? meal;
    return { meal, name, totals, entries: mealEntries };
  });
  const totals = mergeTotals(meals.map((m) => m.totals));
  const waterMl = water.get(date) ?? 0;
  return {
    date,
    logged: entries.length > 0,
    totals,
    meals,
    waterMl,
    goal,
    progress: progressFor(totals, waterMl, goal),
    macroCalories: macroCalories(totals.values),
  };
}

async function dayTotals(userId: string, from: string, to: string) {
  const docs = await FoodLog.find({ userId, date: { $gte: from, $lte: to }, deletedAt: null }).select('date nutrients').lean();
  const byDate = new Map<string, NutrientTotals>();
  for (const d of docs) {
    let t = byDate.get(d.date);
    if (!t) byDate.set(d.date, (t = emptyTotals()));
    addToTotals(t, toNutrients(d.nutrients));
  }
  return byDate;
}

export function computePeriodStats(
  from: string,
  to: string,
  today: string,
  totalsByDate: Map<string, NutrientTotals>,
  water: Map<string, number>,
  goalAt: (date: string) => GoalSnapshot | null,
): PeriodStats {
  const dates = eachDate(from, to);
  const logged = dates.filter((d) => totalsByDate.has(d));
  const totals = mergeTotals(logged.map((d) => totalsByDate.get(d)!));
  const elapsedDays = dates.filter((d) => d <= today).length;
  let meeting = 0;
  let highest: PeriodStats['highestDay'] = null;
  let lowest: PeriodStats['lowestDay'] = null;
  for (const d of logged) {
    const calories = totalsByDate.get(d)!.values.calories;
    if (goalProgress(calories, goalAt(d)?.calories).status === 'met') meeting += 1;
    if (calories === null) continue;
    if (!highest || calories > highest.calories) highest = { date: d, calories };
    if (!lowest || calories < lowest.calories) lowest = { date: d, calories };
  }
  const avg = (v: number | null) => (v === null || logged.length === 0 ? null : v / logged.length);
  const waterDays = dates.filter((d) => (water.get(d) ?? 0) > 0);
  const waterTotalMl = waterDays.reduce((s, d) => s + (water.get(d) ?? 0), 0);
  return {
    from,
    to,
    daysInPeriod: dates.length,
    elapsedDays,
    daysLogged: logged.length,
    daysMeetingCalorieGoal: meeting,
    totals,
    averages: { calories: avg(totals.values.calories), protein: avg(totals.values.protein), carbs: avg(totals.values.carbs), fat: avg(totals.values.fat) },
    highestDay: highest,
    lowestDay: lowest,
    consistencyPercent: elapsedDays > 0 ? (logged.filter((d) => d <= today).length / elapsedDays) * 100 : null,
    waterTotalMl,
    averageWaterMl: waterDays.length ? waterTotalMl / waterDays.length : null,
  };
}

function dayStatus(totals: NutrientTotals | undefined, target: number | null): CalendarDay['status'] {
  if (!totals) return 'not-logged';
  return goalProgress(totals.values.calories, target).status;
}

export async function monthCalendar(userId: string, year: number, month: number): Promise<MonthlyCalendar> {
  const { from, to } = monthBounds(year, month);
  const [{ today }, totalsByDate, water, goalAt] = await Promise.all([
    userToday(userId),
    dayTotals(userId, from, to),
    waterByDate(userId, from, to),
    goalResolver(userId, from, to),
  ]);
  const days: CalendarDay[] = eachDate(from, to).map((date) => {
    const t = totalsByDate.get(date);
    const target = goalAt(date)?.calories ?? null;
    return {
      date,
      logged: Boolean(t),
      entryCount: t?.count ?? 0,
      calories: t ? t.values.calories : null,
      calorieTarget: target,
      status: dayStatus(t, target),
      waterMl: water.get(date) ?? 0,
    };
  });
  return { year, month, days, stats: computePeriodStats(from, to, today, totalsByDate, water, goalAt) };
}

export async function rangeAnalytics(userId: string, from: string, to: string): Promise<RangeAnalytics> {
  assertRange(from, to);
  const [{ today }, totalsByDate, water, goalAt, weights] = await Promise.all([
    userToday(userId),
    dayTotals(userId, from, to),
    waterByDate(userId, from, to),
    goalResolver(userId, from, to),
    WeightLog.find({ userId, date: { $gte: from, $lte: to } }).select('date weightKg').lean(),
  ]);
  const weightByDate = new Map(weights.map((w) => [w.date, w.weightKg]));
  const days: RangeDay[] = eachDate(from, to).map((date) => {
    const t = totalsByDate.get(date);
    const target = goalAt(date)?.calories ?? null;
    return {
      date,
      logged: Boolean(t),
      calories: t ? t.values.calories : null,
      protein: t ? t.values.protein : null,
      carbs: t ? t.values.carbs : null,
      fat: t ? t.values.fat : null,
      fiber: t ? t.values.fiber : null,
      waterMl: water.get(date) ?? 0,
      weightKg: weightByDate.get(date) ?? null,
      calorieTarget: target,
      status: dayStatus(t, target),
    };
  });
  return { stats: computePeriodStats(from, to, today, totalsByDate, water, goalAt), days };
}

export { userToday };
