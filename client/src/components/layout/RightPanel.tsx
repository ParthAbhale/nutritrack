import { Link } from 'react-router-dom';
import { AlarmClock, ArrowRight, Droplets, Flame, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { MEALS } from '@nutritrack/shared';
import { useSelectedDate } from '@/hooks/useSelectedDate';
import { useDailySummary } from '@/services/diary';
import { useStreak } from '@/services/analytics';
import { useHydrationMutations } from '@/services/tracking';
import { useMe } from '@/services/auth';
import { formatDate, formatKcal, formatNutrient, formatWater } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { newRequestId } from '@/lib/utils';
import { MonthCalendar } from '@/features/calendar/MonthCalendar';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../feedback/skeletons';
import { ErrorState } from '../feedback/states';
import { ProgressBar } from '../charts/progress';

/**
 * Right contextual panel (desktop): calendar, selected-day summary, hydration,
 * upcoming reminders and streak. On smaller screens the dashboard renders the
 * same sections inline (see DashboardPage).
 */
export function RightPanelContent() {
  const [date, setDate, today] = useSelectedDate();
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <MonthCalendar selected={date} today={today} onSelect={(d) => setDate(d === today ? null : d)} />
      </Card>
      <SelectedDayCard date={date} today={today} />
      <HydrationCard date={date} />
      <RemindersCard />
      <StreakCard />
    </div>
  );
}

export function RightPanel() {
  return (
    <aside aria-label="Calendar and daily context" className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[328px] shrink-0 overflow-y-auto border-l border-line bg-page p-4 xl:block">
      <RightPanelContent />
    </aside>
  );
}

function SelectedDayCard({ date, today }: { date: string; today: string }) {
  const { data, isPending, isError, error, refetch } = useDailySummary(date);
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-ink">{date === today ? 'Today' : formatDate(date, 'EEE, d MMM')}</h3>
        <Link to={`/diary?date=${date}`} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary">
          Open diary <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {isPending ? (
        <div className="space-y-2.5">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} compact />
      ) : !data.logged ? (
        <p className="text-[13px] text-muted">{date > today ? 'This day is in the future.' : 'Nothing logged for this day.'}</p>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[22px] font-semibold tabular text-ink">
            {formatKcal(data.totals.values.calories)} <span className="text-[13px] font-normal text-muted">/ {data.goal ? `${data.goal.calories} kcal` : 'no goal'}</span>
          </p>
          <ProgressBar percent={data.progress.calories.percent} label="Calories versus goal" />
          <dl className="grid grid-cols-3 gap-2 pt-1 text-center">
            {(['protein', 'carbs', 'fat'] as const).map((k) => (
              <div key={k} className="rounded-lg bg-surface-2 py-1.5">
                <dt className="text-[11px] capitalize text-muted">{k}</dt>
                <dd className="text-[13px] font-semibold tabular text-ink">{formatNutrient(data.totals.values[k])} g</dd>
              </div>
            ))}
          </dl>
          <p className="text-[12px] text-muted">
            {data.meals.filter((m) => m.entries.length).length} of {MEALS.length} meals logged · {data.totals.count} entries
          </p>
        </div>
      )}
    </Card>
  );
}

const QUICK_WATER = [250, 500];

export function HydrationCard({ date }: { date: string }) {
  const { data: user } = useMe();
  const { data, isPending } = useDailySummary(date);
  const { add } = useHydrationMutations();
  const units = user?.unitSystem ?? 'metric';
  const total = data?.waterMl ?? 0;
  const goal = data?.goal?.waterMl ?? null;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-soft text-water"><Droplets className="size-4" /></span>
        <h3 className="text-[14px] font-semibold text-ink">Hydration</h3>
        <Link to="/tracking?tab=water" className="ml-auto text-[12px] font-medium text-primary">History</Link>
      </div>
      {isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <>
          <p className="text-[13px] text-muted">
            <span className="text-lg font-semibold tabular text-ink">{formatWater(total, units)}</span> {goal ? `of ${formatWater(goal, units)}` : '(no goal set)'}
          </p>
          <ProgressBar className="mt-2" colorClass="bg-water" percent={goal ? (total / goal) * 100 : null} label="Water versus goal" />
          <div className="mt-3 flex gap-2">
            {QUICK_WATER.map((ml) => (
              <Button
                key={ml}
                variant="secondary"
                size="sm"
                className="flex-1"
                disabled={add.isPending}
                onClick={() =>
                  add.mutate(
                    { date, amountMl: ml, clientRequestId: newRequestId('water') },
                    { onSuccess: () => toast.success(`Logged ${formatWater(ml, units)} of water`), onError: (e) => toast.error(errorMessage(e)) },
                  )
                }
              >
                <Plus /> {formatWater(ml, units)}
              </Button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function RemindersCard() {
  const { data: user } = useMe();
  if (!user) return null;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = user.meals
    .filter((m) => m.time)
    .map((m) => ({ ...m, mins: Number(m.time!.slice(0, 2)) * 60 + Number(m.time!.slice(3)) }))
    .filter((m) => m.mins >= minutes)
    .sort((a, b) => a.mins - b.mins);
  const enabled = user.notifications.mealReminders;
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-soft text-primary"><AlarmClock className="size-4" /></span>
        <h3 className="text-[14px] font-semibold text-ink">Upcoming</h3>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-[13px] text-muted">No more scheduled meals today.</p>
      ) : (
        <ul className="divide-y divide-line">
          {upcoming.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-[13px]">
              <span className="text-ink">{m.name}</span>
              <span className="tabular text-muted">{m.time}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-subtle">
        Meal reminders are {enabled ? 'on' : 'off'}. <Link to="/settings?tab=notifications" className="text-primary">Change</Link>
      </p>
    </Card>
  );
}

function StreakCard() {
  const { data, isPending } = useStreak();
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-warning-soft text-warning"><Flame className="size-5" /></span>
        {isPending || !data ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div>
            <p className="text-[15px] font-semibold text-ink">{data.current} day{data.current === 1 ? '' : 's'} logging streak</p>
            <p className="text-[12px] text-muted">
              {data.pendingToday ? 'Log something today to keep it going.' : `Best: ${data.longest} days · ${data.last7DaysLogged}/7 this week`}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
