import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { dateFromString } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Chart conventions shared by report pages. Colors are CSS variables so light
 * and dark themes both work; marks follow the house spec (2px lines, <=24px
 * bars with 4px rounded data-ends, hairline solid grid, recessive axes).
 */
export const CHART_COLORS = {
  primary: 'var(--primary)',
  protein: 'var(--protein)',
  carbs: 'var(--carbs)',
  fat: 'var(--fat)',
  water: 'var(--water)',
  danger: 'var(--danger)',
  grid: 'var(--line)',
  axis: 'var(--muted)',
  reference: 'var(--ink)',
  surface: 'var(--surface)',
} as const;

export const axisProps = {
  tick: { fill: 'var(--muted)', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: 'var(--line)' },
} as const;

export const gridProps = { stroke: 'var(--line)', strokeDasharray: undefined, vertical: false } as const;

export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
export const MAX_BAR = 24;

export const shortDate = (date: string) => format(dateFromString(date), 'd MMM');
export const longDate = (date: string) => format(dateFromString(date), 'EEE, d MMM yyyy');

/** Compact numeric ticks: 0 / 500 / 1.5K. */
export function compactTick(v: number) {
  return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : String(Math.round(v));
}

/** Tooltip shell; text stays in text tokens, a swatch carries series identity. */
export function TooltipCard({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-pop">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 text-muted">
          <span className="flex items-center gap-1.5">
            {r.color && <span className="inline-block size-2 rounded-full" style={{ background: r.color }} aria-hidden />}
            {r.label}
          </span>
          <span className="tabular font-medium text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function LegendItem({ color, label, line }: { color: string; label: ReactNode; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <span aria-hidden className={cn('inline-block', line ? 'h-0.5 w-4 rounded-full' : 'size-2.5 rounded-sm')} style={{ background: color }} />
      {label}
    </span>
  );
}

/** Accessible alternative to a chart: a collapsible data table. */
export function ChartDataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-[12.5px] font-medium text-primary">View as table</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
        <table className="w-full text-[12.5px]">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface-2">
            <tr>
              {headers.map((h, i) => (
                <th key={h} scope="col" className={cn('px-3 py-2 font-medium text-muted', i === 0 ? 'text-left' : 'text-right')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) =>
                  ci === 0 ? (
                    <th key={ci} scope="row" className="px-3 py-1.5 text-left font-normal text-ink">
                      {c}
                    </th>
                  ) : (
                    <td key={ci} className="px-3 py-1.5 text-right tabular text-ink">
                      {c}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** A labelled stat with a headline value. */
export function StatTile({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2 text-[12.5px] text-muted">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-[22px] font-semibold tabular tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
    </div>
  );
}
