import { CardGridSkeleton, LoadingRegion, Skeleton } from '../feedback/skeletons';

export function PageSkeleton() {
  return (
    <LoadingRegion label="Loading page" className="space-y-5">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <CardGridSkeleton count={3} />
    </LoadingRegion>
  );
}
