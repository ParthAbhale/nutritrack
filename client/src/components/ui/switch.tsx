import * as RS from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: RS.SwitchProps) {
  return (
    <RS.Root
      className={cn('relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-line bg-line transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-50', className)}
      {...props}
    >
      <RS.Thumb className="block size-[18px] translate-x-[2px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </RS.Root>
  );
}
