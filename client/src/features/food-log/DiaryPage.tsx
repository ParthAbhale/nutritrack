import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy, NotebookPen, Plus, Search } from 'lucide-react';
import { addDays, isValidDateString, MEALS, mergeTotals, sumNutrients, type Meal, type MealSummary } from '@nutritrack/shared';
import { useDailySummary } from '@/services/diary';
import { useMe } from '@/services/auth';
import { useSelectedDate } from '@/hooks/useSelectedDate';
import { useAddFoodStore } from '@/lib/stores';
import { formatDate, formatKcal, formatNutrient, formatWater, percent } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { MealCardSkeleton, MetricGridSkeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { ProgressBar } from '@/components/charts/progress';
import { PageHeader } from '@/components/layout/PageHeader';
import { MealCard } from './MealCard';
import { CopyDayDialog } from './CopyDayDialog';

export default function DiaryPage() {
  const [params, setParams] = useSearchParams();
  const [date, setDate, today] = useSelectedDate();
  const { data: user } = useMe();
  const openAddFood = useAddFoodStore((s) => s.openAddFood);
  const [filter, setFilter] = useState('');
  const [mealFilter, setMealFilter] = useState<Meal | 'all'>('all');
  const [copyOpen, setCopyOpen] = useState(false);

  // Keep ?date= in sync with the shared selected date (deep links + back button).
  const urlDate = params.get('date');
  useEffect(() => {
    if (urlDate && isValidDateString(urlDate) && urlDate !== date) setDate(urlDate === today ? null : urlDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlDate]);
  const go = (d: string) => {
    setDate(d === today ? null : d);
    setParams(d === today ? {} : { date: d }, { replace: true });
  };

  const { data, isPending, isError, error, refetch, isFetching } = useDailySummary(date);
  const q = filter.trim().toLowerCase();
  const meals: MealSummary[] = useMemo(() => {
    if (!data) return [];
    return data.meals
      .filter((m) => mealFilter === 'all' || m.meal === mealFilter)
      .map((m) => {
        if (!q) return m;
        const entries = m.entries.filter((e) => `${e.food.name} ${e.food.brand ?? ''} ${e.food.category ?? ''}`.toLowerCase().includes(q));
        return { ...m, entries, totals: sumNutrients(entries.map((e) => e.nutrients)) };
      });
  }, [data, mealFilter, q]);
  const filtered = Boolean(q) || mealFilter !== 'all';
  const shownTotals = filtered ? mergeTotals(meals.map((m) => m.totals)) : data?.totals;
  const units = user?.unitSystem ?? 'metric';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Food diary"
        description="Everything you ate, grouped by meal."
        actions={
          <>
            <Button variant="secondary" onClick={() => setCopyOpen(true)}><Copy /> Copy from another day</Button>
            <Button onClick={() => openAddFood({ date })}><Plus /> Add food</Button>
          </>
        }
      />

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => go(addDays(date, -1))}><ChevronLeft /></Button>
        <label className="sr-only" htmlFor="diary-date">Diary date</label>
        <Input id="diary-date" type="date" className="w-auto" value={date} onChange={(e) => isValidDateString(e.target.value) && go(e.target.value)} />
        <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => go(addDays(date, 1))}><ChevronRight /></Button>
        {date !== today && <Button variant="soft" size="sm" onClick={() => go(today)}>Today</Button>}
        <span className="ml-1 text-sm font-medium text-ink">{formatDate(date)}{date === today && <span className="text-muted"> · Today</span>}</span>
      </Card>

      {isPending ? (
        <MetricGridSkeleton />
      ) : isError ? (
        <Card><ErrorState error={error} onRetry={() => refetch()} /></Card>
      ) : (
        <Card className={isFetching ? 'p-5 opacity-80' : 'p-5'}>
          <h2 className="sr-only">Daily totals</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => {
              const p = data.progress[k];
              return (
                <div key={k}>
                  <p className="text-[12px] capitalize text-muted">{k}</p>
                  <p className="text-lg font-semibold tabular text-ink">
                    {formatNutrient(data.totals.values[k] ?? 0, k)}
                    <span className="text-[12px] font-normal text-muted"> / {p.target === null ? '—' : formatNutrient(p.target, k)}{k === 'calories' ? ' kcal' : ' g'}</span>
                  </p>
                  <ProgressBar className="mt-1.5" percent={p.percent} colorClass={k === 'calories' ? 'bg-primary' : k === 'protein' ? 'bg-protein' : k === 'carbs' ? 'bg-carbs' : 'bg-fat'} label={`${k} progress`} />
                  <p className="mt-1 text-[11.5px] text-muted">{percent(p.percent)} of goal</p>
                </div>
              );
            })}
            <div>
              <p className="text-[12px] text-muted">Water</p>
              <p className="text-lg font-semibold tabular text-ink">{formatWater(data.waterMl, units)}</p>
              <ProgressBar className="mt-1.5" colorClass="bg-water" percent={data.progress.water.percent} label="Water progress" />
              <p className="mt-1 text-[11.5px] text-muted">{data.goal ? `of ${formatWater(data.goal.waterMl, units)}` : 'No goal'}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input aria-label="Search this day's entries" placeholder="Search this day's entries…" className="pl-9" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <Select aria-label="Filter by meal" className="sm:w-48" value={mealFilter} onChange={(e) => setMealFilter(e.target.value as Meal | 'all')}>
          <option value="all">All meals</option>
          {MEALS.map((m) => (
            <option key={m} value={m}>{user?.meals.find((x) => x.id === m)?.name ?? m}</option>
          ))}
        </Select>
      </div>

      {isPending ? (
        <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <MealCardSkeleton key={i} />)}</div>
      ) : data ? (
        <>
          {!data.logged && !filtered && (
            <Card>
              <EmptyState icon={NotebookPen} title={date > today ? 'Planning ahead?' : 'No food logged for this day'} description="Add foods to any meal, or copy meals from a previous day." action={<Button onClick={() => openAddFood({ date })}><Plus /> Log your first food</Button>} />
            </Card>
          )}
          {filtered && meals.every((m) => m.entries.length === 0) ? (
            <Card><EmptyState icon={Search} title="No matching entries" description="Try a different search term or meal filter." /></Card>
          ) : (
            <div className="space-y-3">
              {meals.map((m) => (
                <MealCard key={`${m.meal}-${date}`} summary={m} date={date} time={user?.meals.find((x) => x.id === m.meal)?.time} />
              ))}
            </div>
          )}
          {shownTotals && shownTotals.count > 0 && (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[520px] text-[13px]">
                <caption className="px-5 pt-4 text-left text-[15px] font-semibold text-ink">{filtered ? 'Totals (filtered)' : 'Daily totals'}</caption>
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-muted">
                    <th scope="col" className="px-5 py-2 font-medium">Meal</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">kcal</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Protein</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Carbs</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Fat</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Fiber</th>
                    <th scope="col" className="px-5 py-2 text-right font-medium">Sodium</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular">
                  {meals.filter((m) => m.entries.length).map((m) => (
                    <tr key={m.meal}>
                      <th scope="row" className="px-5 py-2 text-left font-normal text-ink">{m.name}</th>
                      <td className="px-3 py-2 text-right">{formatKcal(m.totals.values.calories)}</td>
                      <td className="px-3 py-2 text-right">{formatNutrient(m.totals.values.protein)} g</td>
                      <td className="px-3 py-2 text-right">{formatNutrient(m.totals.values.carbs)} g</td>
                      <td className="px-3 py-2 text-right">{formatNutrient(m.totals.values.fat)} g</td>
                      <td className="px-3 py-2 text-right">{formatNutrient(m.totals.values.fiber)} g</td>
                      <td className="px-5 py-2 text-right">{formatNutrient(m.totals.values.sodium, 'sodium')} mg</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-2 font-semibold">
                    <th scope="row" className="px-5 py-2.5 text-left">Total</th>
                    <td className="px-3 py-2.5 text-right">{formatKcal(shownTotals.values.calories)}</td>
                    <td className="px-3 py-2.5 text-right">{formatNutrient(shownTotals.values.protein)} g</td>
                    <td className="px-3 py-2.5 text-right">{formatNutrient(shownTotals.values.carbs)} g</td>
                    <td className="px-3 py-2.5 text-right">{formatNutrient(shownTotals.values.fat)} g</td>
                    <td className="px-3 py-2.5 text-right">{formatNutrient(shownTotals.values.fiber)} g</td>
                    <td className="px-5 py-2.5 text-right">{formatNutrient(shownTotals.values.sodium, 'sodium')} mg</td>
                  </tr>
                </tbody>
              </table>
              {(shownTotals.missing.fiber > 0 || shownTotals.missing.sodium > 0) && (
                <p className="px-5 pb-4 pt-1 text-[11.5px] text-muted">Totals include only reported values; some foods don't report fiber or sodium.</p>
              )}
            </Card>
          )}
        </>
      ) : null}

      <CopyDayDialog open={copyOpen} onOpenChange={setCopyOpen} targetDate={date} />
    </div>
  );
}
