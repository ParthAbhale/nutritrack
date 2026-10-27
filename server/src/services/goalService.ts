import type { GoalInput, GoalSnapshot } from '@nutritrack/shared';
import { NutritionGoal } from '../models';
import { conflict, notFound } from '../utils/errors';
import { toGoal } from './serializers';
import { userToday } from './userService';
import { recordActivity } from './activityService';

/**
 * Goal history policy: each goal has an effective date. Reports for a past day
 * use the goal that was effective on that day, so changing a goal never
 * rewrites historical progress. Saving a goal with the same effective date as
 * an existing one replaces that version.
 */
export async function goalForDate(userId: string, date: string): Promise<GoalSnapshot | null> {
  const doc = await NutritionGoal.findOne({ userId, effectiveFrom: { $lte: date } }).sort({ effectiveFrom: -1 }).lean();
  return doc ? toGoal(doc) : null;
}

/** Returns a resolver for every day in [from, to] using at most one query. */
export async function goalResolver(userId: string, from: string, to: string) {
  const [baseline, changes] = await Promise.all([
    NutritionGoal.findOne({ userId, effectiveFrom: { $lte: from } }).sort({ effectiveFrom: -1 }).lean(),
    NutritionGoal.find({ userId, effectiveFrom: { $gt: from, $lte: to } }).sort({ effectiveFrom: 1 }).lean(),
  ]);
  const versions = [...(baseline ? [toGoal(baseline)] : []), ...changes.map(toGoal)];
  return (date: string): GoalSnapshot | null => {
    let current: GoalSnapshot | null = null;
    for (const g of versions) {
      if (g.effectiveFrom <= date) current = g;
      else break;
    }
    return current;
  };
}

export async function currentGoal(userId: string) {
  const { today } = await userToday(userId);
  return goalForDate(userId, today);
}

export async function saveGoal(userId: string, input: GoalInput) {
  const { today } = await userToday(userId);
  const effectiveFrom = input.effectiveFrom ?? today;
  const doc = await NutritionGoal.findOneAndUpdate(
    { userId, effectiveFrom },
    {
      $set: {
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
        fiber: input.fiber ?? null,
        waterMl: input.waterMl,
        source: input.source ?? 'manual',
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean();
  await recordActivity(userId, 'goal_changed', `Daily goal set to ${input.calories} kcal (from ${effectiveFrom})`, effectiveFrom);
  return toGoal(doc);
}

export async function updateGoal(userId: string, goalId: string, input: Partial<GoalInput>) {
  try {
    const doc = await NutritionGoal.findOneAndUpdate({ _id: goalId, userId }, { $set: input }, { returnDocument: 'after', runValidators: true }).lean();
    if (!doc) throw notFound('Goal');
    await recordActivity(userId, 'goal_changed', `Goal effective ${doc.effectiveFrom} updated`, doc.effectiveFrom);
    return toGoal(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw conflict('A goal already starts on that date');
    throw err;
  }
}

export async function goalHistory(userId: string) {
  const docs = await NutritionGoal.find({ userId }).sort({ effectiveFrom: -1 }).limit(100).lean();
  return docs.map(toGoal);
}
