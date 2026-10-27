import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChefHat, Pencil, Plus, Search, Trash2, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import type { FoodItem, Recipe } from '@nutritrack/shared';
import { useRecipeMutations, useRecipes } from '@/services/templates';
import { keys } from '@/services/keys';
import { api, errorMessage } from '@/lib/api';
import { useAddFoodStore } from '@/lib/stores';
import { formatNutrient } from '@/lib/format';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/PageHeader';
import { CardGridSkeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { MacroSummary, missingCore } from './items';
import { SavedMealsTab } from './SavedMeals';

export default function RecipesPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'meals' ? 'meals' : 'recipes';
  const [filter, setFilter] = useState('');
  return (
    <div className="space-y-5">
      <PageHeader
        title="Recipes & meals"
        description="Build recipes from ingredients and save meals you eat often."
        actions={<Link to="/recipes/new" className={buttonVariants()}><Plus /> New recipe</Link>}
      />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'meals' ? { tab: 'meals' } : {}, { replace: true })}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="recipes"><ChefHat /> Recipes</TabsTrigger>
            <TabsTrigger value="meals"><Utensils /> Saved meals</TabsTrigger>
          </TabsList>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input aria-label="Filter by name" placeholder="Filter by name…" className="pl-9" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </div>
        <TabsContent value="recipes" className="mt-5">
          <RecipesTab filter={filter} />
        </TabsContent>
        <TabsContent value="meals" className="mt-5">
          <SavedMealsTab filter={filter} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecipesTab({ filter }: { filter: string }) {
  const recipes = useRecipes();
  const { remove } = useRecipeMutations();
  const [deleting, setDeleting] = useState<Recipe | null>(null);

  if (recipes.isPending) return <CardGridSkeleton count={3} />;
  if (recipes.isError) return <ErrorState error={recipes.error} onRetry={() => recipes.refetch()} />;
  if (recipes.data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ChefHat}
          title="No recipes yet"
          description="Combine ingredients, set the number of portions, and NutriTrack calculates the nutrition per portion."
          action={<Link to="/recipes/new" className={buttonVariants()}><Plus /> Create a recipe</Link>}
        />
      </Card>
    );
  }
  const list = recipes.data.filter((r) => r.name.toLowerCase().includes(filter.trim().toLowerCase()));
  if (list.length === 0) return <Card><EmptyState icon={Search} title="No recipes match your filter" compact /></Card>;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => {
          const incomplete = missingCore(r.totals).length > 0;
          return (
            <Card key={r.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/recipes/${r.id}`} className="min-w-0 truncate text-[15px] font-semibold text-ink hover:text-primary">{r.name}</Link>
                {incomplete && <Badge tone="warning">Incomplete data</Badge>}
              </div>
              <p className="mt-1 text-[13px] text-muted">
                {formatNutrient(r.portions)} portion{r.portions === 1 ? '' : 's'} · {r.ingredients.length} ingredient{r.ingredients.length === 1 ? '' : 's'}
                {r.gramsPerPortion !== null && <> · ~{formatNutrient(r.gramsPerPortion)} g each</>}
              </p>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-subtle">Per portion</p>
              <MacroSummary values={r.perPortion} totals={r.totals} className="mt-1.5" />
              <div className="mt-4 flex flex-wrap gap-2 pt-1">
                <LogRecipeButton recipe={r} />
                <Link to={`/recipes/${r.id}`} className={buttonVariants({ variant: 'secondary', size: 'icon-sm' })} aria-label={`Edit ${r.name}`}><Pencil /></Link>
                <Button variant="danger-ghost" size="icon-sm" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)}><Trash2 /></Button>
              </div>
            </Card>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete recipe?"
        description={<>“{deleting?.name}” will be deleted. Portions you already logged stay in your diary unchanged.</>}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success('Recipe deleted');
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
    </>
  );
}

/** Fetches the recipe as a loggable food (one portion per serving) and opens the add-food dialog. */
function LogRecipeButton({ recipe }: { recipe: Recipe }) {
  const qc = useQueryClient();
  const openAddFood = useAddFoodStore((s) => s.openAddFood);
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      className="flex-1"
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          const food = await qc.fetchQuery({
            queryKey: keys.food('recipe', recipe.id),
            queryFn: () => api.data<FoodItem>(`/foods/recipe/${recipe.id}`),
            staleTime: 0,
          });
          openAddFood({ food });
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <Plus /> Log a portion
    </Button>
  );
}
