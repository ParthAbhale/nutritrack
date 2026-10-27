import { useQuery } from '@tanstack/react-query';
import type { ActivityItem, MonthlyCalendar, RangeAnalytics, StreakInfo } from '@nutritrack/shared';
import { api } from '@/lib/api';
import { keys } from './keys';

export function useMonthCalendar(year: number, month: number) {
  return useQuery({
    queryKey: keys.month(year, month),
    queryFn: ({ signal }) => api.data<MonthlyCalendar>('/calendar/month', { year, month }, signal),
    placeholderData: (prev) => prev,
  });
}

export function useRangeAnalytics(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: keys.range(from, to),
    queryFn: ({ signal }) => api.data<RangeAnalytics>('/analytics/range', { from, to }, signal),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useStreak() {
  return useQuery({ queryKey: keys.streak, queryFn: () => api.data<StreakInfo>('/analytics/streak') });
}

export function useActivity() {
  return useQuery({ queryKey: keys.activity, queryFn: () => api.data<ActivityItem[]>('/activity') });
}
