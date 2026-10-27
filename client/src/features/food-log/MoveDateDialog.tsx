import { useState } from 'react';
import { isValidDateString, type DiaryEntry } from '@nutritrack/shared';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useEntryActions } from './useEntryActions';

export function MoveDateDialog({ entry, open, onOpenChange }: { entry: DiaryEntry; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [date, setDate] = useState(entry.date);
  const [mode, setMode] = useState<'move' | 'copy'>('move');
  const [pending, setPending] = useState(false);
  const actions = useEntryActions();
  const invalid = !isValidDateString(date) || (mode === 'move' && date === entry.date);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Change date"
        description={`Move or copy ${entry.food.name} to another day.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button
              loading={pending}
              disabled={invalid}
              onClick={async () => {
                setPending(true);
                await (mode === 'move' ? actions.move(entry, { date }) : actions.duplicate(entry, { date }));
                setPending(false);
                onOpenChange(false);
              }}
            >
              {mode === 'move' ? 'Move entry' : 'Copy entry'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Action" className="flex gap-2">
            {(['move', 'copy'] as const).map((m) => (
              <label key={m} className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-line p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-soft">
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="accent-[var(--primary)]" />
                {m === 'move' ? 'Move (keep one entry)' : 'Copy (keep both)'}
              </label>
            ))}
          </div>
          <Field label="Date" error={isValidDateString(date) ? undefined : 'Choose a valid date'}>
            {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
