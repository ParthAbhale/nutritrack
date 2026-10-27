import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { parseDateString } from '@nutritrack/shared';
import { format } from 'date-fns';
import { useMonthCalendar } from '@/services/analytics';
import { formatDate, formatKcal, percent } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/states';

export function MonthlyStatsCard({ date }: { date: string }) {
  const { year, month } = parseDateString(date)!;
  const { data, isPending, isError, error, refetch } = useMonthCalendar(year, month);
  const s = data?.stats;
  const tiles = s
    ? [
        { label: 'Total calories', value: s.daysLogged ? `${formatKcal(s.totals.values.calories)}` : '—', sub: 'kcal this month' },
        { label: 'Daily average', value: formatKcal(s.averages.calories), sub: 'kcal per logged day' },
        { label: 'Days logged', value: `${s.daysLogged}`, sub: `of ${s.elapsedDays} days so far · ${percent(s.consistencyPercent)}` },
        { label: 'Goal days', value: `${s.daysMeetingCalorieGoal}`, sub: 'within ±10% of target' },
      ]
    : [];
  return (
    <Card className="h-full">
      <CardHeader
        title={`${format(new Date(year, month - 1, 1), 'MMMM')} at a glance`}
        description="Days without entries aren't counted as zero"
        action={<Link to="/calendar" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary">History <ArrowRight className="size-3.5" /></Link>}
      />
      <CardBody>
        {isPending ? (
          <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} compact />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3">
              {tiles.map((t) => (
                <div key={t.label} className="rounded-xl bg-surface-2 p-3.5">
                  <dt className="text-[12px] text-muted">{t.label}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular text-ink">{t.value}</dd>
                  <dd className="text-[11.5px] text-subtle">{t.sub}</dd>
                </div>
              ))}
            </dl>
            {s && s.highestDay && s.lowestDay && (
              <p className="mt-3 text-[12px] text-muted">
                Highest: {formatDate(s.highestDay.date, 'd MMM')} ({formatKcal(s.highestDay.calories)} kcal) · Lowest: {formatDate(s.lowestDay.date, 'd MMM')} ({formatKcal(s.lowestDay.calories)} kcal)
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
