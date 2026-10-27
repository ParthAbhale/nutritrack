import { Beef, Droplet, Flame, Wheat, type LucideIcon } from 'lucide-react';
import type { DailySummary, GoalProgress, NutrientKey } from '@nutritrack/shared';
import { formatNutrient, percent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/charts/progress';

interface MetricDef {
  key: Extract<NutrientKey, 'calories' | 'protein' | 'carbs' | 'fat'>;
  label: string;
  unit: string;
  icon: LucideIcon;
  bar: string;
  tint: string;
}

const METRICS: MetricDef[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', icon: Flame, bar: 'bg-primary', tint: 'bg-soft text-primary' },
  { key: 'protein', label: 'Protein', unit: 'g', icon: Beef, bar: 'bg-protein', tint: 'bg-soft text-protein' },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g', icon: Wheat, bar: 'bg-carbs', tint: 'bg-success-soft text-carbs' },
  { key: 'fat', label: 'Fat', unit: 'g', icon: Droplet, bar: 'bg-fat', tint: 'bg-warning-soft text-fat' },
];

function statusText(p: GoalProgress, unit: string, key: NutrientKey) {
  if (p.status === 'no-target' || p.remaining === null) return 'No target set';
  if (p.remaining >= 0) return `${formatNutrient(p.remaining, key)} ${unit} remaining`;
  return `${formatNutrient(-p.remaining, key)} ${unit} over target`;
}

/** The four daily metric cards. Values come straight from the server summary. */
export function MetricCards({ summary }: { summary: DailySummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {METRICS.map((m) => {
        const p = summary.progress[m.key];
        const missing = summary.totals.missing[m.key];
        const over = p.status === 'over' || (p.remaining !== null && p.remaining < 0);
        const Icon = m.icon;
        return (
          <Card key={m.key} className="min-w-0 p-3.5 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl sm:size-9', m.tint)}>
                <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
              </span>
              <h3 className="truncate text-[13.5px] font-medium text-muted">{m.key === 'carbs' ? <><span className="sm:hidden">Carbs</span><span className="hidden sm:inline">{m.label}</span></> : m.label}</h3>
              <span className={cn('ml-auto text-[12px] font-semibold tabular', over ? 'text-danger' : 'text-muted')}>{percent(p.percent)}</span>
            </div>
            <p className="mt-4 text-[22px] font-semibold leading-none tracking-tight tabular text-ink sm:text-[26px]">
              {formatNutrient(summary.totals.values[m.key] ?? 0, m.key)}
              <span className="ml-1 block text-[12.5px] font-normal text-muted sm:inline sm:text-sm">
                / {p.target === null ? '—' : formatNutrient(p.target, m.key)} {m.unit}
              </span>
            </p>
            <p className={cn('mt-1.5 text-[12.5px]', over ? 'font-medium text-danger' : 'text-muted')}>
              {statusText(p, m.unit, m.key)}
            </p>
            <ProgressBar className="mt-3.5" percent={p.percent} colorClass={m.bar} label={`${m.label} progress`} />
            {missing > 0 && <p className="mt-2 text-[11.5px] text-warning-ink">{missing} entr{missing === 1 ? 'y lacks' : 'ies lack'} {m.label.toLowerCase()} data (not counted)</p>}
          </Card>
        );
      })}
    </div>
  );
}
