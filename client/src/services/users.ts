import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProfileUpdateInput, UserProfile } from '@nutritrack/shared';
import { api } from '@/lib/api';
import { keys } from './keys';
import { applyTheme } from '@/lib/theme';

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileUpdateInput) => api.patch<UserProfile>('/users/me', input),
    onSuccess: (user) => {
      qc.setQueryData(keys.me, user);
      applyTheme(user.theme);
      // Time zone, meal names and week start affect every date-based view.
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    },
  });
}

export function useMilestones() {
  const qc = useQueryClient();
  const set = (user: UserProfile) => qc.setQueryData(keys.me, user);
  return {
    add: useMutation({ mutationFn: (input: { title: string; type: string; target: number }) => api.post<UserProfile>('/users/me/milestones', input), onSuccess: set }),
    remove: useMutation({
      mutationFn: (id: string) => api.del(`/users/me/milestones/${id}`),
      onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
    }),
  };
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api.del('/users/me', { password, confirm: 'DELETE' }),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(keys.me, null);
    },
  });
}
