import { useMemo, useRef, useState } from 'react';
import { CopyX } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, isValidDateString } from '@nutritrack/shared';
import { useCopyDay, useDailySummary } from '@/services/diary';
import { errorMessage } from '@/lib/api';
import { formatDate, formatKcal } from '@/lib/format';
import { newRequestId } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ListSkeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState, InlineError } from '@/components/feedback/states';

/**
 * Review-then-confirm copy of another day's entries into `targetDate`.
 * Creates new entries; the source day is never modified. The request id is
 * kept until the selection changes, so a retried request cannot duplicate entries.
 */
export function CopyDayDialog({ open, onOpenChange, targetDate }: { open: boolean; onOpenChange: (o: boolean) => void; targetDate: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <CopyDayBody targetDate={targetDate} onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function CopyDayBody({ targetDate, onClose }: { targetDate: string; onClose: () => void }) {
  const [source, setSourceState] = useState(addDays(targetDate, -1));
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const requestId = useRef(newRequestId('copy'));
  const validSource = isValidDateString(source) && source !== targetDate;
  const summary = useDailySummary(validSource ? source : targetDate);
  const copy = useCopyDay();

  const setSource = (value: string) => {
    setSourceState(value);
    setDeselected(new Set());
    requestId.current = newRequestId('copy');
  };
  const toggle = (id: string, checked: boolean) => {
    const next = new Set(deselected);
    if (checked) next.delete(id);
    else next.add(id);
    setDeselected(next);
    requestId.current = newRequestId('copy');
  };

  const entries = useMemo(
    () => (validSource && summary.data?.date === source ? summary.data.meals.flatMap((m) => m.entries.map((e) => ({ ...e, mealName: m.name }))) : []),
    [summary.data, source, validSource],
  );
  const chosen = entries.filter((e) => !deselected.has(e.id));
  const kcal = chosen.reduce((s, e) => s + (e.nutrients.calories ?? 0), 0);
  const allSelected = chosen.length === entries.length;

  return (
    <DialogContent
      variant="sheet"
      title="Copy meals from another day"
      description={`Selected entries will be added to ${formatDate(targetDate)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={copy.isPending}>Cancel</Button>
          <Button
            disabled={chosen.length === 0}
            loading={copy.isPending}
            onClick={() =>
              copy.mutate(
                { fromDate: source, toDate: targetDate, entryIds: chosen.map((e) => e.id), clientRequestId: requestId.current },
                {
                  onSuccess: (r) => {
                    toast.success(r.created ? `Copied ${r.created} entr${r.created === 1 ? 'y' : 'ies'}` : 'These entries were already copied');
                    onClose();
                  },
                },
              )
            }
          >
            Copy {chosen.length || ''} entr{chosen.length === 1 ? 'y' : 'ies'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Copy from" error={!validSource ? 'Choose a different, valid date' : undefined}>
          {(p) => <Input {...p} type="date" value={source} onChange={(e) => setSource(e.target.value)} />}
        </Field>
        {!validSource ? null : summary.isPending || summary.data?.date !== source ? (
          summary.isError ? <ErrorState error={summary.error} onRetry={() => summary.refetch()} compact /> : <ListSkeleton rows={3} label="Loading entries" />
        ) : entries.length === 0 ? (
          <EmptyState compact icon={CopyX} title="Nothing to copy" description={`No entries were logged on ${formatDate(source)}.`} />
        ) : (
          <fieldset>
            <legend className="mb-2 flex w-full items-center justify-between text-[13px] text-muted">
              <span>Review entries ({chosen.length} selected · {formatKcal(kcal)} kcal)</span>
              <button
                type="button"
                className="text-primary"
                onClick={() => {
                  setDeselected(allSelected ? new Set(entries.map((e) => e.id)) : new Set());
                  requestId.current = newRequestId('copy');
                }}
              >
                {allSelected ? 'Select none' : 'Select all'}
              </button>
            </legend>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {entries.map((e) => (
                <li key={e.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={!deselected.has(e.id)} onChange={(ev) => toggle(e.id, ev.target.checked)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{e.food.name}</span>
                      <span className="block truncate text-[12px] text-muted">{e.mealName} · {e.quantity} × {e.servingLabel}</span>
                    </span>
                    <span className="text-[13px] tabular text-muted">{formatKcal(e.nutrients.calories)} kcal</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {copy.isError && <InlineError message={errorMessage(copy.error)} />}
      </div>
    </DialogContent>
  );
}
