import * as RT from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = RT.Root;
export const TabsContent = RT.Content;

export function TabsList({ className, ...props }: RT.TabsListProps) {
  return <RT.List className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-[var(--radius-control)] bg-surface-2 p-1 border border-line', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: RT.TabsTriggerProps) {
  return (
    <RT.Trigger
      className={cn(
        'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 text-[13px] font-medium text-muted transition-colors hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-primary data-[state=active]:shadow-card [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}
