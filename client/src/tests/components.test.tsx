import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyTotals, goalProgress, type DailySummary } from '@nutritrack/shared';
import { MetricCards } from '@/features/dashboard/MetricCards';
import { LogFoodForm } from '@/features/food-search/LogFoodForm';
import { MonthCalendar } from '@/features/calendar/MonthCalendar';
import { FoodSearchPanel } from '@/features/food-search/FoodSearchPanel';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { ApiError, setCsrfToken } from '@/lib/api';
import { keys } from '@/services/keys';
import { Apple } from 'lucide-react';
import { food } from './logic.test';
import { mockFetch, renderWithProviders } from './utils';

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfToken(null);
});

function summary(calories: number, target: number): DailySummary {
  const totals = emptyTotals();
  totals.values = { ...totals.values, calories, protein: 50, carbs: 100, fat: 30 };
  totals.count = 2;
  totals.missing.protein = 1;
  const goal = { id: 'g', effectiveFrom: '2026-01-01', calories: target, protein: 100, carbs: 200, fat: 60, fiber: null, waterMl: 2000, source: 'manual' as const, createdAt: '', updatedAt: '' };
  return {
    date: '2026-10-27', logged: true, totals, meals: [], waterMl: 0, goal,
    progress: { calories: goalProgress(calories, target), protein: goalProgress(50, 100), carbs: goalProgress(100, 200), fat: goalProgress(30, 60), water: goalProgress(0, 2000) },
    macroCalories: { protein: 200, carbs: 400, fat: 270, total: 870 },
  };
}

describe('MetricCards', () => {
  it('shows exceeded targets without clamping and flags missing data', () => {
    renderWithProviders(<MetricCards summary={summary(2400, 2000)} />);
    expect(screen.getByText('400 kcal over target')).toBeInTheDocument();
    expect(screen.getByText('120%')).toBeInTheDocument();
    expect(screen.getByText(/1 entry lacks protein data/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Calories progress' })).toHaveAttribute('aria-valuenow', '120');
  });
});

describe('LogFoodForm', () => {
  it('previews nutrition, validates quantity and warns about allergens', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<LogFoodForm food={food} initial={{ meal: 'breakfast', date: '2026-10-27' }} submitLabel="Add to diary" onSubmit={onSubmit} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/peanuts/);
    const qty = screen.getByLabelText('Number of servings');
    await user.clear(qty);
    await user.type(qty, '1.5');
    expect(screen.getByText('285')).toBeInTheDocument();
    expect(screen.getByText(/Total amount: 48 g/)).toBeInTheDocument();

    await user.clear(qty);
    await user.type(qty, '-2');
    expect(screen.getByText('Quantity must be greater than 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to diary' })).toBeDisabled();

    await user.clear(qty);
    await user.type(qty, '2');
    await user.selectOptions(screen.getByLabelText('Meal'), 'lunch');
    await user.click(screen.getByRole('button', { name: 'Add to diary' }));
    expect(onSubmit).toHaveBeenCalledWith({ servingId: 'label', quantity: 2, meal: 'lunch', date: '2026-10-27', notes: null });
  });

  it('keeps entered values and shows the error when saving fails', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(503, 'PROVIDER_UNAVAILABLE', 'Provider down'));
    renderWithProviders(<LogFoodForm food={food} initial={{ meal: 'dinner', date: '2026-10-27' }} submitLabel="Save" onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Notes/), 'homemade');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Provider down')).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes/)).toHaveValue('homemade');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

