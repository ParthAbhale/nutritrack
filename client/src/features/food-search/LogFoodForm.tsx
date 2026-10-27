import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Heart, Info } from 'lucide-react';
import { ALLERGEN_DISCLAIMER, MEALS, matchAllergens, matchExcludedTerms, quantitySchema, isValidDateString, type FoodItem, type Meal } from '@nutritrack/shared';
import { useMe } from '@/services/auth';
import { isFavorite, useFavoriteMutations, useFavorites } from '@/services/foods';
import { cn } from '@/lib/utils';
import { formatKcal, formatNutrient } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { InlineError, Notice } from '@/components/feedback/states';
import { FoodThumb } from './FoodResultCard';
import { NutritionTable } from './NutritionTable';
import { basisLabel, previewNutrition, PROVIDER_LABEL } from './nutrition';

export interface LogFoodValues {
  servingId: string;
  quantity: number;
  meal: Meal;
  date: string;
  notes: string | null;
}

interface Props {
  food: FoodItem;
  initial: Partial<LogFoodValues> & { meal: Meal; date: string };
  submitLabel: string;
  onSubmit: (values: LogFoodValues) => Promise<unknown>;
  onCancel?: () => void;
  showDate?: boolean;
}

const QUICK_QTY = [0.5, 1, 1.5, 2];
const QUICK_AMOUNT = [50, 100, 150, 200];

/**
 * Serving + quantity + meal + date form with a live nutrition preview.
 * Values are kept on failure so the user can retry without re-entering them.
 */
