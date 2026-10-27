import { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import type { FoodItem } from '@nutritrack/shared';
import { useSelectedDate } from '@/hooks/useSelectedDate';
import { suggestMeal } from '@/lib/stores';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback/states';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { PageHeader } from '@/components/layout/PageHeader';
import { FoodSearchPanel } from './FoodSearchPanel';
import { FoodDetailLogger } from './AddFoodFlow';

/** Full-page search: results on the left, the selected food's detail on the right (dialog on small screens). */
export default function SearchPage() {
  const [food, setFood] = useState<FoodItem | null>(null);
  const [date] = useSelectedDate();
  const wide = useMediaQuery('(min-width: 1024px)');
  const key = food ? `${food.provider}:${food.providerFoodId}` : null;
  const detail = food && <FoodDetailLogger key={key} food={food} meal={suggestMeal()} date={date} onLogged={() => setFood(null)} />;

  return (
    <div className="space-y-5">
      <PageHeader title="Food search" description="Search branded and generic foods from the configured nutrition databases." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="p-4 sm:p-5">
          <FoodSearchPanel onSelect={setFood} autoFocus selectedKey={key} />
        </Card>
        {wide ? (
          <Card className="sticky top-20 h-fit p-5">
            {detail ?? <EmptyState icon={SearchIcon} title="Select a food" description="Pick a result to choose a serving size, preview its nutrition and add it to your diary." />}
          </Card>
        ) : (
          <Dialog open={Boolean(food)} onOpenChange={(o) => !o && setFood(null)}>
            <DialogContent variant="sheet" title="Add to diary">{detail}</DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