describe('MonthCalendar', () => {
  const month = {
    year: 2024, month: 2,
    days: Array.from({ length: 29 }, (_, i) => {
      const date = `2024-02-${String(i + 1).padStart(2, '0')}`;
      const logged = date === '2024-02-10';
      return { date, logged, entryCount: logged ? 2 : 0, calories: logged ? 1900 : null, calorieTarget: 2000, status: logged ? ('met' as const) : ('not-logged' as const), waterMl: 0 };
    }),
    stats: {} as never,
  };

  it('renders persisted days with leap-year alignment and supports keyboard navigation', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(<MonthCalendar selected="2024-02-10" today="2024-02-29" onSelect={onSelect} />, { seed: (c) => c.setQueryData(keys.month(2024, 2), month) });
    const grid = await screen.findByRole('grid', { name: /February 2024/ });
    const cells = within(grid).getAllByRole('button');
    expect(cells).toHaveLength(29);
    // 1 Feb 2024 was a Thursday: four empty leading cells in a Sunday-first grid.
    expect(within(grid).getAllByRole('gridcell').slice(0, 5).map((c) => c.textContent)).toEqual(['', '', '', '', '1']);
    expect(screen.getByRole('button', { name: /Saturday, 10 February 2024\. Goal met, 1900 kcal/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: /Thursday, 29 February 2024, today\. No entries/ })).toHaveAttribute('aria-current', 'date');

    screen.getByRole('button', { name: /10 February/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toHaveAccessibleName(/Sunday, 11 February 2024/);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toHaveAccessibleName(/18 February/);
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('2024-02-18');
  });
});

describe('FoodSearchPanel', () => {
  it('waits for 2+ characters, debounces, and renders distinct provider results', async () => {
    const user = userEvent.setup();
    const { calls } = mockFetch({
      'GET /capabilities': () => ({ body: { data: { emailDelivery: false, providers: [{ id: 'usda', label: 'USDA FoodData Central', configured: true, barcode: true }], primaryProvider: 'usda' } } }),
      'GET /foods/recent': () => ({ body: { data: [] } }),
      'GET /foods/search-history': () => ({ body: { data: [] } }),
      'GET /foods/search': (url) => ({
        body: {
          data: { items: [food, { ...food, providerFoodId: '2', brand: 'Other Brand' }], provider: 'usda', warnings: [] },
          meta: { page: Number(url.searchParams.get('page')), pageSize: 20, total: 2, hasMore: false },
        },
      }),
    });
    const onSelect = vi.fn();
    renderWithProviders(<FoodSearchPanel onSelect={onSelect} />);
    const input = screen.getByRole('combobox', { name: /Search foods/ });
    await user.type(input, 'p');
    expect(screen.getByText('Type at least 2 characters to search.')).toBeInTheDocument();
    await user.type(input, 'eanut');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    const searches = calls.filter((c) => c.url.pathname.endsWith('/foods/search'));
    expect(searches).toHaveLength(1);
    expect(searches[0]!.url.searchParams.get('q')).toBe('peanut');
    expect(screen.getByText(/Other Brand/)).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ brand: 'Other Brand' }));
  });

  it('shows a retryable error when the provider is unavailable', async () => {
    const user = userEvent.setup();
    let fail = true;
    mockFetch({
      'GET /capabilities': () => ({ body: { data: { emailDelivery: false, providers: [], primaryProvider: null } } }),
      'GET /foods/recent': () => ({ body: { data: [] } }),
      'GET /foods/search-history': () => ({ body: { data: [] } }),
      'GET /foods/search': () =>
        fail
          ? { status: 503, body: { error: { code: 'PROVIDER_UNAVAILABLE', message: 'USDA FoodData Central is unavailable right now.' } } }
          : { body: { data: { items: [food], provider: 'usda', warnings: [] }, meta: { page: 1, pageSize: 20, total: 1, hasMore: false } } },
    });
    renderWithProviders(<FoodSearchPanel onSelect={vi.fn()} />);
    await user.type(screen.getByRole('combobox', { name: /Search foods/ }), 'rice');
    expect(await screen.findByText('Food search is unavailable')).toBeInTheDocument();
    expect(screen.getByText(/USDA FoodData Central is unavailable/)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
  });
});

describe('feedback states', () => {
  it('renders empty and error states with actions', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    renderWithProviders(
      <>
        <EmptyState icon={Apple} title="No favorites yet" description="Star a food" />
        <ErrorState error={new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server.')} onRetry={retry} />
      </>,
    );
    expect(screen.getByText('No favorites yet')).toBeInTheDocument();
    expect(screen.getByText(/offline or the server is unreachable/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(retry).toHaveBeenCalled();
  });
});
