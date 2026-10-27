import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import type { DailySummary } from '@nutritrack/shared';
import { formatKcal } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback/states';

const SLICES = [
  { key: 'protein', label: 'Protein', color: 'var(--protein)', factor: '4 kcal/g' },
  { key: 'carbs', label: 'Carbohydrates', color: 'var(--carbs)', factor: '4 kcal/g' },
  { key: 'fat', label: 'Fat', color: 'var(--fat)', factor: '9 kcal/g' },
] as const;

/** Share of energy from each macro using approximate 4/4/9 factors. */
export function MacroDonut({ summary }: { summary: DailySummary }) {
  const mc = summary.macroCalories;
  const data = SLICES.map((s) => ({ ...s, value: mc[s.key] ?? 0 })).filter((d) => d.value > 0);
  const total = mc.total;
  const label = summary.totals.values.calories;
  return (
    <Card className="h-full">
      <CardHeader title="Macro distribution" description="Share of calories from protein, carbs and fat" />
      <CardBody>
        {total <= 0 ? (
          <EmptyState compact icon={PieIcon} title="No macros yet" description="Log food to see where your calories come from." />
        ) : (
          <>
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <div className="relative size-40 shrink-0" role="img" aria-label={`Macro calories: ${data.map((d) => `${d.label} ${Math.round((d.value / total) * 100)}%`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data} dataKey="value" nameKey="label" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                      {data.map((d) => (
                        <Cell key={d.key} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${Math.round(Number(v))} kcal`} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12, color: 'var(--ink)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-semibold tabular text-ink">{Math.round(total)}</span>
                  <span className="text-[11px] text-muted">kcal from macros</span>
                </div>
              </div>
              <ul className="w-full space-y-2.5">
                {SLICES.map((s) => {
                  const v = mc[s.key];
                  const pct = v !== null && total > 0 ? Math.round((v / total) * 100) : null;
                  return (
                    <li key={s.key} className="flex items-center gap-2.5 text-[13px]">
                      <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                      <span className="text-ink" title={`Estimated at ${s.factor}`}>{s.label}</span>
                      <span className="ml-auto whitespace-nowrap tabular text-muted">{v === null ? '—' : `${Math.round(v)} kcal`}</span>
                      <span className="w-10 text-right font-semibold tabular text-ink">{pct === null ? '—' : `${pct}%`}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-muted">
              Logged total: {formatKcal(label)} kcal. Label calories and macro-derived calories can differ because of rounding, fiber, alcohol, food-specific factors and source data.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
