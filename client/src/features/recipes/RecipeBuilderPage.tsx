import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChefHat, Info, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { recipeNutrition } from '@nutritrack/shared';
import { useRecipe, useRecipeMutations } from '@/services/templates';
import { ApiError, errorMessage } from '@/lib/api';
import { formatNutrient } from '@/lib/format';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormSkeleton, LoadingRegion, Skeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState, InlineError, Notice } from '@/components/feedback/states';
import { NutritionTable } from '@/features/food-search/NutritionTable';
import { draftFrom, FoodPickerDialog, ItemList, MacroSummary, missingCore, previewItems, toItemInputs, useItemTotals, type DraftItem } from './items';

export default function RecipeBuilderPage() {
  const { recipeId } = useParams();
  const recipe = useRecipe(recipeId);

  if (recipeId && recipe.isPending) {
    return (
      <LoadingRegion label="Loading recipe" className="space-y-5">
        <Skeleton className="h-7 w-56" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="p-6"><FormSkeleton fields={4} /></Card>
          <Card className="p-6"><FormSkeleton fields={2} /></Card>
        </div>
      </LoadingRegion>
    );
  }
  if (recipeId && recipe.isError) {
    if (recipe.error instanceof ApiError && recipe.error.status === 404) {
      return (
        <EmptyState
          icon={ChefHat}
          title="Recipe not found"
          description="This recipe doesn't exist or was deleted."
          action={<Link to="/recipes" className={buttonVariants({ variant: 'secondary' })}>Back to recipes</Link>}
        />
      );
    }
    return <ErrorState error={recipe.error} onRetry={() => recipe.refetch()} />;
  }
  return (
    <RecipeForm
      key={recipeId ?? 'new'}
      recipeId={recipeId}
      initial={
        recipe.data
          ? {
              name: recipe.data.name,
              portions: String(recipe.data.portions),
              notes: recipe.data.notes ?? '',
              items: recipe.data.ingredients.map((i) => draftFrom(i.food, i.servingId, i.quantity)),
            }
          : { name: '', portions: '1', notes: '', items: [] }
      }
    />
  );
}

interface FormState {
  name: string;
  portions: string;
  notes: string;
  items: DraftItem[];
}

function RecipeForm({ recipeId, initial }: { recipeId?: string; initial: FormState }) {
  const navigate = useNavigate();
  const { create, update } = useRecipeMutations();
  const [state, setState] = useState<FormState>(initial);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const { totals, invalidCount } = useItemTotals(state.items);
  const portionsNum = Number(state.portions.replace(',', '.'));
  const portionsError = state.portions.trim() === '' || !Number.isFinite(portionsNum) || portionsNum <= 0 ? 'Enter a number of portions greater than 0' : portionsNum > 100 ? 'At most 100 portions' : null;
  const nameError = state.name.trim() === '' ? 'Give your recipe a name' : state.name.length > 80 ? 'Use at most 80 characters' : null;
  const itemsError = state.items.length === 0 ? 'Add at least one ingredient' : state.items.length > 50 ? 'At most 50 ingredients' : invalidCount > 0 ? 'Fix the highlighted ingredient quantities' : null;

  const perPortion = useMemo(() => {
    if (portionsError || state.items.length === 0 || invalidCount > 0) return null;
    const previews = previewItems(state.items).map((p) => ({ nutrients: p.nutrients!, grams: p.grams }));
    return recipeNutrition(previews, portionsNum);
  }, [state.items, portionsNum, portionsError, invalidCount]);

  const missing = missingCore(totals);

  const save = async () => {
    setSubmitted(true);
    setError(null);
    if (nameError || portionsError || itemsError) return;
    const body = { name: state.name.trim(), portions: portionsNum, notes: state.notes.trim() || null, ingredients: toItemInputs(state.items) };
    try {
      if (recipeId) await update.mutateAsync({ id: recipeId, ...body });
      else await create.mutateAsync(body);
      toast.success(recipeId ? 'Recipe updated' : 'Recipe saved');
      navigate('/recipes');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/recipes" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Recipes
      </Link>
      <PageHeader title={recipeId ? 'Edit recipe' : 'New recipe'} description="Combine ingredients and divide the recipe into portions to log them like any other food." />
      <form
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <Field label="Recipe name" error={submitted ? (nameError ?? undefined) : undefined}>
                {(p) => <Input {...p} maxLength={80} value={state.name} onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))} placeholder="e.g. Chicken rice bowl" />}
              </Field>
              <Field label="Portions" error={portionsError ?? undefined} hint="How many servings it makes">
                {(p) => <Input {...p} inputMode="decimal" value={state.portions} onChange={(e) => setState((s) => ({ ...s, portions: e.target.value }))} />}
              </Field>
              <Field label="Notes" optional className="sm:col-span-2">
                {(p) => <Textarea {...p} maxLength={1000} rows={3} value={state.notes} onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))} placeholder="Method, storage, substitutions…" />}
              </Field>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Ingredients"
              description={`${state.items.length} ingredient${state.items.length === 1 ? '' : 's'}`}
              action={
                <Button variant="soft" size="sm" onClick={() => setPickerOpen(true)} disabled={state.items.length >= 50}>
                  <Plus /> Add ingredient
                </Button>
              }
            />
            <CardBody className="space-y-3">
              <ItemList items={state.items} onChange={(items) => setState((s) => ({ ...s, items }))} emptyText="No ingredients yet. Add foods to build your recipe." />
              {submitted && itemsError && <p className="text-[12px] text-danger" role="alert">{itemsError}</p>}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-20 lg:h-fit">
          <Card>
            <CardHeader title="Per portion" description="Preview. Values are recalculated by the server when you save." />
            <CardBody className="space-y-4">
              {perPortion ? (
                <>
                  <MacroSummary values={perPortion.perPortion} totals={totals} />
                  <p className="text-[12px] text-muted">
                    {perPortion.gramsPerPortion !== null ? `About ${formatNutrient(perPortion.gramsPerPortion)} g per portion.` : 'Portion weight unknown (some ingredients have no gram weight).'}
                  </p>
                  <details>
                    <summary className="cursor-pointer text-[13px] font-medium text-primary">Full nutrition per portion</summary>
                    <NutritionTable nutrients={perPortion.perPortion} className="mt-2" caption="Nutrition per portion" />
                  </details>
                </>
              ) : (
                <p className="text-[13px] text-muted">Add ingredients and a valid portion count to see per-portion nutrition.</p>
              )}
              {state.items.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-subtle">Whole recipe</p>
                  <MacroSummary values={totals.values} totals={totals} />
                </div>
              )}
              {missing.length > 0 && (
                <Notice tone="warning" icon={Info}>
                  Some ingredients don't report {missing.join(', ')}. Those totals are lower bounds, not exact values.
                </Notice>
              )}
            </CardBody>
          </Card>
          {error && <InlineError message={error} />}
          <div className="flex gap-2">
            <Link to="/recipes" className={buttonVariants({ variant: 'secondary', className: 'flex-1' })}>Cancel</Link>
            <Button type="submit" className="flex-1" loading={pending}>{recipeId ? 'Save changes' : 'Save recipe'}</Button>
          </div>
        </div>
      </form>
      <FoodPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} forbidRecipes title="Add an ingredient" onPick={(item) => setState((s) => ({ ...s, items: [...s.items, item] }))} />
    </div>
  );
}
