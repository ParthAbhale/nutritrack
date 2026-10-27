import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Droplets, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { addDays, eachDate, flOzToMl, isValidDateString, kgToLb, lbToKg, mlToFlOz, type HydrationLog, type WeightLog } from '@nutritrack/shared';
import { useToday } from '@/hooks/useToday';
import { useMe } from '@/services/auth';
import { useHydrationDay, useHydrationHistory, useHydrationMutations, useWeightMutations, useWeights } from '@/services/tracking';
import { errorMessage } from '@/lib/api';
import { formatDate, formatWater, formatWeight } from '@/lib/format';
import { cn, newRequestId } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm';
import { ChartSkeleton, ListSkeleton, Skeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState, InlineError } from '@/components/feedback/states';
import { ProgressBar } from '@/components/charts/progress';
import { BAR_RADIUS, CHART_COLORS, ChartDataTable, MAX_BAR, TooltipCard, axisProps, gridProps, longDate, shortDate } from '@/components/charts/chartKit';

type Units = 'metric' | 'imperial';

export default function TrackingPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'water' ? 'water' : 'weight';
  return (
    <div className="space-y-5">
      <PageHeader title="Weight & water" description="Record weigh-ins and hydration, and see how they trend over time." />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          if (v === 'water') next.set('tab', 'water');
          else next.delete('tab');
          setParams(next, { replace: true });
        }}
      >
        <TabsList aria-label="Tracking type">
          <TabsTrigger value="weight">
            <Scale /> Weight
          </TabsTrigger>
          <TabsTrigger value="water">
            <Droplets /> Water
          </TabsTrigger>
        </TabsList>
        <TabsContent value="weight" className="mt-5">
          <WeightTab />
        </TabsContent>
        <TabsContent value="water" className="mt-5">
          <WaterTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =================================== weight =================================== */

const RANGES = [
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '90 days', days: 90 },
  { id: '365', label: '1 year', days: 365 },
  { id: 'all', label: 'All', days: null },
] as const;

const toDisplayWeight = (kg: number, units: Units) => (units === 'imperial' ? kgToLb(kg) : kg);
const toKg = (value: number, units: Units) => (units === 'imperial' ? lbToKg(value) : value);

function parseWeightInput(text: string, units: Units): { kg: number } | { error: string } {
  const n = Number(text.replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(n)) return { error: 'Enter your weight' };
  const kg = toKg(n, units);
  if (kg < 20 || kg > 400) return { error: units === 'imperial' ? 'Enter a weight between 44 and 880 lb' : 'Enter a weight between 20 and 400 kg' };
  return { kg };
}

