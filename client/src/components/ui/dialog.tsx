import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

interface ContentProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** "sheet" slides from the right on desktop; both become bottom sheets on phones. */
  variant?: 'center' | 'sheet';
  hideDescription?: boolean;
}

export function DialogContent({ title, description, children, footer, className, variant = 'center', hideDescription }: ContentProps) {
  return (
    <RD.Portal>
      <RD.Overlay className="fixed inset-0 z-50 bg-[#0b1020]/40 backdrop-blur-[1px]" />
      <RD.Content
        className={cn(
          'fixed z-50 flex max-h-[92dvh] w-full flex-col border border-line bg-surface shadow-pop focus:outline-none',
          'inset-x-0 bottom-0 rounded-t-2xl sm:inset-auto',
          variant === 'center' && 'sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-card)]',
          variant === 'sheet' && 'sm:bottom-0 sm:right-0 sm:top-0 sm:h-dvh sm:max-h-dvh sm:max-w-md sm:rounded-none sm:rounded-l-2xl',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <RD.Title className="text-base font-semibold text-ink">{title}</RD.Title>
            {description ? (
              <RD.Description className={cn('mt-0.5 text-[13px] text-muted', hideDescription && 'sr-only')}>{description}</RD.Description>
            ) : (
              <RD.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</RD.Description>
            )}
          </div>
          <RD.Close className="-mr-1 rounded-lg p-1.5 text-muted hover:bg-soft hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </RD.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </RD.Content>
    </RD.Portal>
  );
}
