import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Award, Calculator, Check, History, Pencil, Plus, Target, Trash2, Trophy } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar } from 'recharts';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  ACTIVITY_LABELS, addDays, ageFromDateOfBirth, estimateEnergyNeeds, goalInputSchema, KCAL_PER_GRAM, kgToLb, lbToKg, milestoneSchema,
  type EnergyEstimate, type GoalInput, type GoalSnapshot, type Milestone,
} from '@nutritrack/shared';
import { useToday } from '@/hooks/useToday';
import { useCurrentGoal, useGoalHistory, useSaveGoal } from '@/services/goals';
import { useRangeAnalytics } from '@/services/analytics';
import { useWeights } from '@/services/tracking';
import { useMe } from '@/services/auth';
import { useMilestones } from '@/services/users';
import { errorMessage } from '@/lib/api';
import { formatDate, formatKcal, formatNutrient, formatWater, percent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Select } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm';
import { ChartSkeleton, FormSkeleton, ListSkeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState, InlineError, Notice } from '@/components/feedback/states';
import { ProgressBar } from '@/components/charts/progress';
import { BAR_RADIUS, CHART_COLORS, ChartDataTable, LegendItem, MAX_BAR, TooltipCard, axisProps, compactTick, gridProps, longDate, shortDate } from '@/components/charts/chartKit';

type GoalFormInput = z.input<typeof goalInputSchema>;

