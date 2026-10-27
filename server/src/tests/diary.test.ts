import { describe, expect, it } from 'vitest';
import { addDays, todayInTimeZone } from '@nutritrack/shared';
import { FoodLog } from '../models';
import { registeredClient, uniqueId, useTestApp, type TestClient } from './helpers';

const app = useTestApp();
const today = todayInTimeZone('UTC');

function logFood(client: TestClient, overrides: Record<string, unknown> = {}) {
  return client.post('/api/v1/diary/entries', {
    date: today,
    meal: 'breakfast',
    food: { provider: 'fixture', foodId: 'fx-pb-creamy' },
    servingId: 'label',
    quantity: 1.5,
    clientRequestId: uniqueId(),
    ...overrides,
  });
}

describe('food search', () => {
  it('returns distinct branded and generic results from the configured provider', async () => {
    const { client } = await registeredClient(app());
    const res = await client.get('/api/v1/foods/search?q=peanut%20butter').expect(200);
    expect(res.body.data.provider).toBe('fixture');
    const items = res.body.data.items as { name: string; brand: string | null; nutrients: { calories: number } }[];
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(new Set(items.map((i) => `${i.name}|${i.brand}`)).size).toBe(items.length);
    expect(res.body.meta).toMatchObject({ page: 1, hasMore: false });
    const generic = await client.get('/api/v1/foods/search?q=rice&type=generic').expect(200);
    expect(generic.body.data.items.every((i: { kind: string }) => i.kind === 'generic')).toBe(true);
  });

  it('validates the query and reports provider outages without inventing results', async () => {
    const { client } = await registeredClient(app());
    await client.get('/api/v1/foods/search?q=a').expect(400);
    const outage = await client.get('/api/v1/foods/search?q=fixture-outage').expect(503);
    expect(outage.body.error.code).toBe('PROVIDER_UNAVAILABLE');
    await client.get('/api/v1/foods/search?q=rice&source=usda').expect(400);
  });

  it('looks up barcodes and reports not-found honestly', async () => {
    const { client } = await registeredClient(app());
    const hit = await client.get('/api/v1/foods/barcode/00000000000017').expect(200);
    expect(hit.body.data.name).toBe('Creamy Peanut Butter');
    await client.get('/api/v1/foods/barcode/12345678').expect(404);
    await client.get('/api/v1/foods/barcode/abc').expect(400);
  });
});

