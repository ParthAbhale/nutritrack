import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { customFoodSchema, type CustomFood } from '@nutritrack/shared';
import { useCustomFoodMutations } from '@/services/foods';
import { ApiError, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { InlineError, Notice } from '@/components/feedback/states';

const required = (max: number) => z.number({ error: 'Enter a number' }).min(0, 'Cannot be negative').max(max, `At most ${max}`);
const optional = (max: number) => z.number({ error: 'Enter a number' }).min(0, 'Cannot be negative').max(max, `At most ${max}`).nullable();

/** Same rules as the API schema, with friendlier messages for empty numeric fields. */
const formSchema = customFoodSchema.extend({
  nutrients: z.object({
    calories: required(5000),
    protein: required(500),
    carbs: required(500),
    fat: required(500),
    saturatedFat: optional(500),
    fiber: optional(500),
    sugars: optional(500),
    sodium: optional(50000),
  }),
});
type FormValues = z.infer<typeof formSchema>;

/** Empty text → null; anything else → number (NaN fails validation). */
const toNumberOrNull = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.')));
const toStringOrNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

const NUTRIENT_FIELDS: { key: keyof FormValues['nutrients']; label: string; unit: string; required: boolean }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', required: true },
  { key: 'protein', label: 'Protein', unit: 'g', required: true },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g', required: true },
  { key: 'fat', label: 'Fat', unit: 'g', required: true },
  { key: 'saturatedFat', label: 'Saturated fat', unit: 'g', required: false },
  { key: 'fiber', label: 'Fiber', unit: 'g', required: false },
  { key: 'sugars', label: 'Sugars', unit: 'g', required: false },
  { key: 'sodium', label: 'Sodium', unit: 'mg', required: false },
];

export function CustomFoodDialog({ food, onClose }: { food: CustomFood | null; onClose: () => void }) {
  const { create, update } = useCustomFoodMutations();
  const { register, handleSubmit, formState, setError } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: food
      ? {
          name: food.name,
          brand: food.brand,
          servingLabel: food.servingLabel,
          servingGrams: food.servingGrams,
          nutrients: {
            calories: food.nutrients.calories ?? 0,
            protein: food.nutrients.protein ?? 0,
            carbs: food.nutrients.carbs ?? 0,
            fat: food.nutrients.fat ?? 0,
            saturatedFat: food.nutrients.saturatedFat,
            fiber: food.nutrients.fiber,
            sugars: food.nutrients.sugars,
            sodium: food.nutrients.sodium,
          },
        }
      : { name: '', brand: null, servingLabel: 'serving', servingGrams: null },
  });
  const pending = create.isPending || update.isPending;
  const submitError = (create.error ?? update.error) as unknown;

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (food) await update.mutateAsync({ id: food.id, input: values });
      else await create.mutateAsync(values);
      toast.success(food ? 'Custom food updated' : 'Custom food created');
      onClose();
    } catch (err) {
      if (err instanceof ApiError) for (const [path, message] of Object.entries(err.fieldErrors())) setError(path as never, { message });
    }
  });

  const nutrientError = (key: keyof FormValues['nutrients']) => formState.errors.nutrients?.[key]?.message;

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent
        variant="sheet"
        className="sm:max-w-xl"
        title={food ? 'Edit custom food' : 'New custom food'}
        description="Enter values from the package label for one serving."
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" form="custom-food-form" loading={pending}>{food ? 'Save changes' : 'Create food'}</Button>
          </>
        }
      >
        <form id="custom-food-form" onSubmit={onSubmit} className="space-y-5" noValidate>
          <Notice>Custom foods are labelled as manually entered and are visible only to you.</Notice>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Food name" error={formState.errors.name?.message} className="sm:col-span-2">
              {(p) => <Input {...p} maxLength={120} {...register('name')} placeholder="e.g. Homemade granola" />}
            </Field>
            <Field label="Brand" optional error={formState.errors.brand?.message}>
              {(p) => <Input {...p} maxLength={80} {...register('brand', { setValueAs: toStringOrNull })} />}
            </Field>
            <Field label="Serving name" error={formState.errors.servingLabel?.message} hint='e.g. "bar", "cup", "slice"'>
              {(p) => <Input {...p} maxLength={40} {...register('servingLabel')} />}
            </Field>
            <Field label="Serving weight (g)" optional error={formState.errors.servingGrams?.message} hint="Enables gram-based servings" className="sm:col-span-2">
              {(p) => <Input {...p} inputMode="decimal" {...register('servingGrams', { setValueAs: toNumberOrNull })} />}
            </Field>
          </div>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ink">Nutrition per serving</legend>
            <div className="grid grid-cols-2 gap-4">
              {NUTRIENT_FIELDS.map((f) => (
                <Field key={f.key} label={`${f.label} (${f.unit})`} optional={!f.required} error={nutrientError(f.key)}>
                  {(p) => <Input {...p} inputMode="decimal" {...register(`nutrients.${f.key}`, { setValueAs: toNumberOrNull })} />}
                </Field>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-muted">Leave optional nutrients blank if the label doesn't list them; blank values are stored as “not reported”, not zero.</p>
          </fieldset>
          {submitError instanceof ApiError && !submitError.details?.length ? <InlineError message={errorMessage(submitError)} /> : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
