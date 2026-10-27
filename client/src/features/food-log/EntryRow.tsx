import { useState } from 'react';
import { ArrowRightLeft, CalendarClock, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { MEALS, nutrientCompleteness, type DiaryEntry, type Meal } from '@nutritrack/shared';
import { formatKcal, formatNutrient } from '@/lib/format';
import { useMe } from '@/services/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { ConfirmDialog } from '@/components/ui/confirm';
import { FoodThumb } from '@/features/food-search/FoodResultCard';
import { EditEntryDialog } from './EditEntryDialog';
import { MoveDateDialog } from './MoveDateDialog';
import { useEntryActions } from './useEntryActions';

export function EntryRow({ entry }: { entry: DiaryEntry }) {
  const { data: user } = useMe();
  const actions = useEntryActions();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveDate, setMoveDate] = useState(false);
  const mealNames = Object.fromEntries((user?.meals ?? []).map((m) => [m.id, m.name])) as Record<Meal, string>;
  const n = entry.nutrients;
  const partial = nutrientCompleteness(n) !== 'complete';

  return (
    <li className="flex items-center gap-3 py-2.5">
      <FoodThumb food={entry.food} size="sm" />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => setEditing(true)} className="block max-w-full truncate text-left text-sm font-medium text-ink hover:text-primary">
          {entry.food.name}
        </button>
        <p className="truncate text-[12px] text-muted">
          {entry.food.brand ? `${entry.food.brand} · ` : ''}
          {entry.quantity} × {entry.servingLabel}
          {entry.notes && <span className="text-subtle"> · {entry.notes}</span>}
        </p>
        <p className="mt-0.5 text-[11.5px] tabular text-muted">
          <span className="text-protein">P</span> {formatNutrient(n.protein)}g · <span className="text-carbs">C</span> {formatNutrient(n.carbs)}g · <span className="text-fat">F</span> {formatNutrient(n.fat)}g
          {partial && <Badge tone="warning" className="ml-1.5 align-middle">Partial data</Badge>}
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular text-ink">
        {formatKcal(n.calories)}
        <span className="ml-0.5 text-[11px] font-normal text-muted">kcal</span>
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${entry.food.name}`} disabled={actions.pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setEditing(true)}><Pencil /> Edit serving</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void actions.duplicate(entry)}><Copy /> Duplicate</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMoveDate(true)}><CalendarClock /> Change date…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Move to meal</DropdownMenuLabel>
          {MEALS.filter((m) => m !== entry.meal).map((m) => (
            <DropdownMenuItem key={m} onSelect={() => void actions.move(entry, { meal: m })}>
              <ArrowRightLeft /> {mealNames[m] ?? m}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-danger [&_svg]:text-danger"><Trash2 /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditEntryDialog entry={entry} open={editing} onOpenChange={setEditing} />
      <MoveDateDialog entry={entry} open={moveDate} onOpenChange={setMoveDate} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this entry?"
        description={<>Remove <strong className="text-ink">{entry.food.name}</strong> ({formatKcal(n.calories)} kcal) from {mealNames[entry.meal] ?? entry.meal}. You can undo for a few minutes.</>}
        confirmLabel="Delete"
        destructive
        onConfirm={() => actions.remove(entry)}
      />
    </li>
  );
}
