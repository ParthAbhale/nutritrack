import { Link } from 'react-router-dom';
import { CalendarX, NotebookPen } from 'lucide-react';
import { parseDateString } from '@nutritrack/shared';
import { format } from 'date-fns';
import { useSelectedDate } from '@/hooks/useSelectedDate';
import { useDailySummary } from '@/services/diary';
import { useMonthCalendar } from '@/services/analytics';
import { useMe } from '@/services/auth';
import { formatDate, formatKcal, formatNutrient, formatWater, percent } from '@/lib/format';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListSkeleton, Skeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { ProgressBar } from '@/components/charts/progress';
import { MonthCalendar } from './MonthCalendar';

export default function CalendarPage() {
  const [date, setDate, today] = useSelectedDate();
  return (
    <div className="space-y-5">
      <PageHeader title="Calendar & history" description="Pick any day to review what you logged. Days without entries are shown as not logged, never as zero." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-4 sm:p-5">
          <MonthCalendar variant="full" selected={date} today={today} onSelect={(d) => setDate(d === today ? null : d)} />
        </Card>
        <DayDetail date={date} today={today} />
      </div>
      <MonthSummary date={date} />
    </div>
  );
}

function DayDetail({ date, today }: { date: string; today: string }) {
  const { data, isPending, isError, error, refetch } = useDailySummary(date);
  const { data: user } = useMe();
  return (
    <Card className="h-fit">
      <CardHeader title={formatDate(date)} description={date === today ? 'Today' : undefined} action={<Link to={`/diary?date=${date}`} className={buttonVariants({ variant: 'soft', size: 'sm' })}><NotebookPen /> Edit in diary</Link>} />
      <CardBody>
        {isPending ? (
          <div className="space-y-3"><Skeleton className="h-8 w-32" /><Skeleton className="h-2 w-full" /><ListSkeleton rows={3} /></div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} compact />
        ) : !data.logged ? (
          <EmptyState compact icon={CalendarX} title="Not logged" description={date > today ? 'This day is in the future.' : 'No food entries were saved for this day.'} />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-semibold tabular text-ink">{formatKcal(data.totals.values.calories)} <span className="text-sm font-normal text-muted">kcal{data.goal ? ` of ${data.goal.calories}` : ''}</span></p>
              <ProgressBar className="mt-2" percent={data.progress.calories.percent} label="Calories versus goal" />
              <p className="mt-1 text-[12px] text-muted">{percent(data.progress.calories.percent)} of goal · {data.meals.filter((m) => m.entries.length).length} meals · {formatWater(data.waterMl, user?.unitSystem)} water</p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {(['protein', 'carbs', 'fat'] as const).map((k) => (
                <div key={k} className="rounded-lg bg-surface-2 py-2">
                  <dt className="text-[11px] capitalize text-muted">{k}</dt>
                  <dd className="text-sm font-semibold tabular text-ink">{formatNutrient(data.totals.values[k])} g</dd>
                  <dd className="text-[10.5px] text-subtle">{percent(data.progress[k].percent)}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-3">
              {data.meals.filter((m) => m.entries.length).map((m) => (
                <div key={m.meal}>
                  <p className="flex justify-between text-[13px] font-semibold text-ink"><span>{m.name}</span><span className="tabular">{formatKcal(m.totals.values.calories)} kcal</span></p>
                  <ul className="mt-1 space-y-0.5">
                    {m.entries.map((e) => (
                      <li key={e.id} className="flex justify-between gap-3 text-[12.5px] text-muted">
                        <span className="truncate">{e.food.name} <span className="text-subtle">· {e.quantity} × {e.servingLabel}</span></span>
                        <span className="shrink-0 tabular">{formatKcal(e.nutrients.calories)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function MonthSummary({ date }: { date: string }) {
  const { year, month } = parseDateString(date)!;
  const { data, isPending, isError, error, refetch } = useMonthCalendar(year, month);
  const s = data?.stats;
  return (
    <Card>
      <CardHeader title={`${format(new Date(year, month - 1, 1), 'MMMM yyyy')} summary`} description="Averages use logged days only" />
      <CardBody>
        {isPending ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} compact />
        ) : s!.daysLogged === 0 ? (
          <EmptyState compact icon={CalendarX} title="No activity this month" description="Log meals to build your monthly history." />
        ) : (
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Total calories', `${formatKcal(s!.totals.values.calories)} kcal`],
              ['Daily average', `${formatKcal(s!.averages.calories)} kcal`],
              ['Days logged', `${s!.daysLogged} / ${s!.elapsedDays}`],
              ['Logging consistency', percent(s!.consistencyPercent)],
              ['Days meeting goal', `${s!.daysMeetingCalorieGoal}`],
              ['Avg protein', `${formatNutrient(s!.averages.protein)} g`],
              ['Avg carbs', `${formatNutrient(s!.averages.carbs)} g`],
              ['Avg fat', `${formatNutrient(s!.averages.fat)} g`],
              ['Highest day', s!.highestDay ? `${formatDate(s!.highestDay.date, 'd MMM')} · ${formatKcal(s!.highestDay.calories)}` : '—'],
              ['Lowest day', s!.lowestDay ? `${formatDate(s!.lowestDay.date, 'd MMM')} · ${formatKcal(s!.lowestDay.calories)}` : '—'],
              ['Total protein', `${formatNutrient(s!.totals.values.protein)} g`],
              ['Avg water', s!.averageWaterMl === null ? '—' : formatWater(s!.averageWaterMl)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-2 p-3">
                <dt className="text-[12px] text-muted">{label}</dt>
                <dd className="mt-0.5 text-[15px] font-semibold tabular text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardBody>
    </Card>
  );
}
