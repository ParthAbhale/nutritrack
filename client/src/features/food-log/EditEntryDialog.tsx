import { toast } from 'sonner';
import type { DiaryEntry } from '@nutritrack/shared';
import { useUpdateEntry } from '@/services/diary';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LogFoodForm } from '@/features/food-search/LogFoodForm';

/** Edits recalculate from the entry's saved snapshot (the server does the same). */
export function EditEntryDialog({ entry, open, onOpenChange }: { entry: DiaryEntry; open: boolean; onOpenChange: (open: boolean) => void }) {
  const update = useUpdateEntry();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" title="Edit entry" description="Nutrition is recalculated from the values saved when you logged this food.">
        {open && (
          <LogFoodForm
            food={entry.food}
            initial={{ servingId: entry.servingId, quantity: entry.quantity, meal: entry.meal, date: entry.date, notes: entry.notes }}
            submitLabel="Save changes"
            onCancel={() => onOpenChange(false)}
            onSubmit={async (v) => {
              await update.mutateAsync({ id: entry.id, input: { servingId: v.servingId, quantity: v.quantity, meal: v.meal, date: v.date, notes: v.notes } });
              toast.success('Entry updated');
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