export default function GoalsPage() {
  const current = useCurrentGoal();
  const [editing, setEditing] = useState(false);
  const [prefill, setPrefill] = useState<EnergyEstimate | null>(null);

  const startFromEstimate = (e: EnergyEstimate) => {
    setPrefill(e);
    setEditing(true);
    document.getElementById('goal-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Goals" description="Your daily targets, how you're tracking against them, and their history." />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card id="goal-form">
          {current.isPending ? (
            <CardBody>
              <FormSkeleton fields={5} />
            </CardBody>
          ) : current.isError ? (
            <ErrorState error={current.error} onRetry={() => current.refetch()} />
          ) : editing || !current.data ? (
            <GoalForm
              goal={current.data}
              estimate={prefill}
              onDone={() => {
                setEditing(false);
                setPrefill(null);
              }}
              canCancel={Boolean(current.data)}
            />
          ) : (
            <CurrentGoalCard goal={current.data} onEdit={() => setEditing(true)} />
          )}
        </Card>
        <ProgressCard goal={current.data ?? null} loading={current.isPending} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <EstimateCard onUse={startFromEstimate} />
        <HistoryCard />
      </div>

      <MilestonesCard />
    </div>
  );
}

/* --------------------------------- current goal -------------------------------- */

function impliedCalories(protein: number, carbs: number, fat: number) {
  return protein * KCAL_PER_GRAM.protein + carbs * KCAL_PER_GRAM.carbs + fat * KCAL_PER_GRAM.fat;
}

function MacroCheck({ calories, protein, carbs, fat }: { calories: number; protein: number; carbs: number; fat: number }) {
  const implied = impliedCalories(protein, carbs, fat);
  if (!calories || !Number.isFinite(implied)) return null;
  const diff = implied - calories;
  const off = Math.abs(diff) / calories > 0.05;
  return (
    <p className={cn('text-[12.5px]', off ? 'text-warning-ink' : 'text-muted')}>
      Your macro targets add up to <span className="font-semibold tabular">{formatKcal(implied)} kcal</span> (4/4/9 kcal per gram)
      {off ? `, ${formatKcal(Math.abs(diff))} kcal ${diff > 0 ? 'above' : 'below'} your calorie target.` : ', consistent with your calorie target.'}
    </p>
  );
}

function CurrentGoalCard({ goal, onEdit }: { goal: GoalSnapshot; onEdit: () => void }) {
  const { data: user } = useMe();
  const units = user?.unitSystem ?? 'metric';
  const items = [
    { label: 'Calories', value: `${goal.calories} kcal` },
    { label: 'Protein', value: `${formatNutrient(goal.protein)} g` },
    { label: 'Carbohydrates', value: `${formatNutrient(goal.carbs)} g` },
    { label: 'Fat', value: `${formatNutrient(goal.fat)} g` },
    { label: 'Fiber', value: goal.fiber === null ? 'Not set' : `${formatNutrient(goal.fiber)} g` },
    { label: 'Water', value: formatWater(goal.waterMl, units) },
  ];
  return (
    <>
      <CardHeader
        title="Daily targets"
        description={`Effective from ${formatDate(goal.effectiveFrom)}`}
        action={
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <Badge tone={goal.source === 'estimate' ? 'primary' : 'neutral'}>{goal.source === 'estimate' ? 'Based on a system estimate' : 'Your target'}</Badge>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((i) => (
            <div key={i.label} className="rounded-xl bg-surface-2 px-3 py-2.5">
              <dt className="text-[12px] text-muted">{i.label}</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular text-ink">{i.value}</dd>
            </div>
          ))}
        </dl>
        <MacroCheck calories={goal.calories} protein={goal.protein} carbs={goal.carbs} fat={goal.fat} />
      </CardBody>
    </>
  );
}

function GoalForm({ goal, estimate, onDone, canCancel }: { goal: GoalSnapshot | null | undefined; estimate: EnergyEstimate | null; onDone: () => void; canCancel: boolean }) {
  const today = useToday();
  const { data: user } = useMe();
  const save = useSaveGoal();
  const imperial = user?.unitSystem === 'imperial';
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaults = (): GoalFormInput => ({
    effectiveFrom: today,
    calories: estimate?.suggestedCalories ?? goal?.calories ?? 2000,
    protein: estimate?.protein ?? goal?.protein ?? 120,
    carbs: estimate?.carbs ?? goal?.carbs ?? 220,
    fat: estimate?.fat ?? goal?.fat ?? 70,
    fiber: goal?.fiber ?? null,
    waterMl: estimate?.waterMl ?? goal?.waterMl ?? 2000,
    source: estimate ? 'estimate' : 'manual',
  });

  const { register, handleSubmit, formState, watch, reset, setValue } = useForm<GoalFormInput, unknown, GoalInput>({
    resolver: zodResolver(goalInputSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimate, goal?.id]);

  const markManual = { onChange: () => setValue('source', 'manual') };
  const num = (v: unknown) => (v === '' || v === null || v === undefined ? Number.NaN : Number(v));
  const [cal, p, c, f] = watch(['calories', 'protein', 'carbs', 'fat']);
  const source = watch('source');

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await save.mutateAsync(values);
      toast.success(values.effectiveFrom && values.effectiveFrom > today ? `Goal scheduled from ${formatDate(values.effectiveFrom)}` : 'Goal saved');
      onDone();
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  });

  return (
    <>
      <CardHeader title={goal ? 'Edit daily targets' : 'Set your daily targets'} description="Saving creates a new goal version from the chosen date." />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {source === 'estimate' && (
            <Notice icon={Calculator}>These values come from a population-based estimate. Review and adjust them before saving; they are not medical advice.</Notice>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Calories (kcal)" error={formState.errors.calories?.message} className="col-span-2 sm:col-span-1">
              {(a) => <Input {...a} inputMode="numeric" {...register('calories', { setValueAs: num, ...markManual })} />}
            </Field>
            <Field label="Effective from" error={formState.errors.effectiveFrom?.message} className="col-span-2 sm:col-span-1">
              {(a) => <Input {...a} type="date" {...register('effectiveFrom')} />}
            </Field>
            <Field label="Protein (g)" error={formState.errors.protein?.message}>
              {(a) => <Input {...a} inputMode="decimal" {...register('protein', { setValueAs: num, ...markManual })} />}
            </Field>
            <Field label="Carbohydrates (g)" error={formState.errors.carbs?.message}>
              {(a) => <Input {...a} inputMode="decimal" {...register('carbs', { setValueAs: num, ...markManual })} />}
            </Field>
            <Field label="Fat (g)" error={formState.errors.fat?.message}>
              {(a) => <Input {...a} inputMode="decimal" {...register('fat', { setValueAs: num, ...markManual })} />}
            </Field>
            <Field label="Fiber (g)" optional error={formState.errors.fiber?.message}>
              {(a) => <Input {...a} inputMode="decimal" {...register('fiber', { setValueAs: (v) => (v === '' || v === null ? null : Number(v)) })} />}
            </Field>
            <Field label={`Water (${imperial ? 'ml; 1 fl oz ≈ 30 ml' : 'ml'})`} error={formState.errors.waterMl?.message} className="col-span-2">
              {(a) => <Input {...a} inputMode="numeric" {...register('waterMl', { setValueAs: num, ...markManual })} />}
            </Field>
          </div>
          <MacroCheck calories={Number(cal)} protein={Number(p)} carbs={Number(c)} fat={Number(f)} />
          <p className="text-[12px] leading-relaxed text-muted">
            Past days keep the goal that was in effect on that day, so changing a goal never rewrites your history. Choosing today replaces any goal already starting today.
          </p>
          {submitError && <InlineError message={submitError} />}
          <div className="flex justify-end gap-2">
            {canCancel && (
              <Button variant="secondary" onClick={onDone} disabled={save.isPending}>
                Cancel
              </Button>
            )}
            <Button type="submit" loading={save.isPending}>
              Save goal
            </Button>
          </div>
        </form>
      </CardBody>
    </>
  );
}

/* ---------------------------------- progress ---------------------------------- */

function ProgressCard({ goal, loading }: { goal: GoalSnapshot | null; loading: boolean }) {
  const today = useToday();
  const from = addDays(today, -29);
  const range = useRangeAnalytics(from, today);

  const summary = useMemo(() => {
    if (!range.data) return null;
    const days = range.data.days;
    const avg = (list: typeof days) => {
      const logged = list.filter((d) => d.logged && d.calories !== null);
      return logged.length ? { kcal: logged.reduce((s, d) => s + (d.calories ?? 0), 0) / logged.length, n: logged.length } : null;
    };
    return { week: avg(days.slice(-7)), month: avg(days), points: days.map((d) => ({ date: d.date, label: shortDate(d.date), calories: d.logged ? d.calories : null, target: d.calorieTarget, logged: d.logged })) };
  }, [range.data]);

  return (
    <Card>
      <CardHeader title="Progress" description="Average calories on logged days compared with your target." />
      <CardBody className="space-y-5">
        {loading || range.isPending ? (
          <>
            <ListSkeleton rows={2} label="Loading progress" />
            <ChartSkeleton className="h-40" />
          </>
        ) : range.isError ? (
          <ErrorState error={range.error} onRetry={() => range.refetch()} compact />
        ) : !summary || (!summary.week && !summary.month) ? (
          <EmptyState compact icon={Target} title="No logged days yet" description="Log meals for a few days to see how your intake compares with your goal." />
        ) : (
          <>
            {[
              { label: 'Last 7 days', v: summary.week },
              { label: 'Last 30 days', v: summary.month },
            ].map(({ label, v }) => (
              <div key={label}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-medium text-ink">{label}</span>
                  <span className="tabular text-muted">
                    {v ? `${formatKcal(v.kcal)} kcal/day avg · ${v.n} logged day${v.n === 1 ? '' : 's'}` : 'No logged days'}
                    {v && goal && ` · ${percent((v.kcal / goal.calories) * 100)} of ${goal.calories}`}
                  </span>
                </div>
                <ProgressBar percent={v && goal ? (v.kcal / goal.calories) * 100 : null} label={`${label} average versus calorie target`} />
              </div>
            ))}
            <div>
              <div className="mb-2 flex gap-3">
                <LegendItem color={CHART_COLORS.primary} label="Calories" />
                <LegendItem color={CHART_COLORS.reference} label="Target" line />
              </div>
              <p className="sr-only">Daily calories for the last 30 days compared with the target that applied each day. Gaps are days without entries.</p>
              <div className="h-40" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={summary.points} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                    <YAxis {...axisProps} width={44} tickFormatter={compactTick} />
                    <Tooltip
                      cursor={{ fill: 'var(--soft)' }}
                      content={(tp) => {
                        const pt = (tp.payload?.[0] as { payload?: (typeof summary.points)[number] } | undefined)?.payload;
                        if (!tp.active || !pt) return null;
                        return (
                          <TooltipCard
                            title={longDate(pt.date)}
                            rows={[
                              { label: 'Calories', value: pt.logged ? `${formatKcal(pt.calories)} kcal` : 'No entries', color: CHART_COLORS.primary },
                              ...(pt.target !== null ? [{ label: 'Target', value: `${pt.target} kcal` }] : []),
                            ]}
                          />
                        );
                      }}
                    />
                    <Bar dataKey="calories" fill={CHART_COLORS.primary} radius={BAR_RADIUS} maxBarSize={MAX_BAR} isAnimationActive={false} />
                    <Line type="stepAfter" dataKey="target" stroke={CHART_COLORS.reference} strokeOpacity={0.55} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <ChartDataTable
                caption="Calories versus target, last 30 days"
                headers={['Date', 'Calories (kcal)', 'Target (kcal)']}
                rows={summary.points.map((pt) => [longDate(pt.date), pt.logged ? formatKcal(pt.calories) : 'Not logged', pt.target ?? '—'])}
              />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------------------------- estimate ---------------------------------- */

function EstimateCard({ onUse }: { onUse: (e: EnergyEstimate) => void }) {
  const today = useToday();
  const { data: user } = useMe();
  const weights = useWeights();
  if (!user) return null;
  const latest = weights.data?.at(-1);
  const missing: string[] = [];
  if (!user.heightCm) missing.push('height');
  if (!latest) missing.push('a weight entry');
  if (!user.activityLevel) missing.push('activity level');

  let estimate: EnergyEstimate | null = null;
  if (missing.length === 0 && latest && user.heightCm && user.activityLevel) {
    estimate = estimateEnergyNeeds({
      weightKg: latest.weightKg,
      heightCm: user.heightCm,
      ageYears: user.dateOfBirth ? ageFromDateOfBirth(user.dateOfBirth, today) : null,
      sex: user.sex,
      activityLevel: user.activityLevel,
      goal: user.weightGoal ?? 'maintain',
    });
  }

  return (
    <Card>
      <CardHeader title="Estimate from your profile" description="A starting point from the Mifflin–St Jeor equation. It never changes your goal unless you save it." />
      <CardBody className="space-y-4">
        {weights.isPending ? (
          <ListSkeleton rows={2} label="Loading profile data" />
        ) : weights.isError ? (
          <ErrorState error={weights.error} onRetry={() => weights.refetch()} compact />
        ) : !estimate ? (
          <Notice icon={Calculator}>
            Add {missing.join(', ')} to get an estimate.{' '}
            {missing.includes('a weight entry') && (
              <Link to="/tracking" className="font-medium text-primary">
                Log weight
              </Link>
            )}
            {missing.includes('a weight entry') && (missing.includes('height') || missing.includes('activity level')) && ' · '}
            {(missing.includes('height') || missing.includes('activity level')) && (
              <Link to="/settings" className="font-medium text-primary">
                Update profile
              </Link>
            )}
          </Notice>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
              {[
                ['Maintenance', `${estimate.maintenanceCalories} kcal`],
                ['Suggested', `${estimate.suggestedCalories} kcal`],
                ['Protein / carbs / fat', `${estimate.protein} / ${estimate.carbs} / ${estimate.fat} g`],
                ['Water', formatWater(estimate.waterMl, user.unitSystem)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface-2 px-3 py-2">
                  <dt className="text-[11.5px] text-muted">{k}</dt>
                  <dd className="mt-0.5 font-semibold tabular text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[12px] leading-relaxed text-muted">
              Based on {latest && (user.unitSystem === 'imperial' ? `${kgToLb(latest.weightKg).toFixed(1)} lb` : `${latest.weightKg.toFixed(1)} kg`)}, {user.activityLevel && ACTIVITY_LABELS[user.activityLevel].toLowerCase()} and a goal to{' '}
              {user.weightGoal === 'lose' ? 'lose weight' : user.weightGoal === 'gain' ? 'gain weight' : 'maintain weight'}. Population formulas can be off by several hundred kcal for an individual.
              {estimate.notes.map((n) => ` ${n}`)}
            </p>
            <Button variant="soft" onClick={() => onUse(estimate)}>
              <Calculator /> Review these as my goal
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* ----------------------------------- history ---------------------------------- */

function HistoryCard() {
  const today = useToday();
  const history = useGoalHistory();
  const activeId = history.data?.find((g) => g.effectiveFrom <= today)?.id;
  return (
    <Card>
      <CardHeader title="Goal history" description="Each version applies from its effective date until the next one." />
      <CardBody>
        {history.isPending ? (
          <ListSkeleton rows={3} label="Loading goal history" />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} compact />
        ) : history.data.length === 0 ? (
          <EmptyState compact icon={History} title="No goals yet" description="Your saved goals and their effective dates will appear here." />
        ) : (
          <ol className="divide-y divide-line">
            {history.data.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">From {formatDate(g.effectiveFrom)}</p>
                  <p className="text-[12px] tabular text-muted">
                    {g.calories} kcal · P {formatNutrient(g.protein)} g · C {formatNutrient(g.carbs)} g · F {formatNutrient(g.fat)} g
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {g.id === activeId && <Badge tone="success"><Check aria-hidden /> Current</Badge>}
                  {g.effectiveFrom > today && <Badge tone="warning">Scheduled</Badge>}
                  <Badge tone={g.source === 'estimate' ? 'primary' : 'neutral'}>{g.source === 'estimate' ? 'System estimate' : 'Your target'}</Badge>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------------------------- milestones -------------------------------- */

const MILESTONE_TYPES: { id: Milestone['type']; label: string; unit: (imperial: boolean) => string }[] = [
  { id: 'streak_days', label: 'Logging streak (days)', unit: () => 'days' },
  { id: 'days_logged', label: 'Total days logged', unit: () => 'days' },
  { id: 'target_weight', label: 'Reach a weight', unit: (imp) => (imp ? 'lb' : 'kg') },
];

function MilestonesCard() {
  const { data: user } = useMe();
  const { add, remove } = useMilestones();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Milestone['type']>('streak_days');
  const [target, setTarget] = useState('7');
  const [error, setError] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<Milestone | null>(null);
  if (!user) return null;
  const imperial = user.unitSystem === 'imperial';
  const typeMeta = MILESTONE_TYPES.find((t) => t.id === type)!;

  const submit = async () => {
    setError(null);
    const raw = Number(target);
    const value = type === 'target_weight' && imperial ? lbToKg(raw) : raw;
    const parsed = milestoneSchema.safeParse({ title: title.trim() || defaultTitle(type, raw, imperial), type, target: value });
    if (!parsed.success || (type !== 'target_weight' && !Number.isInteger(raw))) {
      setError(parsed.success ? 'Use a whole number of days.' : (parsed.error.issues[0]?.message ?? 'Check the milestone details.'));
      return;
    }
    try {
      await add.mutateAsync(parsed.data);
      setTitle('');
      toast.success('Milestone added');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const describe = (m: Milestone) =>
    m.type === 'target_weight' ? `Weight within 0.5 kg of ${imperial ? `${kgToLb(m.target).toFixed(1)} lb` : `${m.target.toFixed(1)} kg`}` : m.type === 'streak_days' ? `${m.target}-day logging streak` : `${m.target} days logged in total`;

  return (
    <Card>
      <CardHeader title="Milestones" description="Personal markers to celebrate. Missing a day never removes progress you've already made." />
      <CardBody className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {user.milestones.length === 0 ? (
            <EmptyState compact icon={Trophy} title="No milestones yet" description="Add one, like a 7-day logging streak, and we'll notify you when you reach it." />
          ) : (
            <ul className="divide-y divide-line">
              {user.milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', m.achievedAt ? 'bg-success-soft text-success' : 'bg-soft text-primary')} aria-hidden>
                    {m.achievedAt ? <Award className="size-4" /> : <Target className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{m.title}</p>
                    <p className="text-[12px] text-muted">
                      {describe(m)}
                      {m.achievedAt && ` · reached ${new Date(m.achievedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {m.achievedAt && <Badge tone="success"><Check aria-hidden /> Achieved</Badge>}
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove milestone ${m.title}`} onClick={() => setToRemove(m)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form
          className="space-y-3 rounded-xl border border-line bg-surface-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <h3 className="text-[13px] font-semibold text-ink">Add a milestone</h3>
          <Field label="Type">
            {(a) => (
              <Select {...a} value={type} onChange={(e) => setType(e.target.value as Milestone['type'])}>
                {MILESTONE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={`Target (${typeMeta.unit(imperial)})`}>{(a) => <Input {...a} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />}</Field>
          <Field label="Title" optional>
            {(a) => <Input {...a} maxLength={80} value={title} placeholder={defaultTitle(type, Number(target) || 0, imperial)} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          {error && <InlineError message={error} />}
          <Button type="submit" className="w-full" loading={add.isPending}>
            <Plus /> Add milestone
          </Button>
        </form>
      </CardBody>
      <ConfirmDialog
        open={Boolean(toRemove)}
        onOpenChange={(o) => !o && setToRemove(null)}
        title="Remove milestone?"
        description={toRemove ? `"${toRemove.title}" will be removed.` : ''}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!toRemove) return;
          try {
            await remove.mutateAsync(toRemove.id);
            toast.success('Milestone removed');
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </Card>
  );
}

function defaultTitle(type: Milestone['type'], target: number, imperial: boolean) {
  if (type === 'streak_days') return `${target}-day streak`;
  if (type === 'days_logged') return `${target} days logged`;
  return `Reach ${target} ${imperial ? 'lb' : 'kg'}`;
}
