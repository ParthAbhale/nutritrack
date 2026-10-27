import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex size-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm', className)} aria-hidden>
      <Leaf className="size-5" strokeWidth={2} />
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight text-ink">NutriTrack</span>
    </span>
  );
}
