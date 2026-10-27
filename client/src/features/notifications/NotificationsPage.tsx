import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, BellOff, CheckCheck, Droplets, Info, Target, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { AppNotification } from '@nutritrack/shared';
import { useNotificationList, useNotificationMutations } from '@/services/notifications';
import { errorMessage } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState } from '@/components/feedback/states';

const ICONS: Record<AppNotification['type'], { icon: LucideIcon; className: string; label: string }> = {
  meal_reminder: { icon: AlarmClock, className: 'bg-soft text-primary', label: 'Meal reminder' },
  hydration_reminder: { icon: Droplets, className: 'bg-soft text-water', label: 'Hydration reminder' },
  goal_reached: { icon: Target, className: 'bg-success-soft text-success', label: 'Goal reached' },
  goal_exceeded: { icon: TrendingUp, className: 'bg-warning-soft text-warning-ink', label: 'Above goal' },
  milestone: { icon: Trophy, className: 'bg-warning-soft text-warning-ink', label: 'Milestone' },
  system: { icon: Info, className: 'bg-surface-2 text-muted', label: 'System' },
};

type Filter = 'all' | 'unread';

export default function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const list = useNotificationList();
  const { setRead, readAll } = useNotificationMutations();
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const unread = list.data?.pages[0]?.unread ?? 0;
  const visible = filter === 'unread' ? items.filter((n) => !n.read) : items;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Reminders and progress updates. Notifications are kept for 90 days."
        actions={
          <>
            <Link to="/settings?tab=notifications" className="inline-flex h-10 items-center px-2 text-sm font-medium text-primary">Preferences</Link>
            <Button
              variant="secondary"
              disabled={unread === 0}
              loading={readAll.isPending}
              onClick={() => readAll.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}
            >
              <CheckCheck /> Mark all read
            </Button>
          </>
        }
      />

      <div role="radiogroup" aria-label="Filter notifications" className="inline-flex rounded-[var(--radius-control)] border border-line bg-surface-2 p-0.5">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={cn('h-8 rounded-[7px] px-3 text-[13px] font-medium', filter === f ? 'bg-surface text-primary shadow-card' : 'text-muted hover:text-ink')}
          >
            {f === 'all' ? 'All' : `Unread${unread ? ` (${unread})` : ''}`}
          </button>
        ))}
      </div>

      <Card className="px-4 sm:px-5">
        {list.isPending ? (
          <ListSkeleton rows={6} label="Loading notifications" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description={
              filter === 'unread'
                ? "You're all caught up."
                : 'Meal and hydration reminders, goal updates and milestones will appear here. Turn reminders on in notification preferences.'
            }
            action={filter === 'all' ? <Link to="/settings?tab=notifications" className="text-sm font-medium text-primary">Notification preferences</Link> : undefined}
          />
        ) : (
          <ul className="divide-y divide-line" aria-label="Notifications">
            {visible.map((n) => {
              const meta = ICONS[n.type];
              const Icon = meta.icon;
              const pending = setRead.isPending && setRead.variables?.id === n.id;
              return (
                <li key={n.id} className={cn('flex items-start gap-3 py-4', !n.read && 'relative')}>
                  <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', meta.className)} aria-hidden>
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-ink">
                      {!n.read && <span className="size-2 rounded-full bg-primary" aria-hidden />}
                      {n.title}
                      <span className="sr-only">{n.read ? '(read)' : '(unread)'}, {meta.label}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{n.body}</p>
                    <p className="mt-1 text-[12px] text-subtle">
                      <time dateTime={n.createdAt} title={new Date(n.createdAt).toLocaleString()}>{relativeTime(n.createdAt)}</time>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => setRead.mutate({ id: n.id, read: !n.read }, { onError: (e) => toast.error(errorMessage(e)) })}
                  >
                    {n.read ? 'Mark unread' : 'Mark read'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {list.hasNextPage && (
          <div className="flex justify-center border-t border-line py-4">
            <Button variant="secondary" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Load more</Button>
          </div>
        )}
        {list.isFetchNextPageError && <p className="pb-4 text-center text-[13px] text-danger">Couldn't load more notifications. Try again.</p>}
      </Card>
    </div>
  );
}
