import { cn } from '@/lib/utils';

/** Progress bar that shows overflow (exceeded targets) instead of silently clamping. */
export function ProgressBar({ percent, colorClass = 'bg-primary', label, className }: { percent: number | null; colorClass?: string; label: string; className?: string }) {
  const p = percent ?? 0;
  const over = p > 100;
  return (
    <div
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-soft', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(p, 999))}
      aria-valuetext={percent === null ? 'No target set' : `${Math.round(p)}% of target`}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', colorClass)} style={{ width: `${Math.min(p, 100)}%` }} />
      {over && <div className="absolute inset-y-0 right-0 bg-danger" style={{ width: `${Math.min(((p - 100) / p) * 100, 100)}%` }} aria-hidden />}
    </div>
  );
}

export function ProgressRing({ percent, size = 112, stroke = 10, color = 'var(--primary)', children, label }: { percent: number | null; size?: number; stroke?: number; color?: string; children?: React.ReactNode; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, percent ?? 0);
  const main = Math.min(p, 100);
  const over = p > 100 ? Math.min(p - 100, 100) : 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(main / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-700" />
        {over > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--danger)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(over / 100) * c} ${c}`} />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
