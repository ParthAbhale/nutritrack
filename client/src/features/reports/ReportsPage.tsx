import { useMemo, useState } from 'react';
import { BarChart3, CalendarCheck, Download, Droplets, Flame, Target } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { toast } from 'sonner';
import { addDays, diffInDays, isValidDateString, kgToLb, macroCalories, monthBounds, parseDateString, type RangeAnalytics, type RangeDay } from '@nutritrack/shared';
import { useToday } from '@/hooks/useToday';
import { useRangeAnalytics } from '@/services/analytics';
import { useMe } from '@/services/auth';
import { downloadFile, errorMessage } from '@/lib/api';
import { formatKcal, formatNutrient, formatWater, percent } from '@/lib/format';
import { useAddFoodStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ChartSkeleton, DonutSkeleton, LoadingRegion, Skeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { ProgressBar } from '@/components/charts/progress';
import {
  BAR_RADIUS, CHART_COLORS, ChartDataTable, LegendItem, MAX_BAR, StatTile, TooltipCard, axisProps, compactTick, gridProps, longDate, shortDate,
} from '@/components/charts/chartKit';

type Preset = '7' | '30' | 'month' | 'custom';
const MAX_RANGE_DAYS = 366;

const PRESETS: { id: Preset; label: string }[] = [
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

function presetRange(preset: Exclude<Preset, 'custom'>, today: string) {
  if (preset === 'month') {
    const p = parseDateString(today)!;
    return { from: monthBounds(p.year, p.month).from, to: today };
  }
  return { from: addDays(today, -(Number(preset) - 1)), to: today };
}

function validateRange(from: string, to: string): string | null {
  if (!isValidDateString(from) || !isValidDateString(to)) return 'Choose valid start and end dates.';
  if (from > to) return 'The start date must be on or before the end date.';
  if (diffInDays(to, from) + 1 > MAX_RANGE_DAYS) return `Reports can cover at most ${MAX_RANGE_DAYS} days.`;
  return null;
}

export default function ReportsPage() {
  const today = useToday();
  const [preset, setPreset] = useState<Preset>('30');
  const [custom, setCustom] = useState(() => ({ from: addDays(today, -13), to: today }));
  const [exporting, setExporting] = useState(false);

  const range = preset === 'custom' ? custom : presetRange(preset, today);
  const rangeError = validateRange(range.from, range.to);
  const query = useRangeAnalytics(range.from, range.to, !rangeError);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile('/exports/diary.csv', { from: range.from, to: range.to }, `nutritrack-diary-${range.from}-to-${range.to}.csv`);
      toast.success('Diary exported as CSV');
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed. Please try again.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Calories, macros, hydration, weight and goal adherence for any period up to a year."
        actions={
          <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={Boolean(rangeError)}>
            <Download /> Export CSV
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div role="radiogroup" aria-label="Report period" className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={preset === p.id}
                onClick={() => setPreset(p.id)}
                className={cn(
                  'h-9 rounded-[var(--radius-control)] border px-3 text-[13px] font-medium transition-colors',
                  preset === p.id ? 'border-primary bg-soft text-primary' : 'border-line bg-surface text-muted hover:text-ink',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3 lg:ml-auto lg:w-80">
              <Field label="From">{(p) => <Input {...p} type="date" max={custom.to} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />}</Field>
              <Field label="To">{(p) => <Input {...p} type="date" min={custom.from} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />}</Field>
            </div>
          )}
          {preset !== 'custom' && !rangeError && (
            <p className="text-[13px] text-muted lg:ml-auto">
              {longDate(range.from)} – {longDate(range.to)}
            </p>
          )}
        </div>
        {rangeError && (
          <p role="alert" className="mt-3 text-[13px] text-danger">
            {rangeError}
          </p>
        )}
      </Card>

      {rangeError ? null : query.isPending ? (
        <ReportsSkeleton />
      ) : query.isError ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      ) : (
        <ReportBody data={query.data} refreshing={query.isFetching} />
      )}
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <LoadingRegion label="Loading report" className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="space-y-3 p-4">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <ChartSkeleton />
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <DonutSkeleton />
        </Card>
        <Card className="p-5">
          <ChartSkeleton className="h-48" />
        </Card>
      </div>
    </LoadingRegion>
  );
}

function ReportBody({ data, refreshing }: { data: RangeAnalytics; refreshing: boolean }) {
  const { data: user } = useMe();
  const openAddFood = useAddFoodStore((s) => s.openAddFood);
  const units = user?.unitSystem ?? 'metric';
  const { stats, days } = data;
  const hasWater = days.some((d) => d.waterMl > 0);
  const hasWeight = days.some((d) => d.weightKg !== null);

  if (stats.daysLogged === 0 && !hasWater && !hasWeight) {
    return (
      <Card>
        <EmptyState
          icon={BarChart3}
          title="No data in this period"
          description="Nothing was logged between these dates. Days without entries are treated as unknown, not as zero calories."
          action={<Button onClick={() => openAddFood()}>Log a food</Button>}
        />
      </Card>
    );
  }

  const loggedDays = stats.daysLogged;
  return (
    <div className={cn('space-y-5 transition-opacity', refreshing && 'opacity-70')} aria-busy={refreshing}>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile
          icon={<Flame className="size-4 text-primary" aria-hidden />}
          label="Average calories"
          value={stats.averages.calories === null ? '—' : `${formatKcal(stats.averages.calories)} kcal`}
          sub={loggedDays ? `per logged day (${loggedDays} day${loggedDays === 1 ? '' : 's'})` : 'no logged days'}
        />
        <StatTile
          icon={<CalendarCheck className="size-4 text-primary" aria-hidden />}
          label="Logging consistency"
          value={percent(stats.consistencyPercent)}
          sub={`${stats.daysLogged} of ${stats.elapsedDays} elapsed day${stats.elapsedDays === 1 ? '' : 's'} logged`}
        />
        <StatTile
          icon={<Target className="size-4 text-primary" aria-hidden />}
          label="Days meeting calorie goal"
          value={`${stats.daysMeetingCalorieGoal}`}
          sub={loggedDays ? `of ${loggedDays} logged day${loggedDays === 1 ? '' : 's'} (within ±10%)` : 'no logged days'}
        />
        <StatTile
          icon={<Droplets className="size-4 text-water" aria-hidden />}
          label="Average water"
          value={stats.averageWaterMl === null ? '—' : formatWater(stats.averageWaterMl, units)}
          sub={hasWater ? 'per day with water logged' : 'no water logged'}
        />
      </div>

      <CaloriesChart days={days} />

      <div className="grid gap-5 lg:grid-cols-2">
        <MacroCard data={data} />
        <AdherenceCard days={days} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <HydrationChart days={days} units={units} />
        <WeightChart days={days} units={units} hasWeight={hasWeight} />
      </div>

      {(stats.highestDay || stats.lowestDay) && (
        <Card className="p-5">
          <dl className="grid gap-4 text-[13px] sm:grid-cols-2">
            {stats.highestDay && (
              <div>
                <dt className="text-muted">Highest-calorie logged day</dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {longDate(stats.highestDay.date)} · {formatKcal(stats.highestDay.calories)} kcal
                </dd>
              </div>
            )}
            {stats.lowestDay && (
              <div>
                <dt className="text-muted">Lowest-calorie logged day</dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {longDate(stats.lowestDay.date)} · {formatKcal(stats.lowestDay.calories)} kcal
                </dd>
              </div>
            )}
          </dl>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------- calories chart ------------------------------- */

interface CaloriePoint {
  date: string;
  label: string;
  calories: number | null;
  target: number | null;
  logged: boolean;
}

function CaloriesChart({ days }: { days: RangeDay[] }) {
  const points: CaloriePoint[] = days.map((d) => ({ date: d.date, label: shortDate(d.date), calories: d.logged ? d.calories : null, target: d.calorieTarget, logged: d.logged }));
  const hasTarget = points.some((p) => p.target !== null);
  const logged = points.filter((p) => p.logged);
  const summary = logged.length
    ? `Daily calories for ${logged.length} logged days. Highest ${formatKcal(Math.max(...logged.map((p) => p.calories ?? 0)))} kcal. Days without entries are shown as gaps.`
    : 'No days with food entries in this period.';

  return (
    <Card>
      <CardHeader
        title="Calories per day"
        description="Bars show logged days only. Gaps are days with no entries, not zero calories."
        action={
          <div className="hidden gap-3 sm:flex">
            <LegendItem color={CHART_COLORS.primary} label="Calories" />
            {hasTarget && <LegendItem color={CHART_COLORS.reference} label="Daily target" line />}
          </div>
        }
      />
      <CardBody>
        <p className="sr-only">{summary}</p>
        <div className="h-64" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="20%">
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis {...axisProps} tickFormatter={compactTick} width={48} />
              <Tooltip
                cursor={{ fill: 'var(--soft)' }}
                content={(p) => {
                  const pt = (p.payload?.[0] as { payload?: CaloriePoint } | undefined)?.payload;
                  if (!p.active || !pt) return null;
                  return (
                    <TooltipCard
                      title={longDate(pt.date)}
                      rows={[
                        { label: 'Calories', value: pt.logged ? `${formatKcal(pt.calories)} kcal` : 'No entries logged', color: CHART_COLORS.primary },
                        ...(pt.target !== null ? [{ label: 'Target', value: `${pt.target} kcal` }] : []),
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="calories" fill={CHART_COLORS.primary} radius={BAR_RADIUS} maxBarSize={MAX_BAR} isAnimationActive={false} />
              {hasTarget && <Line type="stepAfter" dataKey="target" stroke={CHART_COLORS.reference} strokeOpacity={0.55} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex gap-3 sm:hidden">
          <LegendItem color={CHART_COLORS.primary} label="Calories" />
          {hasTarget && <LegendItem color={CHART_COLORS.reference} label="Daily target" line />}
        </div>
        <ChartDataTable
          caption="Calories per day"
          headers={['Date', 'Calories (kcal)', 'Target (kcal)']}
          rows={points.map((p) => [longDate(p.date), p.logged ? formatKcal(p.calories) : 'Not logged', p.target ?? '—'])}
        />
      </CardBody>
    </Card>
  );
}

/* --------------------------------- macros card -------------------------------- */

function MacroCard({ data }: { data: RangeAnalytics }) {
  const { stats } = data;
  const mc = macroCalories(stats.totals.values);
  const slices = [
    { key: 'protein', label: 'Protein', kcal: mc.protein, avg: stats.averages.protein, color: CHART_COLORS.protein },
    { key: 'carbs', label: 'Carbohydrates', kcal: mc.carbs, avg: stats.averages.carbs, color: CHART_COLORS.carbs },
    { key: 'fat', label: 'Fat', kcal: mc.fat, avg: stats.averages.fat, color: CHART_COLORS.fat },
  ] as const;
  const total = mc.total;
  const anyMissing = stats.totals.missing.protein + stats.totals.missing.carbs + stats.totals.missing.fat > 0;

  return (
    <Card>
      <CardHeader title="Macro distribution" description="Share of calories from each macro, using 4 / 4 / 9 kcal per gram." />
      <CardBody>
        {total <= 0 ? (
          <p className="py-8 text-center text-[13px] text-muted">No macro data was logged in this period.</p>
        ) : (
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div className="relative size-40 shrink-0" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices.map((s) => ({ name: s.label, value: s.kcal ?? 0 }))} dataKey="value" innerRadius="68%" outerRadius="100%" paddingAngle={1.5} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
                    {slices.map((s) => (
                      <Cell key={s.key} fill={s.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-semibold tabular text-ink">{formatKcal(total)}</span>
                <span className="text-[11px] text-muted">kcal from macros</span>
              </div>
            </div>
            <ul className="w-full space-y-3">
              {slices.map((s) => (
                <li key={s.key} className="flex items-center gap-3 text-[13px]">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
                  <span className="flex-1 text-ink">{s.label}</span>
                  <span className="tabular text-muted">{s.avg === null ? '—' : `${formatNutrient(s.avg)} g/day`}</span>
                  <span className="w-12 text-right font-semibold tabular text-ink">{s.kcal === null ? '—' : percent((s.kcal / total) * 100)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          Averages are per logged day. Label calories ({formatKcal(stats.totals.values.calories)} kcal in total) can differ from macro-derived calories because of rounding, fiber, sugar alcohols, alcohol and source data.
          {anyMissing && ' Some entries did not report every macro; those values are excluded rather than counted as zero.'}
        </p>
      </CardBody>
    </Card>
  );
}

/* ------------------------------- goal adherence ------------------------------- */

function AdherenceCard({ days }: { days: RangeDay[] }) {
  const logged = days.filter((d) => d.logged);
  const counts = { met: 0, under: 0, over: 0, 'no-target': 0 };
  for (const d of logged) if (d.status in counts) counts[d.status as keyof typeof counts] += 1;
  const rows = [
    { key: 'met', label: 'Within 10% of goal', count: counts.met, bar: 'bg-success' },
    { key: 'under', label: 'Below goal', count: counts.under, bar: 'bg-warning' },
    { key: 'over', label: 'Above goal', count: counts.over, bar: 'bg-danger' },
    { key: 'no-target', label: 'No goal set', count: counts['no-target'], bar: 'bg-primary' },
  ].filter((r) => r.key !== 'no-target' || r.count > 0);

  return (
    <Card>
      <CardHeader title="Goal adherence" description="How logged days compare with the calorie goal that applied on each day." />
      <CardBody className="space-y-4">
        {logged.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted">No logged days in this period.</p>
        ) : (
          rows.map((r) => (
            <div key={r.key}>
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="text-ink">{r.label}</span>
                <span className="tabular text-muted">
                  {r.count} day{r.count === 1 ? '' : 's'} · {percent((r.count / logged.length) * 100)}
                </span>
              </div>
              <ProgressBar percent={(r.count / logged.length) * 100} colorClass={r.bar} label={`${r.label}: ${r.count} of ${logged.length} logged days`} />
            </div>
          ))
        )}
        <p className="text-[12px] text-muted">Days without entries aren't counted here. Missing logs never count as a missed or met goal.</p>
      </CardBody>
    </Card>
  );
}

/* ------------------------------- hydration chart ------------------------------ */

function HydrationChart({ days, units }: { days: RangeDay[]; units: 'metric' | 'imperial' }) {
  const points = days.map((d) => ({ date: d.date, label: shortDate(d.date), water: d.waterMl > 0 ? d.waterMl : null }));
  const withWater = points.filter((p) => p.water !== null);
  return (
    <Card>
      <CardHeader title="Hydration" description="Water logged per day." />
      <CardBody>
        {withWater.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted">No water logged in this period.</p>
        ) : (
          <>
            <p className="sr-only">Water logged on {withWater.length} days in this period.</p>
            <div className="h-48" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                  <YAxis {...axisProps} width={48} tickFormatter={(v: number) => (units === 'imperial' ? String(Math.round(v / 29.5735)) : compactTick(v))} />
                  <Tooltip
                    cursor={{ fill: 'var(--soft)' }}
                    content={(p) => {
                      const pt = (p.payload?.[0] as { payload?: (typeof points)[number] } | undefined)?.payload;
                      if (!p.active || !pt) return null;
                      return <TooltipCard title={longDate(pt.date)} rows={[{ label: 'Water', value: pt.water === null ? 'None logged' : formatWater(pt.water, units), color: CHART_COLORS.water }]} />;
                    }}
                  />
                  <Bar dataKey="water" fill={CHART_COLORS.water} radius={BAR_RADIUS} maxBarSize={MAX_BAR} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[11px] text-subtle">Axis in {units === 'imperial' ? 'fl oz' : 'ml'}</p>
            <ChartDataTable caption="Water per day" headers={['Date', 'Water']} rows={withWater.map((p) => [longDate(p.date), formatWater(p.water!, units)])} />
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* -------------------------------- weight chart -------------------------------- */

function WeightChart({ days, units, hasWeight }: { days: RangeDay[]; units: 'metric' | 'imperial'; hasWeight: boolean }) {
  const points = useMemo(
    () => days.filter((d) => d.weightKg !== null).map((d) => ({ date: d.date, label: shortDate(d.date), weight: units === 'imperial' ? kgToLb(d.weightKg!) : d.weightKg! })),
    [days, units],
  );
  const first = points[0];
  const last = points.at(-1);
  const change = first && last && points.length > 1 ? last.weight - first.weight : null;
  const unit = units === 'imperial' ? 'lb' : 'kg';
  return (
    <Card>
      <CardHeader title="Weight" description="Recorded weigh-ins in this period." />
      <CardBody>
        {!hasWeight ? (
          <p className="py-8 text-center text-[13px] text-muted">No weight recorded in this period.</p>
        ) : (
          <>
            {change !== null && (
              <p className="mb-2 text-[13px] text-muted">
                Change: <span className="font-semibold tabular text-ink">{change > 0 ? '+' : ''}{change.toFixed(1)} {unit}</span> ({points.length} weigh-ins)
              </p>
            )}
            <p className="sr-only">
              {points.length} weigh-ins{first && last ? `, from ${first.weight.toFixed(1)} ${unit} to ${last.weight.toFixed(1)} ${unit}` : ''}.
            </p>
            <div className="h-48" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                  <YAxis {...axisProps} width={48} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v: number) => v.toFixed(0)} />
                  <Tooltip
                    content={(p) => {
                      const pt = (p.payload?.[0] as { payload?: (typeof points)[number] } | undefined)?.payload;
                      if (!p.active || !pt) return null;
                      return <TooltipCard title={longDate(pt.date)} rows={[{ label: 'Weight', value: `${pt.weight.toFixed(1)} ${unit}`, color: CHART_COLORS.primary }]} />;
                    }}
                  />
                  <Line type="monotone" dataKey="weight" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 4, fill: CHART_COLORS.primary, stroke: CHART_COLORS.surface, strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[12px] text-muted">Scale weight varies day to day and doesn't show whether changes come from fat, muscle or water.</p>
            <ChartDataTable caption="Weight per weigh-in" headers={['Date', `Weight (${unit})`]} rows={points.map((p) => [longDate(p.date), p.weight.toFixed(1)])} />
          </>
        )}
      </CardBody>
    </Card>
  );
}
