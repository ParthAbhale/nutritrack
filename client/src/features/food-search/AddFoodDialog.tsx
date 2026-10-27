import { useState } from 'react';
import type { FoodItem, Meal } from '@nutritrack/shared';
import { useAddFoodStore } from '@/lib/stores';
import { useSelectedDate } from '@/hooks/useSelectedDate';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FoodSearchPanel } from './FoodSearchPanel';
import { FoodDetailLogger } from './AddFoodFlow';

/**
 * App-wide "add food" dialog: search → choose serving → save. The search panel
 * stays mounted while the detail step is open so "Back" keeps the query and results.
 */
export function AddFoodDialog() {
  const { open, meal, date, food, close } = useAddFoodStore();
  const [selected] = useSelectedDate();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && <AddFoodBody initialFood={food} meal={meal} date={date ?? selected} onDone={close} />}
    </Dialog>
  );
}

function AddFoodBody({ initialFood, meal, date, onDone }: { initialFood: FoodItem | null; meal: Meal; date: string; onDone: () => void }) {
  const [food, setFood] = useState<FoodItem | null>(initialFood);
  return (
    <DialogContent
      variant="sheet"
      title={food ? 'Add to diary' : 'Add food'}
      description={food ? 'Choose a serving and meal, then save.' : 'Search by food name or brand, scan a barcode, or pick a recent item.'}
      className="sm:max-w-xl"
    >
      {food && <FoodDetailLogger food={food} meal={meal} date={date} onBack={initialFood ? undefined : () => setFood(null)} onLogged={onDone} />}
      {!initialFood && (
        <div hidden={Boolean(food)}>
          <FoodSearchPanel onSelect={setFood} autoFocus />
        </div>
      )}
    </DialogContent>
  );
}
