import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CustomFood, CustomFoodInput, Favorite, FoodItem, FoodRef, FoodSearchResult, PageMeta, RecentFood, SearchHistoryItem } from '@nutritrack/shared';
import { ApiError, api, request } from '@/lib/api';
import { keys } from './keys';

export type SearchSource = 'auto' | 'nutritionix' | 'usda' | 'openfoodfacts' | 'fixture';
export type SearchType = 'all' | 'branded' | 'generic';

/**
 * Server-paginated food search. TanStack Query passes an AbortSignal that is
 * aborted when the key changes, so stale requests are cancelled and can never
 * overwrite newer results (results are keyed by the exact query).
 */
export function useFoodSearch(q: string, source: SearchSource, type: SearchType) {
  const enabled = q.trim().length >= 2;
  return useInfiniteQuery({
    queryKey: keys.search(q.trim().toLowerCase(), source, type),
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const res = await request<FoodSearchResult, PageMeta>('/foods/search', { query: { q: q.trim(), page: pageParam, pageSize: 20, source, type }, signal });
      return { ...res.data, meta: res.meta! };
    },
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.page + 1 : undefined),
    staleTime: 5 * 60_000,
    // The server already falls back across providers; only retry dropped connections.
    retry: (n, err) => err instanceof ApiError && err.isNetwork && n < 1,
    placeholderData: keepPreviousData,
  });
}

export function useFoodDetail(ref: FoodRef | null) {
  return useQuery({
    queryKey: ref ? keys.food(ref.provider, ref.foodId) : ['foods', 'detail', 'none'],
    queryFn: ({ signal }) => api.data<FoodItem>(`/foods/${ref!.provider}/${encodeURIComponent(ref!.foodId)}`, undefined, signal),
    enabled: Boolean(ref),
    staleTime: 30 * 60_000,
  });
}

export const lookupBarcode = (code: string, signal?: AbortSignal) => api.data<FoodItem>(`/foods/barcode/${code}`, undefined, signal);

export function useRecentFoods() {
  return useQuery({ queryKey: keys.recentFoods, queryFn: () => api.data<RecentFood[]>('/foods/recent') });
}

export function useSearchHistory() {
  return useQuery({ queryKey: keys.searchHistory, queryFn: () => api.data<SearchHistoryItem[]>('/foods/search-history') });
}

export function useSearchHistoryMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.searchHistory });
  return {
    record: useMutation({ mutationFn: (query: string) => api.post('/foods/search-history', { query }), onSuccess: invalidate }),
    clear: useMutation({ mutationFn: () => api.del('/foods/search-history'), onSuccess: invalidate }),
  };
}

export function useFavorites() {
  return useQuery({ queryKey: keys.favorites, queryFn: () => api.data<Favorite[]>('/favorites') });
}

export function useFavoriteMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.favorites });
  return {
    add: useMutation({ mutationFn: (food: FoodRef) => api.post<Favorite>('/favorites', { food }), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/favorites/${id}`), onSuccess: invalidate }),
  };
}

export function useCustomFoods() {
  return useQuery({ queryKey: keys.customFoods, queryFn: () => api.data<CustomFood[]>('/foods/custom') });
}

export function useCustomFoodMutations() {
  const qc = useQueryClient();
  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: keys.customFoods }), qc.invalidateQueries({ queryKey: keys.favorites })]);
  return {
    create: useMutation({ mutationFn: (input: CustomFoodInput) => api.post<CustomFood>('/foods/custom', input), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<CustomFoodInput> }) => api.patch<CustomFood>(`/foods/custom/${id}`, input), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/foods/custom/${id}`), onSuccess: invalidate }),
  };
}

export function isFavorite(favorites: Favorite[] | undefined, food: Pick<FoodItem, 'provider' | 'providerFoodId'>) {
  return favorites?.find((f) => f.food.provider === food.provider && f.food.providerFoodId === food.providerFoodId);
}
