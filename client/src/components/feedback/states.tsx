import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

export function EmptyState({ icon: Icon, title, description, action, className, compact }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-6' : 'px-6 py-12', className)}>
      <div className={cn('flex items-center justify-center rounded-2xl bg-soft text-primary', compact ? 'mb-3 size-10' : 'mb-4 size-14')}>
        <Icon className={compact ? 'size-5' : 'size-6'} strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Understandable error with retry. Shows the request id for support, never internals. */
export function ErrorState({ error, onRetry, title, className, compact }: { error: unknown; onRetry?: () => void; title?: string; className?: string; compact?: boolean }) {
  const apiErr = error instanceof ApiError ? error : null;
  const offline = apiErr?.isNetwork;
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-6' : 'px-6 py-10', className)}>
      <div className={cn('mb-3 flex items-center justify-center rounded-2xl bg-danger-soft text-danger', compact ? 'size-10' : 'size-12')}>
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="text-[15px] font-semibold text-ink">{title ?? (offline ? "You're offline or the server is unreachable" : "We couldn't load this")}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-muted">{apiErr?.message ?? 'An unexpected error occurred.'}</p>
      {apiErr?.requestId && <p className="mt-1 text-[11px] text-subtle">Reference: {apiErr.requestId}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function Notice({ tone = 'info', children, icon: Icon }: { tone?: 'info' | 'warning'; children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-[13px]', tone === 'info' ? 'bg-soft text-ink' : 'bg-warning-soft text-warning-ink')}>
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}
