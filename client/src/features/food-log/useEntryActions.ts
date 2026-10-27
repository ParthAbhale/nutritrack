import { toast } from 'sonner';
import type { DiaryEntry, Meal } from '@nutritrack/shared';
import { useDeleteEntry, useDuplicateEntry, useRestoreEntry, useUpdateEntry } from '@/services/diary';
import { errorMessage } from '@/lib/api';
import { newRequestId } from '@/lib/utils';

/** Diary entry mutations with consistent feedback, including undo for deletes. */
export function useEntryActions() {
  const del = useDeleteEntry();
  const restore = useRestoreEntry();
  const dup = useDuplicateEntry();
  const update = useUpdateEntry();

  return {
    pending: del.isPending || dup.isPending || update.isPending,
    remove: (entry: DiaryEntry) =>
      del.mutateAsync(entry.id).then(
        () =>
          toast.success(`Removed ${entry.food.name}`, {
            action: {
              label: 'Undo',
              onClick: () => restore.mutate(entry.id, { onError: (e) => toast.error(errorMessage(e)) }),
            },
          }),
        (e) => toast.error(errorMessage(e)),
      ),
    duplicate: (entry: DiaryEntry, target?: { date?: string; meal?: Meal }) =>
      dup.mutateAsync({ id: entry.id, ...target, clientRequestId: newRequestId('dup') }).then(
        () => toast.success(`Duplicated ${entry.food.name}`),
        (e) => toast.error(errorMessage(e)),
      ),
    move: (entry: DiaryEntry, input: { meal?: Meal; date?: string }) =>
      update.mutateAsync({ id: entry.id, input }).then(
        () => toast.success(input.date ? `Moved to ${input.date}` : 'Entry moved'),
        (e) => toast.error(errorMessage(e)),
      ),
  };
}
