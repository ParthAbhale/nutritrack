import { useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { FoodItem, Meal } from '@nutritrack/shared';
import { useCreateEntry } from '@/services/diary';
import { useFoodDetail } from '@/services/foods';
import { useMe } from '@/services/auth';
import { newRequestId } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/states';
import { LogFoodForm } from './LogFoodForm';

/**
 * Loads full details for a food (when the search result was summary-level),
 * then shows the log form. One idempotency key per selected food: retries of
 * a failed save reuse it, so a save that actually succeeded is never duplicated.
 */
export function FoodDetailLogger({ food, meal, date, onBack, onLogged }: { food: FoodItem; meal: Meal; date: string; onBack?: () => void; onLogged?: () => void }) {
  const needsDetail = !food.detailed;
  const detail = useFoodDetail(needsDetail ? { provider: food.provider, foodId: food.providerFoodId } : null);
  const create = useCreateEntry();
  const { data: user } = useMe();
  const requestId = useRef(newRequestId('entry'));
  const resolved = needsDetail ? (detail.data ?? (detail.isError ? food : null)) : food;

  if (!resolved) {
    return (
      <div className="space-y-4">
        {onBack && <BackButton onBack={onBack} />}
        {detail.isError ? <ErrorState error={detail.error} onRetry={() => detail.refetch()} /> : <FormSkeleton fields={4} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onBack && <BackButton onBack={onBack} />}
      {needsDetail && detail.isError && (
        <p className="text-[12px] text-muted">Detailed serving sizes couldn't be loaded, so only gram-based servings are available.</p>
      )}
      <LogFoodForm
        key={`${resolved.provider}:${resolved.providerFoodId}`}
        food={resolved}
        initial={{ meal, date }}
        submitLabel="Add to diary"
        onCancel={onBack}
        onSubmit={async (v) => {
          await create.mutateAsync({
            date: v.date,
            meal: v.meal,
            food: { provider: resolved.provider, foodId: resolved.providerFoodId },
            servingId: v.servingId,
            quantity: v.quantity,
            notes: v.notes,
            clientRequestId: requestId.current,
          });
          requestId.current = newRequestId('entry');
          const mealName = user?.meals.find((m) => m.id === v.meal)?.name ?? v.meal;
          toast.success(`Added ${resolved.name} to ${mealName}`);
          onLogged?.();
        }}
      />
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
      <ArrowLeft /> Back to results
    </Button>
  );
}
