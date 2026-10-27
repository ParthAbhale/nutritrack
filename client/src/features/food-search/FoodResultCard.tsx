import { forwardRef } from 'react';
import { Apple, Check, CircleAlert } from 'lucide-react';
import type { FoodItem } from '@nutritrack/shared';
import { cn } from '@/lib/utils';
import { formatKcal, formatNutrient } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { defaultServingNutrition, PROVIDER_LABEL } from './nutrition';

export function FoodThumb({ food, size = 'md' }: { food: FoodItem; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'size-20 rounded-2xl' : size === 'sm' ? 'size-10 rounded-lg' : 'size-14 rounded-xl';
  return food.imageUrl ? (
    <img src={food.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn(cls, 'shrink-0 border border-line bg-surface-2 object-contain')} />
  ) : (
    <span className={cn(cls, 'flex shrink-0 items-center justify-center bg-soft text-primary')} aria-hidden>
      <Apple className={size === 'sm' ? 'size-4' : 'size-5'} strokeWidth={1.75} />
    </span>
  );
}

interface Props {
  food: FoodItem;
  active?: boolean;
  onSelect: (food: FoodItem) => void;
  id?: string;
  role?: string;
}

/** One search result. Brands are never merged; incomplete data is labelled. */
export const FoodResultCard = forwardRef<HTMLButtonElement, Props>(({ food, active, onSelect, id, role }, ref) => {
  const serving = food.servings.find((s) => s.id === food.defaultServingId);
  const n = defaultServingNutrition(food);
  return (
    <button
      ref={ref}
      id={id}
      role={role}
      aria-selected={role === 'option' ? active : undefined}
      type="button"
      onClick={() => onSelect(food)}
      className={cn(
        'flex w-full items-start gap-3 rounded-[var(--radius-card)] border bg-surface p-3.5 text-left transition-colors hover:border-primary/50 hover:bg-surface-2',
        active ? 'border-primary ring-2 ring-primary/15' : 'border-line',
      )}
    >
      <FoodThumb food={food} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{food.name}</p>
            <p className="truncate text-[12.5px] text-muted">
              {food.brand ?? (food.kind === 'generic' ? 'Generic' : food.kind === 'custom' ? 'Your custom food' : '—')}
              {food.category && <span className="text-subtle"> · {food.category}</span>}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular text-ink">{n ? formatKcal(n.nutrients.calories) : '—'}<span className="ml-0.5 text-xs font-normal text-muted">kcal</span></p>
          </div>
        </div>
        <p className="mt-1 truncate text-[12px] text-muted">{serving?.label ?? 'Serving unavailable'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <MacroChip label="P" value={n?.nutrients.protein} className="text-protein" />
          <MacroChip label="C" value={n?.nutrients.carbs} className="text-carbs" />
          <MacroChip label="F" value={n?.nutrients.fat} className="text-fat" />
          <Badge tone="neutral" className="ml-auto">{PROVIDER_LABEL[food.provider]}</Badge>
          {food.completeness === 'complete' ? (
            <Badge tone="success" title="Calories, protein, carbs and fat are all reported"><Check aria-hidden /> Complete</Badge>
          ) : (
            <Badge tone="warning" title="Some core nutrients are not reported by the source"><CircleAlert aria-hidden /> Partial data</Badge>
          )}
        </div>
      </div>
    </button>
  );
});
FoodResultCard.displayName = 'FoodResultCard';

function MacroChip({ label, value, className }: { label: string; value: number | null | undefined; className?: string }) {
  const names: Record<string, string> = { P: 'Protein', C: 'Carbohydrates', F: 'Fat' };
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted" title={names[label]}>
      <span className={cn('font-semibold', className)} aria-hidden>{label}</span>
      <span className="sr-only">{names[label]}</span>
      <span className="tabular text-ink">{value === null || value === undefined ? '—' : `${formatNutrient(value)} g`}</span>
    </span>
  );
}
