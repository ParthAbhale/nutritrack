import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import type { UserProfile } from '@nutritrack/shared';
import { keys } from '@/services/keys';

export const testUser: UserProfile = {
  id: 'u1', name: 'Test User', email: 't@example.com', emailVerified: true, dateOfBirth: null, sex: 'unspecified', heightCm: 170,
  unitSystem: 'metric', timeZone: 'UTC', weekStartsOn: 0, theme: 'light', activityLevel: 'light', weightGoal: 'maintain', targetWeightKg: null,
  dietaryPreferences: [], allergens: ['peanuts'], excludedFoods: [],
  meals: [
    { id: 'breakfast', name: 'Breakfast', time: '08:00' },
    { id: 'lunch', name: 'Lunch', time: '13:00' },
    { id: 'dinner', name: 'Dinner', time: '19:00' },
    { id: 'snacks', name: 'Snacks', time: null },
  ],
  notifications: { mealReminders: false, hydrationReminders: false, goalProgress: true, email: false, hydrationIntervalHours: 2 },
  milestones: [], onboardingCompleted: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', profileUpdatedAt: '2026-01-01T00:00:00Z',
};

export function renderWithProviders(ui: ReactNode, { user = testUser as UserProfile | null, route = '/', seed }: { user?: UserProfile | null; route?: string; seed?: (c: QueryClient) => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(keys.me, user);
  client.setQueryData(keys.favorites, []);
  seed?.(client);
  return { client, ...render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></QueryClientProvider>) };
}

/** Minimal fetch mock keyed by "METHOD path" (path without /api/v1 and query). */
export function mockFetch(routes: Record<string, (url: URL, init?: RequestInit) => { status?: number; body?: unknown }>) {
  const calls: { method: string; url: URL; init?: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    calls.push({ method, url, init });
    const key = `${method} ${url.pathname.replace('/api/v1', '')}`;
    const handler = routes[key];
    if (!handler) return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: `No mock for ${key}` } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    const { status = 200, body } = handler(url, init);
    return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}
