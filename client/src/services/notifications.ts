import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppNotification, PageMeta } from '@nutritrack/shared';
import { api, request } from '@/lib/api';
import { keys } from './keys';

type Page = { items: AppNotification[]; unread: number; meta: PageMeta };

async function fetchPage(page: number, pageSize: number): Promise<Page> {
  const res = await request<{ items: AppNotification[]; unread: number }, PageMeta>('/notifications', { query: { page, pageSize } });
  return { ...res.data, meta: res.meta! };
}

/** Badge + dropdown preview; polls every minute so new reminders appear. */
export function useNotificationPreview() {
  return useQuery({ queryKey: [...keys.notifications, 'preview'], queryFn: () => fetchPage(1, 6), refetchInterval: 60_000 });
}

export function useNotificationList() {
  return useInfiniteQuery({
    queryKey: [...keys.notifications, 'list'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPage(pageParam, 20),
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.page + 1 : undefined),
  });
}

export function useNotificationMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.notifications });
  return {
    setRead: useMutation({ mutationFn: ({ id, read }: { id: string; read: boolean }) => api.patch(`/notifications/${id}`, { read }), onSuccess: invalidate }),
    readAll: useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: invalidate }),
  };
}
