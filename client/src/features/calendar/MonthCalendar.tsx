import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, monthGrid, parseDateString, shiftMonth, type CalendarDay } from '@nutritrack/shared';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatKcal, dateFromString } from '@/lib/format';
import { useMonthCalendar } from '@/services/analytics';
import { useMe } from '@/services/auth';
import { CalendarSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_LABEL: Record<CalendarDay['status'], string> = {
  'not-logged': 'No entries',
  'no-target': 'Logged',
  under: 'Below goal',
  met: 'Goal met',
  over: 'Above goal',
};

interface Props {
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Accessible month grid backed by persisted data (GET /calendar/month).
 * Arrow keys move by day/week, PageUp/PageDown by month, Home/End within the week,
 * Enter/Space selects. Today and the selected date are styled distinctly.
 */
export function MonthCalendar({ selected, today, onSelect, variant = 'compact', className }: Props) {
  const sel = parseDateString(selected)!;
  const [view, setView] = useState({ year: sel.year, month: sel.month });
  const [focusDate, setFocusDate] = useState(selected);
  const { data: user } = useMe();
  const weekStartsOn = user?.weekStartsOn ?? 0;
  const { data, isLoading, isError, error, refetch, isFetching } = useMonthCalendar(view.year, view.month);
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocus = useRef(false);

  const [prevSelected, setPrevSelected] = useState(selected);
  if (prevSelected !== selected) {
    setPrevSelected(selected);
    setView({ year: sel.year, month: sel.month });
    setFocusDate(selected);
  }

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
  }, [focusDate, view]);

  const weeks = useMemo(() => monthGrid(view.year, view.month, weekStartsOn), [view, weekStartsOn]);
  const dayMap = useMemo(() => new Map((data?.days ?? []).map((d) => [d.date, d])), [data]);
  const weekdays = weekStartsOn === 1 ? [...WEEKDAYS.slice(1), WEEKDAYS[0]!] : WEEKDAYS;
  const full = variant === 'full';

  const moveFocus = (date: string) => {
    const p = parseDateString(date)!;
    shouldFocus.current = true;
    setFocusDate(date);
    if (p.year !== view.year || p.month !== view.month) setView({ year: p.year, month: p.month });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in deltas) {
      e.preventDefault();
      moveFocus(addDays(date, deltas[e.key]!));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const p = parseDateString(date)!;
      const next = shiftMonth(p.year, p.month, e.key === 'PageUp' ? -1 : 1);
      const lastDay = new Date(Date.UTC(next.year, next.month, 0)).getUTCDate();
      moveFocus(`${next.year}-${String(next.month).padStart(2, '0')}-${String(Math.min(p.day, lastDay)).padStart(2, '0')}`);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const dow = (dateFromString(date).getDay() - weekStartsOn + 7) % 7;
      moveFocus(addDays(date, e.key === 'Home' ? -dow : 6 - dow));
    }
  };

  const go = (delta: number) => setView((v) => shiftMonth(v.year, v.month, delta));
  const monthLabel = format(new Date(view.year, view.month - 1, 1), 'MMMM yyyy');

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={cn('font-semibold text-ink', full ? 'text-lg' : 'text-[15px]')} aria-live="polite">
          {monthLabel}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => go(-1)} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <Button variant="soft" size="sm" className="h-8 px-2.5" onClick={() => onSelect(today)}>
            Today
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => go(1)} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <CalendarSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} compact />
      ) : (
        <div ref={gridRef} role="grid" aria-label={`${monthLabel} food log`} aria-busy={isFetching} className={cn(isFetching && 'opacity-70 transition-opacity')}>
          <div role="row" className="mb-1 grid grid-cols-7 gap-1">
            {weekdays.map((d) => (
              <div key={d} role="columnheader" className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-subtle">
                <abbr title={d} className="no-underline">
                  {full ? d : d.slice(0, 2)}
                </abbr>
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div role="row" key={wi} className="grid grid-cols-7 gap-1">
              {week.map((date, di) => {
                if (!date) return <div role="gridcell" key={di} />;
                const info = dayMap.get(date);
                const isSelected = date === selected;
                const isToday = date === today;
                const isFuture = date > today;
                const status = info?.status ?? 'not-logged';
                const label = `${format(dateFromString(date), 'EEEE, d MMMM yyyy')}${isToday ? ', today' : ''}. ${STATUS_LABEL[status]}${info?.logged ? `, ${formatKcal(info.calories)} kcal` : ''}`;
                return (
                  <div role="gridcell" key={date} aria-selected={isSelected}>
                    <button
                      type="button"
                      data-date={date}
                      tabIndex={date === focusDate ? 0 : -1}
                      aria-label={label}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => onSelect(date)}
                      onKeyDown={(e) => onKeyDown(e, date)}
                      onFocus={() => setFocusDate(date)}
                      className={cn(
                        'relative flex w-full flex-col items-center justify-center rounded-lg text-[13px] font-medium transition-colors',
                        full ? 'min-h-16 gap-0.5 border border-transparent p-1 sm:min-h-20 sm:items-start sm:justify-start sm:p-2' : 'aspect-square',
                        isSelected ? 'bg-primary text-primary-ink' : isToday ? 'text-primary ring-1 ring-primary ring-inset' : 'text-ink hover:bg-soft',
                        full && !isSelected && 'border-line',
                        isFuture && !isSelected && 'text-subtle',
                      )}
                    >
                      <span className="tabular">{Number(date.slice(8))}</span>
                      {full && info?.logged && (
                        <span className={cn('hidden text-[11px] tabular sm:block', isSelected ? 'text-primary-ink/90' : 'text-muted')}>{formatKcal(info.calories)} kcal</span>
                      )}
                      <StatusDot status={status} selected={isSelected} full={full} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
          {full && <CalendarLegend />}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status, selected, full }: { status: CalendarDay['status']; selected: boolean; full: boolean }) {
  if (status === 'not-logged') return null;
  const color = selected ? 'bg-primary-ink' : status === 'met' ? 'bg-success' : status === 'over' ? 'bg-danger' : status === 'under' ? 'bg-warning' : 'bg-primary';
  // Shape differs by status too, so meaning doesn't rely on color alone.
  const shape = status === 'over' ? 'rounded-[1px] rotate-45' : status === 'under' ? 'rounded-[1px]' : 'rounded-full';
  return <span aria-hidden className={cn('size-1.5', color, shape, full ? 'sm:absolute sm:right-2 sm:top-2.5' : 'absolute bottom-1')} />;
}

export function CalendarLegend() {
  const items: [CalendarDay['status'], string][] = [
    ['met', 'Within 10% of goal'],
    ['under', 'Below goal'],
    ['over', 'Above goal'],
    ['no-target', 'Logged (no goal)'],
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
      {items.map(([s, label]) => (
        <li key={s} className="flex items-center gap-1.5">
          <LegendDot status={s} />
          {label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm ring-1 ring-primary" aria-hidden /> Today
      </li>
    </ul>
  );
}

function LegendDot({ status }: { status: CalendarDay['status'] }) {
  const color = status === 'met' ? 'bg-success' : status === 'over' ? 'bg-danger' : status === 'under' ? 'bg-warning' : 'bg-primary';
  const shape = status === 'over' ? 'rounded-[1px] rotate-45' : status === 'under' ? 'rounded-[1px]' : 'rounded-full';
  return <span aria-hidden className={cn('inline-block size-2', color, shape)} />;
}