describe('diary entries', () => {
  it('logs a food with server-side calculation and updates daily totals', async () => {
    const { client } = await registeredClient(app());
    const res = await logFood(client).expect(201);
    // 32 g serving x 1.5 = 48 g; 600 kcal/100 g -> 288 kcal
    expect(res.body.data.consumedGrams).toBe(48);
    expect(res.body.data.nutrients.calories).toBeCloseTo(288);
    expect(res.body.data.nutrients.protein).toBeCloseTo(12);
    const day = await client.get(`/api/v1/diary?date=${today}`).expect(200);
    expect(day.body.data.totals.values.calories).toBeCloseTo(288);
    const breakfast = day.body.data.meals.find((m: { meal: string }) => m.meal === 'breakfast');
    expect(breakfast.totals.values.calories).toBeCloseTo(288);
    expect(breakfast.entries).toHaveLength(1);
  });

  it('ignores client-supplied nutrition and rejects unknown servings', async () => {
    const { client } = await registeredClient(app());
    const res = await logFood(client, { nutrients: { calories: 1 } }).expect(201);
    expect(res.body.data.nutrients.calories).toBeCloseTo(288);
    await logFood(client, { servingId: 'cup' }).expect(400);
    await logFood(client, { quantity: -1 }).expect(400);
    await logFood(client, { quantity: 0 }).expect(400);
    await logFood(client, { date: '2026-02-30' }).expect(400);
  });

  it('is idempotent for repeated submissions', async () => {
    const { client } = await registeredClient(app());
    const clientRequestId = uniqueId();
    const first = await logFood(client, { clientRequestId }).expect(201);
    const [a, b] = await Promise.all([logFood(client, { clientRequestId }), logFood(client, { clientRequestId })]);
    expect(a.body.data.id).toBe(first.body.data.id);
    expect(b.body.data.id).toBe(first.body.data.id);
    expect(await FoodLog.countDocuments()).toBe(1);
  });

  it('recalculates on edit, moves between meals/dates, and removes totals on delete', async () => {
    const { client } = await registeredClient(app());
    const { body } = await logFood(client).expect(201);
    const id = body.data.id;
    const edited = await client.patch(`/api/v1/diary/entries/${id}`, { quantity: 3, meal: 'lunch' }).expect(200);
    expect(edited.body.data.nutrients.calories).toBeCloseTo(576);
    expect(edited.body.data.meal).toBe('lunch');
    const yesterday = addDays(today, -1);
    await client.patch(`/api/v1/diary/entries/${id}`, { date: yesterday }).expect(200);
    expect((await client.get(`/api/v1/diary?date=${today}`)).body.data.logged).toBe(false);
    expect((await client.get(`/api/v1/diary?date=${yesterday}`)).body.data.totals.values.calories).toBeCloseTo(576);

    await client.del(`/api/v1/diary/entries/${id}`).expect(200);
    const after = await client.get(`/api/v1/diary?date=${yesterday}`).expect(200);
    expect(after.body.data.logged).toBe(false);
    expect(after.body.data.totals.values.calories).toBeNull();
    await client.post(`/api/v1/diary/entries/${id}/restore`).expect(200);
    expect((await client.get(`/api/v1/diary?date=${yesterday}`)).body.data.totals.values.calories).toBeCloseTo(576);
  });

  it('keeps missing nutrients distinct from zero in totals', async () => {
    const { client } = await registeredClient(app());
    await logFood(client, { food: { provider: 'fixture', foodId: 'fx-pb-natural' } }).expect(201);
    await logFood(client).expect(201);
    const day = await client.get(`/api/v1/diary?date=${today}`).expect(200);
    expect(day.body.data.totals.missing.sodium).toBe(1);
    expect(day.body.data.totals.values.sodium).toBeCloseTo(192);
  });

  it('enforces ownership for every entry operation', async () => {
    const alice = await registeredClient(app());
    const mallory = await registeredClient(app());
    const { body } = await logFood(alice.client).expect(201);
    const id = body.data.id;
    await mallory.client.patch(`/api/v1/diary/entries/${id}`, { quantity: 9 }).expect(404);
    await mallory.client.del(`/api/v1/diary/entries/${id}`).expect(404);
    await mallory.client.post(`/api/v1/diary/entries/${id}/duplicate`, { clientRequestId: uniqueId() }).expect(404);
    const day = await mallory.client.get(`/api/v1/diary?date=${today}`).expect(200);
    expect(day.body.data.logged).toBe(false);
    await mallory.client.post('/api/v1/diary/copy-day', { fromDate: today, toDate: addDays(today, 1), entryIds: [id], clientRequestId: uniqueId() }).expect(400);
    await mallory.client.patch('/api/v1/diary/entries/not-an-id', { quantity: 1 }).expect(400);
  });

  it('copies a day as new entries without duplicating on retry', async () => {
    const { client } = await registeredClient(app());
    await logFood(client).expect(201);
    await logFood(client, { meal: 'dinner', food: { provider: 'fixture', foodId: 'fx-rice-white' }, servingId: 'portion-0', quantity: 1 }).expect(201);
    const tomorrow = addDays(today, 1);
    const clientRequestId = uniqueId();
    const first = await client.post('/api/v1/diary/copy-day', { fromDate: today, toDate: tomorrow, clientRequestId }).expect(201);
    expect(first.body.data.created).toBe(2);
    const retry = await client.post('/api/v1/diary/copy-day', { fromDate: today, toDate: tomorrow, clientRequestId }).expect(200);
    expect(retry.body.data.created).toBe(0);
    expect(await FoodLog.countDocuments({ date: tomorrow })).toBe(2);
    expect(await FoodLog.countDocuments({ date: today })).toBe(2);
    const rice = (await client.get(`/api/v1/diary?date=${tomorrow}`)).body.data.meals.find((m: { meal: string }) => m.meal === 'dinner');
    expect(rice.totals.values.calories).toBeCloseTo(205.4); // 158 g x 130/100
  });
});

