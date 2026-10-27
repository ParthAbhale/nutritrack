import { useMemo, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { CORE_NUTRIENTS, quantitySchema, sumNutrients, type FoodItem, type NutrientTotals, type NutrientValues } from '@nutritrack/shared';
import { useFoodDetail } from '@/services/foods';
import { formatKcal, formatNutrient } from '@/lib/format';
import { newRequestId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { FormSkeleton } from '@/components/feedback/skeletons';
import { ErrorState, Notice } from '@/components/feedback/states';
import { FoodSearchPanel } from '@/features/food-search/FoodSearchPanel';
import { FoodThumb } from '@/features/food-search/FoodResultCard';
import { previewNutrition } from '@/features/food-search/nutrition';

/** An ingredient / saved-meal item being edited. `quantity` is kept as typed text. */
export interface DraftItem {
  key: string;
  food: FoodItem;
  servingId: string;
  quantity: string;
}

export function draftFrom(food: FoodItem, servingId: string, quantity: number | string): DraftItem {
  return { key: newRequestId('item'), food, servingId, quantity: String(quantity) };
}

export function parseQuantity(text: string): { value: number } | { error: string } {
  if (text.trim() === '') return { error: 'Enter a quantity' };
  const r = quantitySchema.safeParse(Number(text.replace(',', '.')));
  return r.success ? { value: r.data } : { error: r.error.issues[0]?.message ?? 'Invalid quantity' };
}

export interface ItemPreview {
  item: DraftItem;
  nutrients: NutrientValues | null;
  grams: number | null;
  error: string | null;
}

export function previewItems(items: DraftItem[]): ItemPreview[] {
  return items.map((item) => {
    const q = parseQuantity(item.quantity);
    if ('error' in q) return { item, nutrients: null, grams: null, error: q.error };
    const p = previewNutrition(item.food, item.servingId, q.value);
    return 'error' in p ? { item, nutrients: null, grams: null, error: p.error } : { item, nutrients: p.nutrients, grams: p.grams, error: null };
  });
}

/** Totals of the valid items (preview only; the server recomputes on save). */
export function useItemTotals(items: DraftItem[]) {
  return useMemo(() => {
    const previews = previewItems(items);
    const valid = previews.filter((p) => p.nutrients !== null);
    const totals = sumNutrients(valid.map((p) => p.nutrients!));
    return { previews, totals, invalidCount: previews.length - valid.length };
  }, [items]);
}

export function missingCore(totals: NutrientTotals): string[] {
  return CORE_NUTRIENTS.filter((k) => totals.missing[k] > 0);
}

export function toItemInputs(items: DraftItem[]) {
  return items.map((i) => {
    const q = parseQuantity(i.quantity);
    return { food: { provider: i.food.provider, foodId: i.food.providerFoodId }, servingId: i.servingId, quantity: 'value' in q ? q.value : 0 };
  });
}

/** Editable list of items with inline serving/quantity controls. */
export function ItemList({ items, onChange, emptyText }: { items: DraftItem[]; onChange: (items: DraftItem[]) => void; emptyText: string }) {
  const previews = previewItems(items);
  if (items.length === 0) return <p className="rounded-[var(--radius-control)] border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">{emptyText}</p>;
  const update = (key: string, patch: Partial<DraftItem>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  return (
    <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line">
      {previews.map(({ item, nutrients, error }) => (
        <li key={item.key} className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <FoodThumb food={item.food} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{item.food.name}</p>
              <p className="truncate text-[12px] text-muted">
                {item.food.brand ?? (item.food.kind === 'generic' ? 'Generic' : item.food.category ?? '')}
                {nutrients && <> · <span className="tabular">{formatKcal(nutrients.calories)} kcal</span></>}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
              <Select aria-label={`Serving for ${item.food.name}`} value={item.servingId} onChange={(e) => update(item.key, { servingId: e.target.value })} className="h-9 text-[13px]">
                {item.food.servings.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div className="w-20">
              <Input
                aria-label={`Quantity of ${item.food.name}`}
                aria-invalid={Boolean(error)}
                inputMode="decimal"
                className="h-9 text-[13px]"
                value={item.quantity}
                onChange={(e) => update(item.key, { quantity: e.target.value })}
              />
            </div>
            <Button variant="danger-ghost" size="icon-sm" className="mt-0.5" aria-label={`Remove ${item.food.name}`} onClick={() => onChange(items.filter((i) => i.key !== item.key))}>
              <Trash2 />
            </Button>
          </div>
          </div>
          {error && <p className="mt-1.5 text-[12px] text-danger" role="alert">{error}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Compact kcal / P / C / F summary with "at least" wording when data is missing. */
export function MacroSummary({ values, totals, className }: { values: NutrientValues; totals?: NutrientTotals; className?: string }) {
  const cells = [
    ['calories', 'kcal', 'text-ink'],
    ['protein', 'Protein', 'text-protein'],
    ['carbs', 'Carbs', 'text-carbs'],
    ['fat', 'Fat', 'text-fat'],
  ] as const;
  return (
    <dl className={cn('grid grid-cols-4 gap-2 text-center', className)}>
      {cells.map(([k, label, color]) => (
        <div key={k} className="rounded-lg bg-surface-2 px-1 py-2">
          <dd className={cn('text-[15px] font-semibold tabular', color)}>
            {totals && totals.missing[k] > 0 && values[k] !== null ? '≥' : ''}
            {k === 'calories' ? formatKcal(values[k]) : values[k] === null ? '—' : `${formatNutrient(values[k])}g`}
          </dd>
          <dt className="text-[11px] text-muted">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

interface PickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: DraftItem) => void;
  forbidRecipes?: boolean;
  title?: string;
}

/** Search → configure serving/quantity → add. */
export function FoodPickerDialog({ open, onOpenChange, onPick, forbidRecipes, title = 'Add a food' }: PickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <FoodPickerBody onOpenChange={onOpenChange} onPick={onPick} forbidRecipes={forbidRecipes} title={title} />}
    </Dialog>
  );
}

function FoodPickerBody({ onOpenChange, onPick, forbidRecipes, title }: Omit<PickerProps, 'open'> & { title: string }) {
  const [food, setFood] = useState<FoodItem | null>(null);
  return (
      <DialogContent variant="sheet" title={title} description={food ? 'Choose a serving and quantity.' : 'Search by food name or brand, or pick a recent item.'} className="sm:max-w-xl">
        {food && (
          <ConfigureItem
            food={food}
            forbidRecipes={forbidRecipes}
            onBack={() => setFood(null)}
            onAdd={(item) => {
              onPick(item);
              onOpenChange(false);
            }}
          />
        )}
        <div hidden={Boolean(food)}>
          <FoodSearchPanel onSelect={setFood} autoFocus />
        </div>
      </DialogContent>
  );
}

function ConfigureItem({ food, forbidRecipes, onBack, onAdd }: { food: FoodItem; forbidRecipes?: boolean; onBack: () => void; onAdd: (item: DraftItem) => void }) {
  const needsDetail = !food.detailed;
  const detail = useFoodDetail(needsDetail ? { provider: food.provider, foodId: food.providerFoodId } : null);
  const resolved = needsDetail ? (detail.data ?? (detail.isError ? food : null)) : food;
  const [chosenServing, setServingId] = useState(food.defaultServingId);
  const [quantity, setQuantity] = useState('1');
  // Detailed data may replace the serving list; fall back to its default when the choice disappears.
  const servingId = resolved && !resolved.servings.some((s) => s.id === chosenServing) ? resolved.defaultServingId : chosenServing;

  const back = (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
      <ArrowLeft /> Back to results
    </Button>
  );
  if (forbidRecipes && food.provider === 'recipe') {
    return (
      <div className="space-y-4">
        {back}
        <Notice tone="warning">Recipes can't contain other recipes. Add the individual ingredients instead.</Notice>
      </div>
    );
  }
  if (!resolved) {
    return (
      <div className="space-y-4">
        {back}
        {detail.isError ? <ErrorState error={detail.error} onRetry={() => detail.refetch()} /> : <FormSkeleton fields={2} />}
      </div>
    );
  }
  const q = parseQuantity(quantity);
  const preview = 'value' in q ? previewNutrition(resolved, servingId, q.value) : null;
  return (
    <div className="space-y-4">
      {back}
      <div className="flex items-center gap-3">
        <FoodThumb food={resolved} />
        <div className="min-w-0">
          <p className="font-semibold text-ink">{resolved.name}</p>
          <p className="text-[13px] text-muted">{resolved.brand ?? (resolved.kind === 'generic' ? 'Generic food' : resolved.category)}</p>
        </div>
      </div>
      {needsDetail && detail.isError && <p className="text-[12px] text-muted">Detailed serving sizes couldn't be loaded, so only gram-based servings are available.</p>}
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field label="Serving size">
          {(p) => (
            <Select {...p} value={servingId} onChange={(e) => setServingId(e.target.value)}>
              {resolved.servings.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Quantity" error={'error' in q ? q.error : undefined}>
          {(p) => <Input {...p} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />}
        </Field>
      </div>
      {preview && 'error' in preview ? (
        <p className="text-[13px] text-danger">{preview.error}</p>
      ) : preview ? (
        <MacroSummary values={preview.nutrients} />
      ) : null}
      {resolved.completeness !== 'complete' && <Notice tone="warning">This food is missing some nutrient data; totals will be marked as incomplete.</Notice>}
      <div className="flex justify-end">
        <Button disabled={!preview || 'error' in preview} onClick={() => 'value' in q && onAdd(draftFrom(resolved, servingId, q.value))}>
          Add item
        </Button>
      </div>
    </div>
  );
}
