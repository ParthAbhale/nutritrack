import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Clock, History, ScanBarcode, Search, SearchX, Star, X } from 'lucide-react';
import type { FoodItem } from '@nutritrack/shared';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useCapabilities } from '@/services/auth';
import { useFavorites, useFoodSearch, useRecentFoods, useSearchHistory, useSearchHistoryMutations, type SearchSource, type SearchType } from '@/services/foods';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, ErrorState, Notice } from '@/components/feedback/states';
import { ListSkeleton, SearchResultSkeleton } from '@/components/feedback/skeletons';
import { FoodResultCard, FoodThumb } from './FoodResultCard';
import { BarcodeDialog } from './BarcodeDialog';
import { PROVIDER_LABEL } from './nutrition';

const TYPES: { id: SearchType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'branded', label: 'Branded' },
  { id: 'generic', label: 'Generic' },
];

interface Props {
  onSelect: (food: FoodItem) => void;
  autoFocus?: boolean;
  initialQuery?: string;
  selectedKey?: string | null;
  className?: string;
}

export function FoodSearchPanel({ onSelect, autoFocus, initialQuery = '', selectedKey, className }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<SearchType>('all');
  const [source, setSource] = useState<SearchSource>('auto');
  const [activeState, setActiveState] = useState({ key: '', index: 0 });
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const debounced = useDebouncedValue(query, 350);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const caps = useCapabilities();
  const search = useFoodSearch(debounced, source, type);
  const { record } = useSearchHistoryMutations();

  const items = useMemo(() => search.data?.pages.flatMap((p) => p.items) ?? [], [search.data]);
  const warnings = search.data?.pages[0]?.warnings ?? [];
  const usedProvider = search.data?.pages[0]?.provider;
  const tooShort = query.trim().length > 0 && query.trim().length < 2;
  const searching = debounced.trim().length >= 2;
  const typing = query.trim() !== debounced.trim() && query.trim().length >= 2;

  // Highlight resets to the first result whenever the result set changes.
  const resultsKey = `${debounced}|${type}|${source}`;
  const active = activeState.key === resultsKey ? activeState.index : 0;
  const setActive = (fn: (i: number) => number) => setActiveState({ key: resultsKey, index: fn(active) });
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const choose = (food: FoodItem) => {
    if (searching) record.mutate(debounced.trim());
    onSelect(food);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const food = items[active];
      if (food) choose(food);
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input
            ref={inputRef}
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-activedescendant={items.length ? `${listId}-opt-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Search foods by name, brand or product"
            placeholder="Search foods, brands or products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="h-11 pl-9 pr-20 text-[15px]"
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
          />
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {query && (
              <Button variant="ghost" size="icon-sm" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
                <X />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Scan or enter a barcode" onClick={() => setBarcodeOpen(true)}>
              <ScanBarcode />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Food type" className="inline-flex rounded-[var(--radius-control)] border border-line bg-surface-2 p-0.5">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={type === t.id}
                onClick={() => setType(t.id)}
                className={cn('h-7 rounded-[7px] px-3 text-[12.5px] font-medium', type === t.id ? 'bg-surface text-primary shadow-card' : 'text-muted hover:text-ink')}
              >
                {t.label}
              </button>
            ))}
          </div>
          {(caps.data?.providers.length ?? 0) > 1 && (
            <Select aria-label="Data source" value={source} onChange={(e) => setSource(e.target.value as SearchSource)} className="h-8 w-auto text-[12.5px]">
              <option value="auto">Best available source</option>
              {caps.data!.providers.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </Select>
          )}
          {usedProvider && searching && <span className="text-[12px] text-subtle">Results from {PROVIDER_LABEL[usedProvider]}</span>}
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1" aria-live="polite">
        {caps.data && caps.data.providers.length === 0 && (
          <Notice tone="warning">
            No food database is configured on this server, so search is unavailable. You can still <Link className="font-medium underline" to="/foods?tab=custom">create custom foods</Link>.
          </Notice>
        )}
        {tooShort && <p className="px-1 text-[13px] text-muted">Type at least 2 characters to search.</p>}
        {!searching && !tooShort && <QuickPicks onSelect={onSelect} onQuery={setQuery} />}
        {searching && warnings.map((w) => <div key={w} className="mb-3"><Notice tone="warning">{w}</Notice></div>)}
        {searching && (search.isPending || (typing && !items.length)) && <SearchResultSkeleton />}
        {searching && search.isError && !items.length && (
          <div>
            <ErrorState error={search.error} onRetry={() => search.refetch()} title="Food search is unavailable" />
            <p className="-mt-4 text-center text-[13px] text-muted">
              You can also <Link to="/foods?tab=custom" className="font-medium text-primary">add a custom food</Link> manually.
            </p>
          </div>
        )}
        {searching && search.isSuccess && items.length === 0 && (
          <EmptyState
            icon={SearchX}
            title={`No foods match "${debounced.trim()}"`}
            description="Try a simpler term, check the spelling, switch between branded and generic, or create a custom food."
            action={<Link to="/foods?tab=custom" className="text-sm font-medium text-primary">Create a custom food</Link>}
          />
        )}
        {items.length > 0 && (
          <div className={cn(typing && 'opacity-60 transition-opacity')}>
            <div id={listId} role="listbox" aria-label="Search results" className="grid gap-2.5">
              {items.map((food, i) => (
                <FoodResultCard
                  key={`${food.provider}:${food.providerFoodId}`}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  food={food}
                  active={i === active || selectedKey === `${food.provider}:${food.providerFoodId}`}
                  onSelect={choose}
                />
              ))}
            </div>
            {search.hasNextPage && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={() => search.fetchNextPage()} loading={search.isFetchingNextPage}>
                  Load more results
                </Button>
              </div>
            )}
            {search.isFetchNextPageError && <p className="mt-2 text-center text-[13px] text-danger">Couldn't load more results. Try again.</p>}
          </div>
        )}
      </div>
      <BarcodeDialog open={barcodeOpen} onOpenChange={setBarcodeOpen} onFound={onSelect} />
    </div>
  );
}

/** Shown before typing: recent foods, favorites and recent searches. */
function QuickPicks({ onSelect, onQuery }: { onSelect: (food: FoodItem) => void; onQuery: (q: string) => void }) {
  const recent = useRecentFoods();
  const favorites = useFavorites();
  const history = useSearchHistory();
  const { clear } = useSearchHistoryMutations();

  const row = (food: FoodItem, sub: string, key: string) => (
    <button key={key} type="button" onClick={() => onSelect(food)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-soft">
      <FoodThumb food={food} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{food.name}</span>
        <span className="block truncate text-[12px] text-muted">{sub}</span>
      </span>
    </button>
  );

  return (
    <div className="space-y-5">
      {(history.data?.length ?? 0) > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-subtle"><History className="size-3.5" /> Recent searches</h3>
            <button type="button" className="text-[12px] text-muted hover:text-ink" onClick={() => clear.mutate()}>Clear</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {history.data!.slice(0, 8).map((h) => (
              <button key={h.query} type="button" onClick={() => onQuery(h.query)} className="rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] text-ink hover:border-primary/50">
                {h.query}
              </button>
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-subtle"><Clock className="size-3.5" /> Recently logged</h3>
        {recent.isPending ? <ListSkeleton rows={3} label="Loading recent foods" /> : recent.isError ? <ErrorState error={recent.error} onRetry={() => recent.refetch()} compact /> : recent.data.length === 0 ? (
          <p className="px-2 py-2 text-[13px] text-muted">Foods you log will appear here for quick re-logging.</p>
        ) : (
          recent.data.slice(0, 6).map((r) => row(r.food, `${r.food.brand ?? 'Generic'} · logged ${r.timesLogged}×`, `r-${r.food.provider}-${r.food.providerFoodId}`))
        )}
      </section>
      <section>
        <h3 className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-subtle"><Star className="size-3.5" /> Favorites</h3>
        {favorites.isPending ? <ListSkeleton rows={2} label="Loading favorites" /> : favorites.isError ? <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} compact /> : favorites.data.length === 0 ? (
          <p className="px-2 py-2 text-[13px] text-muted">Star a food to keep it here.</p>
        ) : (
          favorites.data.slice(0, 6).map((f) => row(f.food, f.food.brand ?? f.food.category ?? 'Favorite', `f-${f.id}`))
        )}
      </section>
    </div>
  );
}
