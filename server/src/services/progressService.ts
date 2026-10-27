import { addDays, diffInDays, goalProgress, sumNutrients, type StreakInfo } from '@nutritrack/shared';
import { FoodLog, User, WeightLog } from '../models';
import { logger } from '../config/logger';
import { goalForDate } from './goalService';
import { notify } from './notificationService';
import { userToday } from './userService';
import { toNutrients } from './serializers';

/**
 * Streak policy: a day counts when it has at least one food entry, using the
 * user's local calendar dates. If today has no entries yet, the streak from
 * yesterday is still shown (pendingToday) rather than reset to zero. A missed
 * day ends the streak; the longest streak is preserved.
 */
export function computeStreak(loggedDates: string[], today: string): StreakInfo {
  const set = new Set(loggedDates);
  const sorted = [...set].filter((d) => d <= today).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && diffInDays(d, prev) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const pendingToday = !set.has(today) && set.has(addDays(today, -1));
  let cursor = set.has(today) ? today : pendingToday ? addDays(today, -1) : null;
  let current = 0;
  while (cursor && set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  let last7 = 0;
  for (let i = 0; i < 7; i++) if (set.has(addDays(today, -i))) last7 += 1;
  return { current, longest, lastLoggedDate: sorted.at(-1) ?? null, pendingToday, last7DaysLogged: last7 };
}

export async function getStreak(userId: string): Promise<StreakInfo> {
  const { today } = await userToday(userId);
  const dates = (await FoodLog.distinct('date', { userId, deletedAt: null })) as string[];
  return computeStreak(dates, today);
}

async function checkMilestones(userId: string) {
  const user = await User.findById(userId).select('milestones').lean();
  const open = (user?.milestones ?? []).filter((m) => !m.achievedAt);
  if (open.length === 0) return;
  const streak = await getStreak(userId);
  const daysLogged = (await FoodLog.distinct('date', { userId, deletedAt: null })).length;
  const latestWeight = await WeightLog.findOne({ userId }).sort({ date: -1 }).lean();
  for (const m of open) {
    let achieved = false;
    if (m.type === 'streak_days') achieved = streak.current >= m.target;
    if (m.type === 'days_logged') achieved = daysLogged >= m.target;
    if (m.type === 'target_weight' && latestWeight) achieved = Math.abs(latestWeight.weightKg - m.target) <= 0.5;
    if (!achieved) continue;
    await User.updateOne({ _id: userId, 'milestones._id': m._id }, { $set: { 'milestones.$.achievedAt': new Date() } });
    await notify(userId, { type: 'milestone', title: 'Milestone reached 🎉', body: `You reached "${m.title}". Nice work!`, dedupeKey: `milestone:${String(m._id)}` });
  }
}

/** Side effects after diary changes: goal-progress notifications (today only) and milestones. Never fails the request. */
export async function afterDiaryChange(userId: string, date: string) {
  try {
    const { today } = await userToday(userId);
    if (date === today) {
      const user = await User.findById(userId).select('notifications').lean();
      const goal = await goalForDate(userId, date);
      if (goal && user?.notifications?.goalProgress !== false) {
        const entries = await FoodLog.find({ userId, date, deletedAt: null }).select('nutrients').lean();
        const totals = sumNutrients(entries.map((e) => toNutrients(e.nutrients)));
        const progress = goalProgress(totals.values.calories, goal.calories);
        if (progress.status === 'met') {
          await notify(userId, { type: 'goal_reached', title: 'Calorie goal reached', body: `You're within 10% of today's ${goal.calories} kcal goal.`, dedupeKey: `goal_reached:${date}` });
        } else if (progress.status === 'over') {
          await notify(userId, { type: 'goal_exceeded', title: 'Above today\'s calorie goal', body: `Today's total is more than 10% above your ${goal.calories} kcal goal. That's okay. Tomorrow is a new day.`, dedupeKey: `goal_exceeded:${date}` });
        }
      }
    }
    await checkMilestones(userId);
  } catch (err) {
    logger().warn({ err: err instanceof Error ? err.message : err }, 'Post-diary processing failed');
  }
}

export { checkMilestones };