export function LogFoodForm({ food, initial, submitLabel, onSubmit, onCancel, showDate = true }: Props) {
  const { data: user } = useMe();
  // A "1 g" / "1 ml" option lets the user type the exact amount they ate.
  const unitOption = food.servings.find((s) => s.grams === 1 && (s.id === '1g' || s.id === '1ml'));
  const unit = unitOption?.id === '1ml' ? 'ml' : 'g';
  const [byWeight, setByWeight] = useState(Boolean(unitOption) && initial.servingId === unitOption?.id);
  const [chosenServing, setServingId] = useState(initial.servingId ?? food.defaultServingId);
  const servingId = byWeight && unitOption ? unitOption.id : food.servings.some((s) => s.id === chosenServing) ? chosenServing : food.defaultServingId;
  const [qtyText, setQtyText] = useState(String(initial.quantity ?? 1));
  const [meal, setMeal] = useState<Meal>(initial.meal);
  const [date, setDate] = useState(initial.date);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  const qtyParse = quantitySchema.safeParse(Number(qtyText.replace(',', '.')));
  const qtyError = qtyText.trim() === '' ? 'Enter a quantity' : qtyParse.success ? null : qtyParse.error.issues[0]?.message ?? 'Invalid quantity';
  const dateError = isValidDateString(date) ? null : 'Choose a valid date';
  const preview = useMemo(() => (qtyParse.success ? previewNutrition(food, servingId, qtyParse.data) : null), [food, servingId, qtyParse.success, qtyParse.data]);

  const allergenHits = user ? matchAllergens(food.allergens, user.allergens) : null;
  const excludedHits = user && food.ingredientsText ? matchExcludedTerms(`${food.name} ${food.ingredientsText}`, user.excludedFoods) : [];
  const mealNames = Object.fromEntries((user?.meals ?? []).map((m) => [m.id, m.name])) as Record<Meal, string>;

  const switchMode = (weight: boolean) => {
    if (weight === byWeight) return;
    if (weight) {
      const grams = preview && !('error' in preview) ? preview.grams : null;
      setQtyText(String(grams ? Math.round(grams * 10) / 10 : 100));
    } else {
      setServingId(food.defaultServingId);
      setQtyText('1');
    }
    setByWeight(weight);
  };

  const submit = async () => {
    if (submitting.current || qtyError || dateError || !preview || 'error' in preview) return;
    submitting.current = true;
    setPending(true);
    setSubmitError(null);
    try {
      await onSubmit({ servingId, quantity: qtyParse.data!, meal, date, notes: notes.trim() || null });
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
    >
      <div className="flex items-start gap-3">
        <FoodThumb food={food} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-ink">{food.name}</h3>
          <p className="text-[13px] text-muted">{food.brand ?? (food.kind === 'generic' ? 'Generic food' : food.category)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{PROVIDER_LABEL[food.provider]}</Badge>
            {food.kind === 'custom' && <Badge tone="primary">Manually entered</Badge>}
            {food.completeness !== 'complete' && <Badge tone="warning">Partial nutrition data</Badge>}
          </div>
        </div>
        <FavoriteToggle food={food} />
      </div>

      {food.completeness !== 'complete' && (
        <Notice tone="warning" icon={Info}>The source doesn't report every core nutrient for this food. Missing values are excluded from totals and marked as incomplete; they are not counted as zero.</Notice>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {unitOption && (
          <div className="sm:col-span-2 flex gap-1.5 rounded-lg border border-line p-1" role="group" aria-label="How to enter the amount">
            {([[false, 'By serving'], [true, `By amount (${unit})`]] as const).map(([w, l]) => (
              <button key={l} type="button" aria-pressed={byWeight === w} onClick={() => switchMode(w)} className={cn('h-8 flex-1 rounded-md text-[13px] font-medium', byWeight === w ? 'bg-soft text-primary' : 'text-muted hover:text-ink')}>
                {l}
              </button>
            ))}
          </div>
        )}
        {!byWeight && (
          <Field label="Serving size" className="sm:col-span-2" hint={basisLabel(food)}>
            {(p) => (
              <Select {...p} value={servingId} onChange={(e) => setServingId(e.target.value)}>
                {food.servings.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label={byWeight ? `Amount eaten (${unit})` : 'Number of servings'} error={qtyError ?? undefined} className={byWeight ? 'sm:col-span-2' : ''} hint={byWeight ? basisLabel(food) : undefined}>
          {(p) => (
            <div className="space-y-2">
              <Input {...p} inputMode="decimal" value={qtyText} onChange={(e) => setQtyText(e.target.value)} />
              <div className="flex gap-1.5">
                {(byWeight ? QUICK_AMOUNT : QUICK_QTY).map((q) => (
                  <button key={q} type="button" onClick={() => setQtyText(String(q))} className={cn('h-7 flex-1 rounded-md border text-[12px] font-medium', Number(qtyText) === q ? 'border-primary bg-soft text-primary' : 'border-line text-muted hover:text-ink')}>
                    {byWeight ? `${q} ${unit}` : q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Field>
        <Field label="Meal">
          {(p) => (
            <Select {...p} value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
              {MEALS.map((m) => (
                <option key={m} value={m}>{mealNames[m] ?? m}</option>
              ))}
            </Select>
          )}
        </Field>
        {showDate && (
          <Field label="Date" error={dateError ?? undefined}>
            {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        )}
        <Field label="Notes" optional className={showDate ? '' : 'sm:col-span-2'}>
          {(p) => <Textarea {...p} rows={1} className="min-h-10" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. homemade" />}
        </Field>
      </div>

      {(allergenHits?.length || excludedHits.length) ? (
        <div role="alert" className="rounded-[var(--radius-control)] border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger">
          <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-4" /> Possible match with your preferences</p>
          {allergenHits?.length ? <p className="mt-1">Allergens listed by the source: {allergenHits.join(', ')}.</p> : null}
          {excludedHits.length ? <p className="mt-1">Contains excluded terms: {excludedHits.join(', ')}.</p> : null}
          <p className="mt-1.5 text-[12px] opacity-90">{ALLERGEN_DISCLAIMER}</p>
        </div>
      ) : user?.allergens.length && food.allergens === null ? (
        <p className="text-[12px] text-muted">Allergen data isn't available from this source, so no allergen check was possible.</p>
      ) : null}

      <section aria-label="Nutrition preview" className="rounded-[var(--radius-card)] border border-line bg-surface-2 p-4">
        {preview && 'error' in preview ? (
          <p className="text-[13px] text-danger">{preview.error}</p>
        ) : preview ? (
          <>
            <div className="grid grid-cols-4 gap-2 text-center">
              {([['calories', 'kcal', 'text-ink'], ['protein', 'Protein', 'text-protein'], ['carbs', 'Carbs', 'text-carbs'], ['fat', 'Fat', 'text-fat']] as const).map(([k, l, c]) => (
                <div key={k}>
                  <p className={cn('text-lg font-semibold tabular', c)}>{k === 'calories' ? formatKcal(preview.nutrients[k]) : preview.nutrients[k] === null ? '—' : `${formatNutrient(preview.nutrients[k])}g`}</p>
                  <p className="text-[11px] text-muted">{l}</p>
                </div>
              ))}
            </div>
            {preview.grams !== null && <p className="mt-2 text-center text-[12px] text-muted">Total amount: {formatNutrient(preview.grams)} {food.basis.type === 'per100ml' ? 'ml' : 'g'}</p>}
            <details className="mt-3">
              <summary className="cursor-pointer text-[13px] font-medium text-primary">Full nutrition</summary>
              <NutritionTable nutrients={preview.nutrients} className="mt-2" caption="Nutrition for the selected amount" />
            </details>
          </>
        ) : (
          <p className="text-[13px] text-muted">Enter a valid quantity to preview nutrition.</p>
        )}
        <p className="mt-3 text-[11px] text-subtle">Source: {food.attribution}{food.sourceUrl && <> · <a href={food.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">view source</a></>}</p>
      </section>

      {submitError && <InlineError message={submitError} />}

      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button>}
        <Button type="submit" loading={pending} disabled={Boolean(qtyError || dateError || !preview || 'error' in (preview ?? {}))}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function FavoriteToggle({ food }: { food: FoodItem }) {
  const favorites = useFavorites();
  const { add, remove } = useFavoriteMutations();
  if (food.provider === 'recipe') return null;
  const fav = isFavorite(favorites.data, food);
  const busy = add.isPending || remove.isPending;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-pressed={Boolean(fav)}
      aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
      disabled={busy || favorites.isPending}
      onClick={() => (fav ? remove.mutate(fav.id) : add.mutate({ provider: food.provider, foodId: food.providerFoodId }))}
    >
      <Heart className={cn(fav && 'fill-danger text-danger')} />
    </Button>
  );
}
