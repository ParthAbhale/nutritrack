import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FoodRef, Meal, Recipe, SavedMeal } from '@nutritrack/shared';
import { api } from '@/lib/api';
import { keys } from './keys';
import { invalidateDiary } from './diary';

export interface TemplateItemInput {
  food: FoodRef;
  servingId: string;
  quantity: number;
}

export function useSavedMeals() {
  return useQuery({ queryKey: keys.savedMeals, queryFn: () => api.data<SavedMeal[]>('/saved-meals') });
}

export function useSavedMealMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.savedMeals });
  return {
    create: useMutation({ mutationFn: (input: { name: string; items: TemplateItemInput[] }) => api.post<SavedMeal>('/saved-meals', input), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, ...input }: { id: string; name?: string; items?: TemplateItemInput[] }) => api.patch<SavedMeal>(`/saved-meals/${id}`, input), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/saved-meals/${id}`), onSuccess: invalidate }),
    log: useMutation({
      mutationFn: ({ id, ...input }: { id: string; date: string; meal: Meal; quantities?: number[]; clientRequestId: string }) =>
        api.post<{ created: number }>(`/saved-meals/${id}/log`, input),
      onSuccess: () => invalidateDiary(qc),
    }),
  };
}

export function useRecipes() {
  return useQuery({ queryKey: keys.recipes, queryFn: () => api.data<Recipe[]>('/recipes') });
}

export function useRecipe(id: string | undefined) {
  return useQuery({ queryKey: keys.recipe(id ?? 'new'), queryFn: () => api.data<Recipe>(`/recipes/${id}`), enabled: Boolean(id) });
}

export function useRecipeMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.recipes });
  type RecipeInput = { name: string; portions: number; notes?: string | null; ingredients: TemplateItemInput[] };
  return {
    create: useMutation({ mutationFn: (input: RecipeInput) => api.post<Recipe>('/recipes', input), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, ...input }: Partial<RecipeInput> & { id: string }) => api.patch<Recipe>(`/recipes/${id}`, input), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/recipes/${id}`), onSuccess: invalidate }),
  };
}
