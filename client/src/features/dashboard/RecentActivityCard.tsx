import { Activity, Droplets, Scale, Target, Utensils, ChefHat } from 'lucide-react';
import type { ActivityItem } from '@nutritrack/shared';
import { useActivity } from '@/services/analytics';
import { relativeTime } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ListSkeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState } from '@/components/feedback/states';

const ICONS: Record<ActivityItem['type'], typeof Activity> = {
  food_logged: Utensils,
  goal_changed: Target,
  weight_logged: Scale,
  water_logged: Droplets,
  recipe_saved: ChefHat,
};

export function RecentActivityCard() {
  const { data, isPending, isError, error, refetch } = useActivity();
  return (
    <Card>
      <CardHeader title="Recent activity" />
      <CardBody className="pt-2">
        {isPending ? (
          <ListSkeleton rows={4} label="Loading activity" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} compact />
        ) : data.length === 0 ? (
          <EmptyState compact icon={Activity} title="No activity yet" description="Your logs, goal changes and weigh-ins will show up here." />
        ) : (
          <ul className="divide-y divide-line">
            {data.slice(0, 8).map((a) => {
              const Icon = ICONS[a.type];
              return (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted"><Icon className="size-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{a.message}</span>
                  <time dateTime={a.createdAt} className="shrink-0 text-[12px] text-subtle">{relativeTime(a.createdAt)}</time>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
