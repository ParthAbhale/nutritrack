import { minutesOfDayInTimeZone, todayInTimeZone } from '@nutritrack/shared';
import { User, FoodLog, HydrationLog } from '../models';
import { notify } from '../services/notificationService';
import { logger } from '../config/logger';
import { goalForDate } from '../services/goalService';

/**
 * Creates in-app reminder notifications (and emails, when SMTP is configured
 * and the user opted in) once a minute. Reminders are de-duplicated per user,
 * type and local date, so restarts or multiple instances can't double-send.
 * Meal reminders are skipped when that meal already has entries.
 */
export async function runReminderTick(now = new Date()) {
  const users = await User.find({
    status: 'active',
    $or: [{ 'notifications.mealReminders': true }, { 'notifications.hydrationReminders': true }],
  })
    .select('timeZone meals notifications')
    .limit(5000)
    .lean();

  for (const user of users) {
    const userId = String(user._id);
    const tz = user.timeZone ?? 'UTC';
    const today = todayInTimeZone(tz, now);
    const minutes = minutesOfDayInTimeZone(now, tz);

    if (user.notifications?.mealReminders) {
      for (const meal of user.meals ?? []) {
        if (!meal.time || !meal.id) continue;
        const mealName = (meal.name ?? meal.id).toLowerCase();
        const [h, m] = meal.time.split(':').map(Number);
        const due = (h ?? 0) * 60 + (m ?? 0);
        if (minutes < due || minutes > due + 30) continue;
        const logged = await FoodLog.exists({ userId, date: today, meal: meal.id, deletedAt: null });
        if (logged) continue;
        await notify(userId, {
          type: 'meal_reminder',
          title: `Time to log ${mealName}`,
          body: `You haven't logged ${mealName} yet today.`,
          dedupeKey: `meal:${meal.id}:${today}`,
          email: true,
        });
      }
    }

    if (user.notifications?.hydrationReminders) {
      const interval = (user.notifications.hydrationIntervalHours ?? 2) * 60;
      // Between 08:00 and 21:00 local time, on interval boundaries.
      if (minutes >= 8 * 60 && minutes <= 21 * 60 && (minutes - 8 * 60) % interval < 5) {
        const goal = await goalForDate(userId, today);
        const logs = await HydrationLog.find({ userId, date: today }).select('amountMl').lean();
        const total = logs.reduce((s, l) => s + l.amountMl, 0);
        if (!goal || total < goal.waterMl) {
          const slot = Math.floor((minutes - 8 * 60) / interval);
          await notify(userId, {
            type: 'hydration_reminder',
            title: 'Hydration check-in',
            body: goal ? `You've logged ${Math.round(total)} of ${goal.waterMl} ml today.` : `You've logged ${Math.round(total)} ml of water today.`,
            dedupeKey: `water:${today}:${slot}`,
          });
        }
      }
    }
  }
}

export function startReminderJob(): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runReminderTick();
    } catch (err) {
      logger().error({ err }, 'Reminder job failed');
    } finally {
      running = false;
    }
  }, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
