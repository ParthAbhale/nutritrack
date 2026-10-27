import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { CopyDayInput, DailySummary, DiaryEntry, DiaryEntryCreateInput, DiaryEntryUpdateInput, Meal } from '@nutritrack/shared';
import { api } from '@/lib/api';
import { keys } from './keys';

export function useDailySummary(date: string) {
  return useQuery({ queryKey: keys.day(date), queryFn: ({ signal }) => api.data<DailySummary>('/diary', { date }, signal), placeholderData: (prev) => (prev?.date === date ? prev : undefined) });
}

/** Everything derived from diary entries must refresh after a change. */
export function invalidateDiary(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: keys.diaryAll }),
    qc.invalidateQueries({ queryKey: keys.calendarAll }),
    qc.invalidateQueries({ queryKey: keys.analyticsAll }),
    qc.invalidateQueries({ queryKey: keys.activity }),
    qc.invalidateQueries({ queryKey: keys.recentFoods }),
    qc.invalidateQueries({ queryKey: keys.notifications }),
  ]);
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DiaryEntryCreateInput) => api.post<DiaryEntry>('/diary/entries', input),
    onSuccess: () => invalidateDiary(qc),
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DiaryEntryUpdateInput }) => api.patch<DiaryEntry>(`/diary/entries/${id}`, input),
    onSuccess: () => invalidateDiary(qc),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<DiaryEntry>(`/diary/entries/${id}`),
    onSuccess: () => invalidateDiary(qc),
  });
}

export function useRestoreEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<DiaryEntry>(`/diary/entries/${id}/restore`),
    onSuccess: () => invalidateDiary(qc),
  });
}

export function useDuplicateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; date?: string; meal?: Meal; clientRequestId: string }) => api.post<DiaryEntry>(`/diary/entries/${id}/duplicate`, body),
    onSuccess: () => invalidateDiary(qc),
  });
}

export function useCopyDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CopyDayInput) => api.post<{ entries: DiaryEntry[]; created: number }>('/diary/copy-day', input),
    onSuccess: () => invalidateDiary(qc),
  });
}
