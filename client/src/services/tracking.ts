import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HydrationDay, HydrationLog, WeightLog } from '@nutritrack/shared';
import { api } from '@/lib/api';
import { keys } from './keys';

export function useHydrationDay(date: string) {
  return useQuery({ queryKey: keys.hydration(date), queryFn: () => api.data<HydrationDay>('/hydration', { date }) });
}

export function useHydrationHistory(from: string, to: string) {
  return useQuery({ queryKey: keys.hydrationHistory(from, to), queryFn: () => api.data<{ date: string; totalMl: number }[]>('/hydration/history', { from, to }) });
}

export function useHydrationMutations() {
  const qc = useQueryClient();
  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.hydrationAll }),
      qc.invalidateQueries({ queryKey: keys.diaryAll }),
      qc.invalidateQueries({ queryKey: keys.calendarAll }),
      qc.invalidateQueries({ queryKey: keys.analyticsAll }),
      qc.invalidateQueries({ queryKey: keys.activity }),
    ]);
  return {
    add: useMutation({ mutationFn: (input: { date: string; amountMl: number; clientRequestId?: string }) => api.post<HydrationLog>('/hydration', input), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, amountMl }: { id: string; amountMl: number }) => api.patch<HydrationLog>(`/hydration/${id}`, { amountMl }), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/hydration/${id}`), onSuccess: invalidate }),
  };
}

export function useWeights(from?: string, to?: string) {
  return useQuery({ queryKey: [...keys.weights, from ?? '', to ?? ''], queryFn: () => api.data<WeightLog[]>('/weight', { from, to }) });
}

export function useWeightMutations() {
  const qc = useQueryClient();
  const invalidate = () =>
    Promise.all([qc.invalidateQueries({ queryKey: keys.weights }), qc.invalidateQueries({ queryKey: keys.analyticsAll }), qc.invalidateQueries({ queryKey: keys.activity }), qc.invalidateQueries({ queryKey: keys.me })]);
  return {
    upsert: useMutation({ mutationFn: (input: { date: string; weightKg: number; note?: string | null }) => api.post<WeightLog>('/weight', input), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, ...input }: { id: string; weightKg?: number; note?: string | null }) => api.patch<WeightLog>(`/weight/${id}`, input), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/weight/${id}`), onSuccess: invalidate }),
  };
}
