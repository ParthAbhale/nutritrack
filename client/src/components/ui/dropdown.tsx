import * as DM from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuSeparator = ({ className }: { className?: string }) => <DM.Separator className={cn('my-1 h-px bg-line', className)} />;
export const DropdownMenuLabel = ({ className, ...p }: DM.DropdownMenuLabelProps) => <DM.Label className={cn('px-2.5 py-1.5 text-xs text-muted', className)} {...p} />;

export function DropdownMenuContent({ className, align = 'end', ...props }: DM.DropdownMenuContentProps) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={6} className={cn('z-50 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-pop', className)} {...props} />
    </DM.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: DM.DropdownMenuItemProps) {
  return (
    <DM.Item
      className={cn('flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink outline-none data-[highlighted]:bg-soft data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted', className)}
      {...props}
    />
  );
}
