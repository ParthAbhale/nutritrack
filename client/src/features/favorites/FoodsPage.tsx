import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, Heart, NotebookPen, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CustomFood, FoodItem } from '@nutritrack/shared';
import { useCustomFoodMutations, useCustomFoods, useFavoriteMutations, useFavorites, useRecentFoods } from '@/services/foods';
import { useMe } from '@/services/auth';
import { keys } from '@/services/keys';
import { api, errorMessage } from '@/lib/api';
import { useAddFoodStore } from '@/lib/stores';
import { formatKcal, formatNutrient, relativeTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListSkeleton } from '@/components/feedback/skeletons';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { FoodThumb } from '@/features/food-search/FoodResultCard';
import { defaultServingNutrition, PROVIDER_LABEL } from '@/features/food-search/nutrition';
import { CustomFoodDialog } from './CustomFoodDialog';

const TABS = ['favorites', 'recent', 'custom'] as const;
type Tab = (typeof TABS)[number];

const matches = (filter: string, ...fields: (string | null | undefined)[]) => {
  const f = filter.trim().toLowerCase();
  return !f || fields.some((x) => x?.toLowerCase().includes(f));
};

export default function FoodsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : 'favorites';
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<CustomFood | 'new' | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Favorites & my foods"
        description="Quickly re-log foods you eat often, or add foods that aren't in the databases."
        actions={<Button onClick={() => setEditing('new')}><Plus /> New custom food</Button>}
      />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'favorites' ? {} : { tab: v }, { replace: true })}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="favorites"><Star /> Favorites</TabsTrigger>
            <TabsTrigger value="recent"><Clock /> Recent</TabsTrigger>
            <TabsTrigger value="custom"><NotebookPen /> My custom foods</TabsTrigger>
          </TabsList>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input aria-label="Filter foods" placeholder="Filter by name or brand…" className="pl-9" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </div>
        <TabsContent value="favorites" className="mt-5"><FavoritesTab filter={filter} /></TabsContent>
        <TabsContent value="recent" className="mt-5"><RecentTab filter={filter} /></TabsContent>
        <TabsContent value="custom" className="mt-5"><CustomTab filter={filter} onEdit={setEditing} /></TabsContent>
      </Tabs>
      {editing && <CustomFoodDialog food={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FoodRow({ food, meta, actions }: { food: FoodItem; meta: ReactNode; actions: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <FoodThumb food={food} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{food.name}</p>
          <p className="truncate text-[12px] text-muted">{meta}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </li>
  );
}

function kcalSummary(food: FoodItem) {
  const n = defaultServingNutrition(food);
  const serving = food.servings.find((s) => s.id === food.defaultServingId);
  return n ? `${formatKcal(n.nutrients.calories)} kcal · ${serving?.label ?? ''}` : 'Nutrition unavailable';
}

function FavoritesTab({ filter }: { filter: string }) {
  const favorites = useFavorites();
  const { remove } = useFavoriteMutations();
  const openAddFood = useAddFoodStore((s) => s.openAddFood);
  if (favorites.isPending) return <Card className="px-5"><ListSkeleton rows={5} label="Loading favorites" /></Card>;
  if (favorites.isError) return <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} />;
  if (favorites.data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Heart}
          title="No favorites yet"
          description="Tap the heart on any food while logging it to keep it here for one-tap logging."
          action={<Link to="/search" className="text-sm font-medium text-primary">Search foods</Link>}
        />
      </Card>
    );
  }
  const list = favorites.data.filter((f) => matches(filter, f.food.name, f.food.brand));
  if (list.length === 0) return <Card><EmptyState icon={Search} title="No favorites match your filter" compact /></Card>;
  return (
    <Card>
      <ul className="divide-y divide-line">
        {list.map((f) => (
          <FoodRow
            key={f.id}
            food={f.food}
            meta={<>{f.food.brand ?? PROVIDER_LABEL[f.food.provider]} · {kcalSummary(f.food)}</>}
            actions={
              <>
                <Button size="sm" onClick={() => openAddFood({ food: f.food })}><Plus /> Log</Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${f.food.name} from favorites`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(f.id, { onSuccess: () => toast.success('Removed from favorites'), onError: (e) => toast.error(errorMessage(e)) })}
                >
                  <Heart className="fill-danger text-danger" />
                </Button>
              </>
            }
          />
        ))}
      </ul>
    </Card>
  );
}

function RecentTab({ filter }: { filter: string }) {
  const recent = useRecentFoods();
  const { data: user } = useMe();
  const openAddFood = useAddFoodStore((s) => s.openAddFood);
  if (recent.isPending) return <Card className="px-5"><ListSkeleton rows={5} label="Loading recent foods" /></Card>;
  if (recent.isError) return <ErrorState error={recent.error} onRetry={() => recent.refetch()} />;
  if (recent.data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Clock}
          title="No recent foods"
          description="Foods you log appear here so you can repeat them quickly."
          action={<Button onClick={() => openAddFood()}><Plus /> Log a food</Button>}
        />
      </Card>
    );
  }
  const mealName = (id: string) => user?.meals.find((m) => m.id === id)?.name ?? id;
  const list = recent.data.filter((r) => matches(filter, r.food.name, r.food.brand));
  if (list.length === 0) return <Card><EmptyState icon={Search} title="No recent foods match your filter" compact /></Card>;
  return (
    <Card>
      <ul className="divide-y divide-line">
        {list.map((r) => {
          const serving = r.food.servings.find((s) => s.id === r.lastServingId);
          return (
            <FoodRow
              key={`${r.food.provider}:${r.food.providerFoodId}`}
              food={r.food}
              meta={
                <>
                  Last: {formatNutrient(r.lastQuantity)} × {serving?.label ?? 'serving'} · {mealName(r.lastMeal)} · {relativeTime(r.lastLoggedAt)} · logged {r.timesLogged}×
                </>
              }
              actions={<Button size="sm" variant="secondary" onClick={() => openAddFood({ food: r.food, meal: r.lastMeal })}><Plus /> Log again</Button>}
            />
          );
        })}
      </ul>
    </Card>
  );
}

function CustomTab({ filter, onEdit }: { filter: string; onEdit: (food: CustomFood | 'new') => void }) {
  const custom = useCustomFoods();
  const { remove } = useCustomFoodMutations();
  const qc = useQueryClient();
  const openAddFood = useAddFoodStore((s) => s.openAddFood);
  const [deleting, setDeleting] = useState<CustomFood | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  if (custom.isPending) return <Card className="px-5"><ListSkeleton rows={4} label="Loading custom foods" /></Card>;
  if (custom.isError) return <ErrorState error={custom.error} onRetry={() => custom.refetch()} />;
  if (custom.data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={NotebookPen}
          title="No custom foods yet"
          description="Can't find a food in search? Create it from its nutrition label. Custom foods are private to you."
          action={<Button onClick={() => onEdit('new')}><Plus /> Create a custom food</Button>}
        />
      </Card>
    );
  }

  const log = async (food: CustomFood) => {
    setLoggingId(food.id);
    try {
      const item = await qc.fetchQuery({
        queryKey: keys.food('custom', food.id),
        queryFn: () => api.data<FoodItem>(`/foods/custom/${food.id}`),
        staleTime: 0,
      });
      openAddFood({ food: item });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoggingId(null);
    }
  };

  const list = custom.data.filter((f) => matches(filter, f.name, f.brand));
  return (
    <>
      {list.length === 0 ? (
        <Card><EmptyState icon={Search} title="No custom foods match your filter" compact /></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {list.map((f) => (
              <li key={f.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">{f.name}</p>
                    <Badge tone="primary">Manually entered</Badge>
                  </div>
                  <p className="truncate text-[12px] text-muted">
                    {f.brand ? `${f.brand} · ` : ''}1 {f.servingLabel}{f.servingGrams ? ` (${formatNutrient(f.servingGrams)} g)` : ''} · {formatKcal(f.nutrients.calories)} kcal · P {formatNutrient(f.nutrients.protein)} g · C {formatNutrient(f.nutrients.carbs)} g · F {formatNutrient(f.nutrients.fat)} g
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" loading={loggingId === f.id} onClick={() => void log(f)}><Plus /> Log</Button>
                  <Button variant="secondary" size="icon-sm" aria-label={`Edit ${f.name}`} onClick={() => onEdit(f)}><Pencil /></Button>
                  <Button variant="danger-ghost" size="icon-sm" aria-label={`Delete ${f.name}`} onClick={() => setDeleting(f)}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete custom food?"
        description={<>“{deleting?.name}” will be deleted and removed from your favorites. Diary entries already logged keep their values.</>}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success('Custom food deleted');
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
    </>
  );
}