describe('goals, calendar and analytics', () => {
  it('applies goal history to past dates without rewriting them', async () => {
    const { client } = await registeredClient(app());
    const lastWeek = addDays(today, -7);
    await client.post('/api/v1/goals', { effectiveFrom: lastWeek, calories: 2000, protein: 120, carbs: 220, fat: 70, waterMl: 2000 }).expect(201);
    await client.post('/api/v1/goals', { calories: 1800, protein: 130, carbs: 180, fat: 60, waterMl: 2500 }).expect(201);
    const past = await client.get(`/api/v1/diary?date=${addDays(today, -3)}`).expect(200);
    expect(past.body.data.goal.calories).toBe(2000);
    const now = await client.get(`/api/v1/diary?date=${today}`).expect(200);
    expect(now.body.data.goal.calories).toBe(1800);
    const history = await client.get('/api/v1/goals/history').expect(200);
    expect(history.body.data).toHaveLength(2);
    await client.post('/api/v1/goals', { calories: 100, protein: 1, carbs: 1, fat: 1, waterMl: 1 }).expect(400);
  });

  it('builds a month calendar that distinguishes unlogged days from zero-calorie days', async () => {
    const { client } = await registeredClient(app());
    await client.post('/api/v1/goals', { effectiveFrom: '2024-01-01', calories: 2000, protein: 100, carbs: 250, fat: 70, waterMl: 2000 }).expect(201);
    await client.post('/api/v1/foods/custom', {
      name: 'Black coffee', brand: null, servingLabel: 'cup', servingGrams: 240,
      nutrients: { calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: null, fiber: null, sugars: null, sodium: null },
    }).expect(201).then(async (r) => {
      await logFood(client, { date: '2024-02-29', food: { provider: 'custom', foodId: r.body.data.id } }).expect(201);
    });
    await logFood(client, { date: '2024-02-10', quantity: 10 }).expect(201); // 1920 kcal
    const res = await client.get('/api/v1/calendar/month?year=2024&month=2').expect(200);
    const { days, stats } = res.body.data;
    expect(days).toHaveLength(29);
    const leap = days.find((d: { date: string }) => d.date === '2024-02-29');
    expect(leap).toMatchObject({ logged: true, calories: 0, status: 'under' });
    expect(days.find((d: { date: string }) => d.date === '2024-02-11')).toMatchObject({ logged: false, calories: null, status: 'not-logged' });
    expect(days.find((d: { date: string }) => d.date === '2024-02-10').status).toBe('met');
    expect(stats.daysLogged).toBe(2);
    expect(stats.daysMeetingCalorieGoal).toBe(1);
    expect(stats.totals.values.calories).toBeCloseTo(1920);
    expect(stats.averages.calories).toBeCloseTo(960);
    expect(stats.highestDay).toMatchObject({ date: '2024-02-10' });
    expect(stats.lowestDay).toMatchObject({ date: '2024-02-29', calories: 0 });
  });

  it('computes range analytics and streaks', async () => {
    const { client } = await registeredClient(app());
    for (const d of [today, addDays(today, -1), addDays(today, -2), addDays(today, -5)]) await logFood(client, { date: d }).expect(201);
    const streak = await client.get('/api/v1/analytics/streak').expect(200);
    expect(streak.body.data).toMatchObject({ current: 3, longest: 3, pendingToday: false });
    const range = await client.get(`/api/v1/analytics/range?from=${addDays(today, -6)}&to=${today}`).expect(200);
    expect(range.body.data.days).toHaveLength(7);
    expect(range.body.data.stats.daysLogged).toBe(4);
    await client.get(`/api/v1/analytics/range?from=${today}&to=${addDays(today, -1)}`).expect(400);
  });
});

