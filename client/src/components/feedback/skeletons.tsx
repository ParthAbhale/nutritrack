import { cn } from '@/lib/utils';
import { Card } from '../ui/card';

/** Base placeholder. Shimmer respects prefers-reduced-motion (see index.css). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-md', className)} />;
}

/** Wraps skeleton groups so screen readers announce loading once. */
export function LoadingRegion({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-xl" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="mt-5 h-7 w-28" />
      <Skeleton className="mt-2 h-3.5 w-36" />
      <Skeleton className="mt-4 h-2 w-full rounded-full" />
    </Card>
  );
}

export function MetricGridSkeleton() {
  return (
    <LoadingRegion label="Loading daily summary" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </LoadingRegion>
  );
}

export function MealCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </Card>
  );
}

export function ListSkeleton({ rows = 5, label = 'Loading', className }: { rows?: number; label?: string; className?: string }) {
  return (
    <LoadingRegion label={label} className={cn('divide-y divide-line', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function SearchResultSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <LoadingRegion label="Searching foods" className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i} className="flex gap-3 p-3.5">
          <Skeleton className="size-14 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
        </Card>
      ))}
    </LoadingRegion>
  );
}

export function CalendarSkeleton() {
  return (
    <LoadingRegion label="Loading calendar">
      <div className="mb-3 flex justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-7 w-20" />
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    </LoadingRegion>
  );
}

const BAR_HEIGHTS = [40, 65, 50, 80, 55, 70, 45, 60, 75, 50, 65, 58];

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading chart" className={cn('flex h-64 items-end gap-2 px-2', className)}>
      {BAR_HEIGHTS.map((h, i) => (
        <div key={i} className="skeleton flex-1 rounded-t-md" style={{ height: `${h}%` }} aria-hidden />
      ))}
    </LoadingRegion>
  );
}

export function DonutSkeleton() {
  return (
    <LoadingRegion label="Loading chart" className="flex items-center gap-6">
      <Skeleton className="size-36 rounded-full" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
    </LoadingRegion>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <LoadingRegion label="Loading" className="space-y-5">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-10 w-full rounded-[var(--radius-control)]" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="space-y-3 p-5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </Card>
      ))}
    </LoadingRegion>
  );
}
