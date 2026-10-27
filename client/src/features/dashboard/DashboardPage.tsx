import { Link } from 'react-router-dom';
import { BarChart3, CalendarDays, Droplets, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useMe } from '@/services/auth';
import { useDailySummary } from '@/services/diary';
import { useHydrationMutations } from '@/services/tracking';
import { useSelectedDate } from '@/hooks/useSelectedDate';
import { useAddFoodStore } from '@/lib/stores';
import { formatDate, formatKcal, formatWater } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { newRequestId } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DonutSkeleton, MealCardSkeleton, MetricGridSkeleton } from '@/components/feedback/skeletons';
import { ErrorState, Notice } from '@/components/feedback/states';
import { RightPanelContent } from '@/components/layout/RightPanel';
import { MealCard } from '@/features/food-log/MealCard';
import { MetricCards } from './MetricCards';
import { MacroDonut } from './MacroDonut';
import { MonthlyStatsCard } from './MonthlyStatsCard';
import { RecentActivityCard } from './RecentActivityCard';

function greeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function progressMessage(consumed: number | null, target: number | null, logged: boolean, isToday: boolean) {
  if (!logged) return isToday ? "You haven't logged anything yet today. Start with your first meal." : 'No food was logged on this day.';
  if (!target) return `You've logged ${formatKcal(consumed)} kcal. Set a goal to track your progress.`;
  const remaining = target - (consumed ?? 0);
  if (remaining > 0) return `${formatKcal(remaining)} kcal left of your ${target} kcal goal.`;
  return `${formatKcal(-remaining)} kcal above your ${target} kcal goal${isToday ? ' today' : ''}.`;
}

export default function DashboardPage() {
  const { data: user } = useMe();
  const [date, setDate, today] = useSelectedDate();
  const { data, isPending, isError, error, refetch, isFetching } = useDailySummary(date);
  const openAddFood = useAddFoodStore((s) => s.openAddFood);
  const { add: addWater } = useHydrationMutations();
  const isToday = date === today;
  const firstName = user?.name.split(' ')[0] ?? '';

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[13px] font-medium text-muted">{formatDate(date, 'EEEE, d MMMM yyyy')}</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-ink">
            {isToday ? `${greeting()}, ${firstName}` : `Your day on ${formatDate(date, 'd MMM')}`}
          </h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {data ? progressMessage(data.totals.values.calories, data.goal?.calories ?? null, data.logged, isToday) : ' '}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openAddFood({ date })}><Plus /> Add food</Button>
          <Button
            variant="secondary"
            loading={addWater.isPending}
            onClick={() =>
              addWater.mutate(
                { date, amountMl: 250, clientRequestId: newRequestId('water') },
                { onSuccess: () => toast.success(`Logged ${formatWater(250, user?.unitSystem)} of water`), onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            <Droplets /> Add water
          </Button>
          <Link to="/reports" className={buttonVariants({ variant: 'secondary' })}><BarChart3 /> Reports</Link>
        </div>
      </section>

      {!isToday && (
        <Notice icon={CalendarDays}>
          You're viewing {formatDate(date)}. New entries will be added to this day.{' '}
          <button type="button" className="font-medium text-primary underline" onClick={() => setDate(null)}>Back to today</button>
        </Notice>
      )}
      {user && !data?.goal && data && (
        <Notice>
          You haven't set daily targets yet. <Link to="/goals" className="font-medium text-primary underline">Set your goals</Link> to see progress.
        </Notice>
      )}

      {isPending ? (
        <MetricGridSkeleton />
      ) : isError ? (
        <Card><ErrorState error={error} onRetry={() => refetch()} /></Card>
      ) : (
        <div className={isFetching ? 'opacity-80 transition-opacity' : undefined}>
          <MetricCards summary={data} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {isPending ? <Card className="p-6"><DonutSkeleton /></Card> : data ? <MacroDonut summary={data} /> : null}
        <MonthlyStatsCard date={date} />
      </div>

      <section aria-labelledby="meals-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="meals-heading" className="text-[17px] font-semibold text-ink">Meals</h2>
          <Link to={`/diary?date=${date}`} className="text-[13px] font-medium text-primary">Open full diary</Link>
        </div>
        {isPending ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <MealCardSkeleton key={i} />)}</div>
        ) : data ? (
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
            {data.meals.map((m) => (
              <MealCard key={m.meal} summary={m} date={date} defaultOpen={m.entries.length > 0} time={user?.meals.find((x) => x.id === m.meal)?.time} />
            ))}
          </div>
        ) : null}
      </section>

      <RecentActivityCard />

      {/* The right panel is hidden below xl; show its sections inline instead. */}
      <section className="xl:hidden" aria-label="Calendar and daily context">
        <RightPanelContent />
      </section>
    </div>
  );
}