function WeightTab() {
  const today = useToday();
  const { data: user } = useMe();
  const units: Units = user?.unitSystem ?? 'metric';
  const unit = units === 'imperial' ? 'lb' : 'kg';
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]['id']>('90');
  const range = RANGES.find((r) => r.id === rangeId)!;
  const from = range.days ? addDays(today, -(range.days - 1)) : undefined;
  const weights = useWeights(from, range.days ? today : undefined);
  const [editing, setEditing] = useState<WeightLog | null>(null);
  const [deleting, setDeleting] = useState<WeightLog | null>(null);
  const { remove } = useWeightMutations();

  const points = useMemo(() => (weights.data ?? []).map((w) => ({ date: w.date, label: shortDate(w.date), weight: toDisplayWeight(w.weightKg, units) })), [weights.data, units]);
  const first = weights.data?.[0];
  const last = weights.data?.at(-1);
  const change = first && last && weights.data!.length > 1 ? toDisplayWeight(last.weightKg, units) - toDisplayWeight(first.weightKg, units) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader title="Log weight" description="One entry per day; logging again on the same date replaces it." />
        <CardBody>
          <WeightForm units={units} today={today} />
        </CardBody>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Trend"
            action={
              <div role="radiogroup" aria-label="Weight range" className="flex flex-wrap gap-1">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={rangeId === r.id}
                    onClick={() => setRangeId(r.id)}
                    className={cn('h-7 rounded-md px-2.5 text-[12px] font-medium', rangeId === r.id ? 'bg-soft text-primary' : 'text-muted hover:text-ink')}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            }
          />
          <CardBody>
            {weights.isPending ? (
              <ChartSkeleton className="h-56" />
            ) : weights.isError ? (
              <ErrorState error={weights.error} onRetry={() => weights.refetch()} compact />
            ) : points.length === 0 ? (
              <EmptyState compact icon={Scale} title="No weigh-ins in this range" description="Log your weight to start a trend line. Weekly weigh-ins at a similar time of day are easiest to compare." />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted">
                  <span>
                    Latest: <span className="font-semibold tabular text-ink">{formatWeight(last!.weightKg, units)}</span> on {formatDate(last!.date, 'd MMM yyyy')}
                  </span>
                  {change !== null && (
                    <span>
                      Change over range:{' '}
                      <span className="font-semibold tabular text-ink">
                        {change > 0 ? '+' : ''}
                        {change.toFixed(1)} {unit}
                      </span>
                    </span>
                  )}
                </div>
                <p className="sr-only">
                  {points.length} weigh-ins from {points[0]!.weight.toFixed(1)} {unit} to {points.at(-1)!.weight.toFixed(1)} {unit}.
                </p>
                <div className="h-56" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="label" {...axisProps} minTickGap={20} />
                      <YAxis {...axisProps} width={48} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v: number) => v.toFixed(0)} />
                      <Tooltip
                        content={(p) => {
                          const pt = (p.payload?.[0] as { payload?: (typeof points)[number] } | undefined)?.payload;
                          if (!p.active || !pt) return null;
                          return <TooltipCard title={longDate(pt.date)} rows={[{ label: 'Weight', value: `${pt.weight.toFixed(1)} ${unit}`, color: CHART_COLORS.primary }]} />;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke={CHART_COLORS.primary}
                        strokeWidth={2}
                        dot={points.length <= 60 ? { r: 4, fill: CHART_COLORS.primary, stroke: CHART_COLORS.surface, strokeWidth: 2 } : false}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">
                  Scale weight naturally fluctuates with water, food and timing. A change in weight doesn't tell you whether it came from fat, muscle or fluid.
                </p>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Weigh-ins" />
          <CardBody>
            {weights.isPending ? (
              <ListSkeleton rows={4} label="Loading weigh-ins" />
            ) : weights.isError ? null : (weights.data ?? []).length === 0 ? (
              <p className="text-[13px] text-muted">No weigh-ins in this range.</p>
            ) : (
              <ul className="divide-y divide-line">
                {[...weights.data!].reverse().map((w) => (
                  <li key={w.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium tabular text-ink">{formatWeight(w.weightKg, units)}</p>
                      <p className="truncate text-[12px] text-muted">
                        {formatDate(w.date)}
                        {w.note && ` · ${w.note}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit weigh-in on ${formatDate(w.date)}`} onClick={() => setEditing(w)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete weigh-in on ${formatDate(w.date)}`} onClick={() => setDeleting(w)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <EditWeightDialog log={editing} units={units} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete weigh-in?"
        description={deleting ? `The ${formatWeight(deleting.weightKg, units)} entry for ${formatDate(deleting.date)} will be permanently deleted.` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success('Weigh-in deleted');
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}

function WeightForm({ units, today }: { units: Units; today: string }) {
  const { upsert } = useWeightMutations();
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ weight?: string; date?: string; submit?: string }>({});

  const submit = async () => {
    const parsed = parseWeightInput(weight, units);
    const next: typeof errors = {};
    if ('error' in parsed) next.weight = parsed.error;
    if (!isValidDateString(date)) next.date = 'Choose a valid date';
    else if (date > today) next.date = "Weigh-ins can't be in the future";
    setErrors(next);
    if (next.weight || next.date || 'error' in parsed) return;
    try {
      await upsert.mutateAsync({ date, weightKg: parsed.kg, note: note.trim() || null });
      toast.success(`Weight recorded for ${formatDate(date, 'd MMM')}`);
      setWeight('');
      setNote('');
    } catch (err) {
      setErrors({ submit: errorMessage(err) });
    }
  };

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label="Date" error={errors.date}>
        {(a) => <Input {...a} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}
      </Field>
      <Field label={`Weight (${units === 'imperial' ? 'lb' : 'kg'})`} error={errors.weight}>
        {(a) => <Input {...a} inputMode="decimal" placeholder={units === 'imperial' ? 'e.g. 165.4' : 'e.g. 72.5'} value={weight} onChange={(e) => setWeight(e.target.value)} />}
      </Field>
      <Field label="Note" optional>
        {(a) => <Textarea {...a} rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. morning, before breakfast" />}
      </Field>
      {errors.submit && <InlineError message={errors.submit} />}
      <Button type="submit" className="w-full" loading={upsert.isPending}>
        <Plus /> Save weight
      </Button>
    </form>
  );
}

function EditWeightDialog({ log, units, onClose }: { log: WeightLog | null; units: Units; onClose: () => void }) {
  return (
    <Dialog open={Boolean(log)} onOpenChange={(o) => !o && onClose()}>
      {log && (
        <DialogContent title="Edit weigh-in" description={formatDate(log.date)}>
          <EditWeightForm key={log.id} log={log} units={units} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function EditWeightForm({ log, units, onClose }: { log: WeightLog; units: Units; onClose: () => void }) {
  const { update } = useWeightMutations();
  const [weight, setWeight] = useState(toDisplayWeight(log.weightKg, units).toFixed(1));
  const [note, setNote] = useState(log.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = parseWeightInput(weight, units);
        if ('error' in parsed) return setError(parsed.error);
        setError(null);
        setSubmitError(null);
        try {
          await update.mutateAsync({ id: log.id, weightKg: parsed.kg, note: note.trim() || null });
          toast.success('Weigh-in updated');
          onClose();
        } catch (err) {
          setSubmitError(errorMessage(err));
        }
      }}
    >
      <Field label={`Weight (${units === 'imperial' ? 'lb' : 'kg'})`} error={error ?? undefined}>
        {(a) => <Input {...a} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />}
      </Field>
      <Field label="Note" optional>
        {(a) => <Textarea {...a} rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      {submitError && <InlineError message={submitError} />}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={update.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

/* ==================================== water =================================== */

function quickAmounts(units: Units) {
  return units === 'imperial' ? [flOzToMl(8), flOzToMl(16)] : [250, 500];
}

function parseWaterInput(text: string, units: Units): { ml: number } | { error: string } {
  const n = Number(text.replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(n) || n <= 0) return { error: 'Enter an amount greater than 0' };
  const ml = units === 'imperial' ? flOzToMl(n) : n;
  if (ml > 5000) return { error: units === 'imperial' ? 'Log at most 169 fl oz at a time' : 'Log at most 5000 ml at a time' };
  return { ml };
}

function WaterTab() {
  const today = useToday();
  const { data: user } = useMe();
  const units: Units = user?.unitSystem ?? 'metric';
  const [date, setDate] = useState(today);
  const validDate = isValidDateString(date) ? date : today;
  const day = useHydrationDay(validDate);
  const { add, remove } = useHydrationMutations();
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HydrationLog | null>(null);
  const [deleting, setDeleting] = useState<HydrationLog | null>(null);

  const log = async (ml: number) => {
    try {
      await add.mutateAsync({ date: validDate, amountMl: ml, clientRequestId: newRequestId('water') });
      toast.success(`Logged ${formatWater(ml, units)} of water`);
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  };

  const total = day.data?.totalMl ?? 0;
  const goal = day.data?.goalMl ?? null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title={validDate === today ? "Today's water" : `Water on ${formatDate(validDate, 'd MMM yyyy')}`}
            action={
              <label className="flex items-center gap-2 text-[12px] text-muted">
                <span className="sr-only">Date</span>
                <Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-[150px] text-[13px]" />
              </label>
            }
          />
          <CardBody className="space-y-4">
            {day.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ) : day.isError ? (
              <ErrorState error={day.error} onRetry={() => day.refetch()} compact />
            ) : (
              <>
                <p className="text-[13px] text-muted">
                  <span className="text-[26px] font-semibold tabular text-ink">{formatWater(total, units)}</span> {goal ? `of ${formatWater(goal, units)} goal` : '· no water goal set'}
                </p>
                <ProgressBar percent={goal ? (total / goal) * 100 : null} colorClass="bg-water" label="Water versus daily goal" />
                {goal !== null && total >= goal && <p className="text-[12.5px] text-success">Daily water goal reached.</p>}
              </>
            )}
            <div className="flex gap-2">
              {quickAmounts(units).map((ml) => (
                <Button key={ml} variant="secondary" className="flex-1" disabled={add.isPending} onClick={() => void log(ml)}>
                  <Plus /> {formatWater(ml, units)}
                </Button>
              ))}
            </div>
            <form
              className="flex items-start gap-2"
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                const parsed = parseWaterInput(custom, units);
                if ('error' in parsed) return setCustomError(parsed.error);
                setCustomError(null);
                if (await log(parsed.ml)) setCustom('');
              }}
            >
              <Field label={`Custom amount (${units === 'imperial' ? 'fl oz' : 'ml'})`} error={customError ?? undefined} className="flex-1">
                {(a) => <Input {...a} inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={units === 'imperial' ? 'e.g. 12' : 'e.g. 330'} />}
              </Field>
              <Button type="submit" className="mt-[26px]" loading={add.isPending}>
                Add
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Entries" description="Individual water logs for this day." />
          <CardBody>
            {day.isPending ? (
              <ListSkeleton rows={3} label="Loading water entries" />
            ) : day.isError ? null : day.data.logs.length === 0 ? (
              <EmptyState compact icon={Droplets} title="No water logged" description="Use the quick-add buttons to record a glass or bottle." />
            ) : (
              <ul className="divide-y divide-line">
                {[...day.data.logs].reverse().map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-soft text-water" aria-hidden>
                      <Droplets className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium tabular text-ink">{formatWater(l.amountMl, units)}</p>
                      <p className="text-[12px] text-muted">{new Date(l.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${formatWater(l.amountMl, units)} entry`} onClick={() => setEditing(l)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${formatWater(l.amountMl, units)} entry`} onClick={() => setDeleting(l)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <WaterHistory today={today} units={units} goal={goal} />

      <EditWaterDialog log={editing} units={units} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete water entry?"
        description={deleting ? `The ${formatWater(deleting.amountMl, units)} entry will be permanently deleted.` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success('Water entry deleted');
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}

function EditWaterDialog({ log, units, onClose }: { log: HydrationLog | null; units: Units; onClose: () => void }) {
  return (
    <Dialog open={Boolean(log)} onOpenChange={(o) => !o && onClose()}>
      {log && (
        <DialogContent title="Edit water entry">
          <EditWaterForm key={log.id} log={log} units={units} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function EditWaterForm({ log, units, onClose }: { log: HydrationLog; units: Units; onClose: () => void }) {
  const { update } = useHydrationMutations();
  const [amount, setAmount] = useState(String(Math.round(units === 'imperial' ? mlToFlOz(log.amountMl) : log.amountMl)));
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = parseWaterInput(amount, units);
        if ('error' in parsed) return setError(parsed.error);
        setError(null);
        setSubmitError(null);
        try {
          await update.mutateAsync({ id: log.id, amountMl: parsed.ml });
          toast.success('Water entry updated');
          onClose();
        } catch (err) {
          setSubmitError(errorMessage(err));
        }
      }}
    >
      <Field label={`Amount (${units === 'imperial' ? 'fl oz' : 'ml'})`} error={error ?? undefined}>
        {(a) => <Input {...a} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
      {submitError && <InlineError message={submitError} />}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={update.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

function WaterHistory({ today, units, goal }: { today: string; units: Units; goal: number | null }) {
  const from = addDays(today, -29);
  const history = useHydrationHistory(from, today);
  const points = useMemo(() => {
    const byDate = new Map((history.data ?? []).map((h) => [h.date, h.totalMl]));
    return eachDate(from, today).map((d) => ({ date: d, label: shortDate(d), ml: byDate.get(d) ?? null }));
  }, [history.data, from, today]);
  const logged = points.filter((p) => p.ml !== null);
  const avg = logged.length ? logged.reduce((s, p) => s + (p.ml ?? 0), 0) / logged.length : null;
  const toUnit = (ml: number) => (units === 'imperial' ? mlToFlOz(ml) : ml);

  return (
    <Card>
      <CardHeader
        title="Last 30 days"
        description={avg !== null ? `Average ${formatWater(avg, units)} on ${logged.length} day${logged.length === 1 ? '' : 's'} with water logged` : 'Daily water totals'}
      />
      <CardBody>
        {history.isPending ? (
          <ChartSkeleton className="h-48" />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} compact />
        ) : logged.length === 0 ? (
          <EmptyState compact icon={Droplets} title="No hydration history yet" description="Water you log will build up a 30-day history here." />
        ) : (
          <>
            <p className="sr-only">Water logged on {logged.length} of the last 30 days{goal ? `, against a goal of ${formatWater(goal, units)}` : ''}.</p>
            <div className="h-48" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points.map((p) => ({ ...p, value: p.ml === null ? null : toUnit(p.ml) }))} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={20} />
                  <YAxis {...axisProps} width={48} tickFormatter={(v: number) => String(Math.round(v))} />
                  <Tooltip
                    cursor={{ fill: 'var(--soft)' }}
                    content={(p) => {
                      const pt = (p.payload?.[0] as { payload?: (typeof points)[number] } | undefined)?.payload;
                      if (!p.active || !pt) return null;
                      return <TooltipCard title={longDate(pt.date)} rows={[{ label: 'Water', value: pt.ml === null ? 'None logged' : formatWater(pt.ml, units), color: CHART_COLORS.water }]} />;
                    }}
                  />
                  <Bar dataKey="value" fill={CHART_COLORS.water} radius={BAR_RADIUS} maxBarSize={MAX_BAR} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[11px] text-subtle">Axis in {units === 'imperial' ? 'fl oz' : 'ml'}</p>
            <ChartDataTable caption="Water per day, last 30 days" headers={['Date', 'Water']} rows={logged.map((p) => [longDate(p.date), formatWater(p.ml!, units)])} />
          </>
        )}
      </CardBody>
    </Card>
  );
}