describe('other resources', () => {
  it('manages favorites, custom foods and recent foods per user', async () => {
    const alice = await registeredClient(app());
    const bob = await registeredClient(app());
    const fav = await alice.client.post('/api/v1/favorites', { food: { provider: 'fixture', foodId: 'fx-rice-brown' } }).expect(201);
    await alice.client.post('/api/v1/favorites', { food: { provider: 'fixture', foodId: 'fx-rice-brown' } }).expect(201);
    expect((await alice.client.get('/api/v1/favorites')).body.data).toHaveLength(1);
    expect((await bob.client.get('/api/v1/favorites')).body.data).toHaveLength(0);
    await bob.client.del(`/api/v1/favorites/${fav.body.data.id}`).expect(404);

    const custom = await alice.client.post('/api/v1/foods/custom', {
      name: 'Protein shake', brand: null, servingLabel: 'bottle', servingGrams: null,
      nutrients: { calories: 160, protein: 30, carbs: 5, fat: 2, saturatedFat: null, fiber: null, sugars: 2, sodium: null },
    }).expect(201);
    await bob.client.post('/api/v1/diary/entries', {
      date: today, meal: 'snacks', food: { provider: 'custom', foodId: custom.body.data.id }, servingId: 'label', quantity: 1, clientRequestId: uniqueId(),
    }).expect(404);
    const logged = await logFood(alice.client, { food: { provider: 'custom', foodId: custom.body.data.id }, quantity: 2 }).expect(201);
    expect(logged.body.data.nutrients.protein).toBe(60);
    expect(logged.body.data.food.attribution).toMatch(/Manually entered/);
    const recent = await alice.client.get('/api/v1/foods/recent').expect(200);
    expect(recent.body.data[0].food.name).toBe('Protein shake');
  });

  it('builds recipes and saved meals from server-calculated items', async () => {
    const { client } = await registeredClient(app());
    const recipe = await client.post('/api/v1/recipes', {
      name: 'PB rice bowl', portions: 2,
      ingredients: [
        { food: { provider: 'fixture', foodId: 'fx-rice-white' }, servingId: '100g', quantity: 2 },
        { food: { provider: 'fixture', foodId: 'fx-pb-creamy' }, servingId: 'label', quantity: 1 },
      ],
    }).expect(201);
    // (260 + 192) / 2 = 226 kcal per portion; (200 + 32) / 2 = 116 g
    expect(recipe.body.data.perPortion.calories).toBeCloseTo(226);
    expect(recipe.body.data.gramsPerPortion).toBeCloseTo(116);
    const entry = await logFood(client, { food: { provider: 'recipe', foodId: recipe.body.data.id }, servingId: 'portion', quantity: 1 }).expect(201);
    expect(entry.body.data.nutrients.calories).toBeCloseTo(226);
    await client.patch(`/api/v1/recipes/${recipe.body.data.id}`, { portions: 4 }).expect(200);
    // Historical entry keeps its snapshot.
    expect((await client.get(`/api/v1/diary?date=${today}`)).body.data.totals.values.calories).toBeCloseTo(226);

    const meal = await client.post('/api/v1/saved-meals', {
      name: 'Usual breakfast',
      items: [{ food: { provider: 'fixture', foodId: 'fx-pb-creamy' }, servingId: 'label', quantity: 1 }],
    }).expect(201);
    const clientRequestId = uniqueId();
    await client.post(`/api/v1/saved-meals/${meal.body.data.id}/log`, { date: addDays(today, -1), meal: 'breakfast', quantities: [2], clientRequestId }).expect(201);
    await client.post(`/api/v1/saved-meals/${meal.body.data.id}/log`, { date: addDays(today, -1), meal: 'breakfast', quantities: [2], clientRequestId }).expect(200);
    const day = await client.get(`/api/v1/diary?date=${addDays(today, -1)}`).expect(200);
    expect(day.body.data.totals.values.calories).toBeCloseTo(384);
    expect((await client.get('/api/v1/saved-meals')).body.data[0].items[0].quantity).toBe(1);
  });

  it('tracks hydration and weight', async () => {
    const { client } = await registeredClient(app());
    await client.post('/api/v1/hydration', { date: today, amountMl: 250 }).expect(201);
    const log = await client.post('/api/v1/hydration', { date: today, amountMl: 500 }).expect(201);
    await client.patch(`/api/v1/hydration/${log.body.data.id}`, { amountMl: 400 }).expect(200);
    expect((await client.get(`/api/v1/hydration?date=${today}`)).body.data.totalMl).toBe(650);
    expect((await client.get(`/api/v1/diary?date=${today}`)).body.data.waterMl).toBe(650);
    await client.post('/api/v1/weight', { date: today, weightKg: 70.4 }).expect(201);
    await client.post('/api/v1/weight', { date: today, weightKg: 70.1 }).expect(201);
    const weights = await client.get('/api/v1/weight').expect(200);
    expect(weights.body.data).toHaveLength(1);
    expect(weights.body.data[0].weightKg).toBe(70.1);
    await client.post('/api/v1/weight', { date: today, weightKg: 5 }).expect(400);
  });

  it('exports only the requesting user\'s diary as escaped CSV', async () => {
    const alice = await registeredClient(app());
    const bob = await registeredClient(app());
    await logFood(alice.client, { notes: '=HYPERLINK("http://evil")' }).expect(201);
    await logFood(bob.client, { notes: 'bob secret' }).expect(201);
    const res = await alice.client.get(`/api/v1/exports/diary.csv?from=${today}&to=${today}`).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(res.text).not.toContain('bob secret');
    expect(res.text.trim().split('\r\n')).toHaveLength(2);
  });

  it('creates goal notifications once per day', async () => {
    const { client } = await registeredClient(app());
    await client.post('/api/v1/goals', { calories: 900, protein: 50, carbs: 100, fat: 30, waterMl: 2000 }).expect(201);
    await logFood(client, { quantity: 5 }).expect(201); // 960 kcal -> within 10%
    await logFood(client, { quantity: 0.5 }).expect(201); // 1056 -> over
    const list = await client.get('/api/v1/notifications').expect(200);
    const types = list.body.data.items.map((n: { type: string }) => n.type);
    expect(types).toEqual(expect.arrayContaining(['goal_reached', 'goal_exceeded']));
    expect(list.body.data.unread).toBe(2);
    await client.post('/api/v1/notifications/read-all').expect(204);
    expect((await client.get('/api/v1/notifications')).body.data.unread).toBe(0);
  });
});

describe('food resolution fallback', () => {
  it('re-saves templates from owned snapshots when the cache entry is gone', async () => {
    const { FoodCache } = await import('../models');
    const { client } = await registeredClient(app());
    const meal = await client.post('/api/v1/saved-meals', {
      name: 'Rice bowl',
      items: [{ food: { provider: 'fixture', foodId: 'fx-rice-brown' }, servingId: 'portion-0', quantity: 1 }],
    }).expect(201);
    await FoodCache.deleteMany({});
    const { setProvidersForTesting } = await import('../providers/nutrition/registry');
    setProvidersForTesting([]);
    try {
      await client.patch(`/api/v1/saved-meals/${meal.body.data.id}`, {
        items: [{ food: { provider: 'fixture', foodId: 'fx-rice-brown' }, servingId: 'portion-0', quantity: 2 }],
      }).expect(200);
    } finally {
      setProvidersForTesting(undefined);
    }
  });
});
