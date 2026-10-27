import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GoalInput, GoalSnapshot } from '@nutritrack/shared';
import { api } from '@/lib/api';
import { keys } from './keys';

export function useCurrentGoal() {
  return useQuery({ queryKey: keys.goal, queryFn: () => api.data<GoalSnapshot | null>('/goals') });
}

export function useGoalHistory() {
  return useQuery({ queryKey: keys.goalHistory, queryFn: () => api.data<GoalSnapshot[]>('/goals/history') });
}

function useInvalidateGoals() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.goalsAll }),
      qc.invalidateQueries({ queryKey: keys.diaryAll }),
      qc.invalidateQueries({ queryKey: keys.calendarAll }),
      qc.invalidateQueries({ queryKey: keys.analyticsAll }),
      qc.invalidateQueries({ queryKey: keys.hydrationAll }),
      qc.invalidateQueries({ queryKey: keys.activity }),
    ]);
}

export function useSaveGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({ mutationFn: (input: GoalInput) => api.post<GoalSnapshot>('/goals', input), onSuccess: invalidate });
}

export function useUpdateGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<GoalInput> }) => api.patch<GoalSnapshot>(`/goals/${id}`, input),
    onSuccess: invalidate,
  });
}
