import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, Pencil, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { MEALS, isValidDateString, type Meal, type SavedMeal } from '@nutritrack/shared';
import { useSavedMealMutations, useSavedMeals } from '@/services/templates';
import { useMe } from '@/services/auth';
import { useSelectedDate } from '@/hooks/useSelectedDate';
import { suggestMeal } from '@/lib/stores';
import { errorMessage } from '@/lib/api';
import { formatKcal, formatNutrient } from '@/lib/format';
import { newRequestId } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { CardGridSkeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState, InlineError } from '@/components/feedback/states';
import { draftFrom, FoodPickerDialog, ItemList, MacroSummary, missingCore, parseQuantity, toItemInputs, useItemTotals, type DraftItem } from './items';

export function SavedMealsTab({ filter }: { filter: string }) {
  const meals = useSavedMeals();
  const [editing, setEditing] = useState<SavedMeal | 'new' | null>(null);
  const [logging, setLogging] = useState<SavedMeal | null>(null);
  const [deleting, setDeleting] = useState<SavedMeal | null>(null);
  const { remove } = useSavedMealMutations();

  const list = (meals.data ?? []).filter((m) => m.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}><Plus /> New saved meal</Button>
      </div>
      {meals.isPending ? (
        <CardGridSkeleton count={3} />
      ) : meals.isError ? (
        <ErrorState error={meals.error} onRetry={() => meals.refetch()} />
      ) : meals.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={UtensilsCrossed}
            title="No saved meals yet"
            description="Save combinations you eat often, like your usual breakfast, and log them in one step."
            action={<Button onClick={() => setEditing('new')}><Plus /> Create a saved meal</Button>}
          />
        </Card>
      ) : list.length === 0 ? (
        <Card><EmptyState icon={Search} title="No saved meals match your filter" compact /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((m) => {
            const missing = missingCore(m.totals);
            return (
              <Card key={m.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 truncate text-[15px] font-semibold text-ink">{m.name}</h3>
                  {missing.length > 0 && <Badge tone="warning">Incomplete data</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] text-muted">
                  {m.items.map((i) => `${formatNutrient(i.quantity)} × ${i.food.name}`).join(', ')}
                </p>
                <MacroSummary values={m.totals.values} totals={m.totals} className="mt-4" />
                <div className="mt-4 flex flex-wrap gap-2 pt-1">
                  <Button size="sm" className="flex-1" onClick={() => setLogging(m)}><CalendarPlus /> Log to diary</Button>
                  <Button size="icon-sm" variant="secondary" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m)}><Pencil /></Button>
                  <Button size="icon-sm" variant="danger-ghost" aria-label={`Delete ${m.name}`} onClick={() => setDeleting(m)}><Trash2 /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && <SavedMealEditor meal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {logging && <LogSavedMealDialog meal={logging} onClose={() => setLogging(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete saved meal?"
        description={<>“{deleting?.name}” will be removed. Entries you already logged from it stay in your diary.</>}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success('Saved meal deleted');
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
    </div>
  );
}

function SavedMealEditor({ meal, onClose }: { meal: SavedMeal | null; onClose: () => void }) {
  const { create, update } = useSavedMealMutations();
  const [name, setName] = useState(meal?.name ?? '');
  const [items, setItems] = useState<DraftItem[]>(() => (meal ? meal.items.map((i) => draftFrom(i.food, i.servingId, i.quantity)) : []));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { totals, invalidCount } = useItemTotals(items);
  const pending = create.isPending || update.isPending;

  const nameError = name.trim() === '' ? 'Enter a name' : null;
  const itemsError = items.length === 0 ? 'Add at least one food' : items.length > 30 ? 'At most 30 foods' : invalidCount > 0 ? 'Fix the highlighted quantities' : null;

  const save = async () => {
    setSubmitted(true);
    setError(null);
    if (nameError || itemsError) return;
    try {
      const body = { name: name.trim(), items: toItemInputs(items) };
      if (meal) await update.mutateAsync({ id: meal.id, ...body });
      else await create.mutateAsync(body);
      toast.success(meal ? 'Saved meal updated' : 'Saved meal created');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
        <DialogContent
          variant="sheet"
          className="sm:max-w-xl"
          title={meal ? 'Edit saved meal' : 'New saved meal'}
          description="Choose the foods and amounts you usually eat together."
          footer={
            <>
              <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
              <Button loading={pending} onClick={() => void save()}>{meal ? 'Save changes' : 'Create saved meal'}</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Name" error={submitted ? (nameError ?? undefined) : undefined}>
              {(p) => <Input {...p} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Usual breakfast" />}
            </Field>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Foods</h3>
              <Button variant="soft" size="sm" onClick={() => setPickerOpen(true)} disabled={items.length >= 30}><Plus /> Add food</Button>
            </div>
            <ItemList items={items} onChange={setItems} emptyText="No foods yet." />
            {submitted && itemsError && <p className="text-[12px] text-danger" role="alert">{itemsError}</p>}
            {items.length > 0 && <MacroSummary values={totals.values} totals={totals} />}
            {error && <InlineError message={error} />}
          </div>
        </DialogContent>
      </Dialog>
      <FoodPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onPick={(item) => setItems((list) => [...list, item])} />
    </>
  );
}

/** Logs a saved meal; quantity overrides apply to this log only, never to the template. */
function LogSavedMealDialog({ meal, onClose }: { meal: SavedMeal; onClose: () => void }) {
  const { log } = useSavedMealMutations();
  const { data: user } = useMe();
  const [selected] = useSelectedDate();
  const [date, setDate] = useState(selected);
  const [mealSlot, setMealSlot] = useState<Meal>(suggestMeal());
  const [quantities, setQuantities] = useState(() => meal.items.map((i) => String(i.quantity)));
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(newRequestId('meal'));

  // A changed request is a new logical submission and gets a new idempotency key.
  useEffect(() => {
    requestId.current = newRequestId('meal');
  }, [date, mealSlot, quantities]);

  const parsed = quantities.map(parseQuantity);
  const dateError = isValidDateString(date) ? null : 'Choose a valid date';
  const invalid = Boolean(dateError) || parsed.some((p) => 'error' in p);
  const names = useMemo(() => Object.fromEntries((user?.meals ?? []).map((m) => [m.id, m.name])) as Record<Meal, string>, [user]);

  const submit = async () => {
    if (invalid) return;
    setError(null);
    try {
      const result = await log.mutateAsync({ id: meal.id, date, meal: mealSlot, quantities: parsed.map((p) => ('value' in p ? p.value : 0)), clientRequestId: requestId.current });
      toast.success(result.created > 0 ? `Logged ${meal.name} to ${names[mealSlot] ?? mealSlot}` : 'Already logged');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !log.isPending && onClose()}>
      <DialogContent
        title={`Log “${meal.name}”`}
        description="Adjust amounts for this log only. Your saved meal stays unchanged."
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={log.isPending}>Cancel</Button>
            <Button loading={log.isPending} disabled={invalid} onClick={() => void submit()}>Add to diary</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" error={dateError ?? undefined}>
              {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
            </Field>
            <Field label="Meal">
              {(p) => (
                <Select {...p} value={mealSlot} onChange={(e) => setMealSlot(e.target.value as Meal)}>
                  {MEALS.map((m) => (
                    <option key={m} value={m}>{names[m] ?? m}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line">
            {meal.items.map((item, i) => {
              const p = parsed[i]!;
              return (
                <li key={i} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.food.name}</p>
                    <p className="truncate text-[12px] text-muted">{item.servingLabel} · {formatKcal(item.nutrients.calories)} kcal at {formatNutrient(item.quantity)}×</p>
                    {'error' in p && <p className="text-[12px] text-danger" role="alert">{p.error}</p>}
                  </div>
                  <Input
                    aria-label={`Servings of ${item.food.name}`}
                    aria-invalid={'error' in p}
                    inputMode="decimal"
                    className="h-9 w-20 text-[13px]"
                    value={quantities[i]}
                    onChange={(e) => setQuantities((q) => q.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                </li>
              );
            })}
          </ul>
          {error && <InlineError message={error} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
