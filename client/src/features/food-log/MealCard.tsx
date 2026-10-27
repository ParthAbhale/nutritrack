import { useState } from 'react';
import { ChevronDown, Coffee, Cookie, Moon, Plus, Sun, type LucideIcon } from 'lucide-react';
import type { Meal, MealSummary } from '@nutritrack/shared';
import { useAddFoodStore } from '@/lib/stores';
import { formatKcal, formatNutrient } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EntryRow } from './EntryRow';

export const MEAL_ICONS: Record<Meal, LucideIcon> = { breakfast: Coffee, lunch: Sun, dinner: Moon, snacks: Cookie };

export function MealCard({ summary, date, defaultOpen = true, time }: { summary: MealSummary; date: string; defaultOpen?: boolean; time?: string | null }) {
  // Follows `defaultOpen` (e.g. opens once food is added) until the user toggles it.
  const [toggled, setOpen] = useState<boolean | null>(null);
  const open = toggled ?? defaultOpen;
  const openAddFood = useAddFoodStore((s) => s.openAddFood);
  const Icon = MEAL_ICONS[summary.meal];
  const t = summary.totals;
  const count = summary.entries.length;
  const panelId = `meal-${summary.meal}-entries`;
  const missingCore = t.missing.calories + t.missing.protein + t.missing.carbs + t.missing.fat;

  return (
    <Card className="min-w-0">
      <div className="flex items-center gap-3 p-4 sm:px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-primary">
          <Icon className="size-5" strokeWidth={1.8} aria-hidden />
        </span>
        <button type="button" className="min-w-0 flex-1 text-left" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
          <span className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-ink">{summary.name}</span>
            {time && <span className="text-[12px] text-subtle">{time}</span>}
            <ChevronDown className={cn('size-4 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
          </span>
          <span className="block truncate text-[12.5px] text-muted">
            {count === 0 ? 'Nothing logged yet' : (
              <>
                {count} item{count === 1 ? '' : 's'} · P {formatNutrient(t.values.protein)}g · C {formatNutrient(t.values.carbs)}g · F {formatNutrient(t.values.fat)}g
              </>
            )}
          </span>
        </button>
        <div className="text-right">
          <p className="text-[15px] font-semibold tabular text-ink">{count ? formatKcal(t.values.calories) : '0'}</p>
          <p className="text-[11px] text-muted">kcal</p>
        </div>
        <Button variant="soft" size="icon-sm" aria-label={`Add food to ${summary.name}`} onClick={() => openAddFood({ meal: summary.meal, date })}>
          <Plus />
        </Button>
      </div>
      <div id={panelId} hidden={!open} className="border-t border-line px-4 sm:px-5">
        {count === 0 ? (
          <div className="flex flex-col items-center gap-2 py-5 text-center">
            <p className="text-[13px] text-muted">No foods in {summary.name.toLowerCase()} yet.</p>
            <Button variant="secondary" size="sm" onClick={() => openAddFood({ meal: summary.meal, date })}><Plus /> Add food</Button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {summary.entries.map((e) => (
                <EntryRow key={e.id} entry={e} />
              ))}
            </ul>
            {missingCore > 0 && <p className="pb-3 text-[11.5px] text-warning-ink">Some entries don't report every nutrient; totals include only reported values.</p>}
          </>
        )}
      </div>
    </Card>
  );
}
