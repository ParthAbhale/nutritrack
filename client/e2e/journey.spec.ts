import { expect, test } from '@playwright/test';
import { addDays, todayInTimeZone } from '@nutritrack/shared';
import { PASSWORD, apiAs, logFood, registerAndOnboard } from './helpers';

const today = todayInTimeZone('UTC');

test('register, onboard, log food, edit, delete, persist, and review history', async ({ page }) => {
  // 1. Register and finish onboarding.
  const { email } = await registerAndOnboard(page);
  await expect(page.getByRole('heading', { name: /Eve/ })).toBeVisible();

  // 2. Log out and back in.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // 3–5. Search (fixture provider), pick a branded result, change servings, add to breakfast.
  await page.getByRole('button', { name: 'Add food' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: /Search foods/ }).fill('peanut butter');
  const options = dialog.getByRole('option');
  await expect(options).toHaveCount(4);
  await expect(dialog.getByText('Fixture Foods A').first()).toBeVisible();
  await expect(dialog.getByText('Fixture Foods B')).toBeVisible();
  await options.filter({ hasText: 'Creamy Peanut Butter' }).click();
  await dialog.getByLabel('Number of servings').fill('1.5');
  await expect(dialog.getByText('Total amount: 48 g')).toBeVisible();
  await expect(dialog.getByLabel('Nutrition preview').getByText('288', { exact: true })).toBeVisible();
  await dialog.getByLabel('Meal').selectOption('breakfast');
  await dialog.getByRole('button', { name: 'Add to diary' }).click();
  await expect(dialog).toBeHidden();

  // 6. Dashboard reflects the entry (32 g x 1.5 = 48 g; 600 kcal/100 g -> 288 kcal; 12 g protein).
  const breakfastKcal = page.getByRole('main').getByText('288', { exact: true }).first();
  await expect(breakfastKcal).toBeVisible();
  await expect(page.getByRole('button', { name: /Breakfast/ }).first()).toContainText('1 item');
  await expect(page.getByText('Total calories').locator('..')).toContainText('288');
  await expect(page.getByRole('progressbar', { name: 'Protein progress' })).toBeVisible();

  // 7. Persistence across reload.
  await page.reload();
  await expect(page.getByRole('main').getByText('288', { exact: true }).first()).toBeVisible();

  // 8. Another date: empty, then log there, and confirm today is unaffected.
  await page.goto(`/diary?date=${addDays(today, -1)}`);
  await expect(page.getByText('No food logged for this day')).toBeVisible();
  await logFood(page, 'white rice', 'White rice', { servings: '1', meal: 'Dinner' });
  await expect(page.getByRole('main').getByText('White rice, cooked').first()).toBeVisible();
  await page.goto('/calendar');
  await page.getByRole('main').locator(`[data-date="${addDays(today, -1)}"]`).click();
  await expect(page.getByRole('main').getByText('White rice, cooked').first()).toBeVisible();

  // 9. Edit an entry: recalculated from the snapshot.
  await page.goto(`/diary?date=${today}`);
  await page.getByRole('button', { name: 'Creamy Peanut Butter', exact: true }).click();
  const edit = page.getByRole('dialog');
  await edit.getByLabel('Number of servings').fill('3');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByRole('table')).toContainText('576');

  // 10. Delete, totals drop, undo restores.
  await page.getByRole('button', { name: 'Actions for Creamy Peanut Butter' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No food logged for this day')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('table')).toContainText('576');

  // 11. Change the goal and see progress against the new target.
  await page.goto('/goals');
  await page.getByRole('button', { name: /Edit/ }).first().click();
  const calorieInput = page.getByLabel(/^Calories/).first();
  await calorieInput.fill('1152');
  await page.getByRole('button', { name: /Save goal/ }).click();
  await page.goto('/dashboard');
  await expect(page.getByRole('progressbar', { name: 'Calories progress' })).toHaveAttribute('aria-valuenow', '50');
});

test('another account cannot read or change my entries', async ({ page, playwright, baseURL }) => {
  await registerAndOnboard(page);
  await logFood(page, 'peanut butter', 'Creamy Peanut Butter');
  const res = await page.request.get(`/api/v1/diary?date=${today}`);
  const entryId = (await res.json()).data.meals.flatMap((m: { entries: { id: string }[] }) => m.entries)[0].id as string;

  const other = await playwright.request.newContext({ baseURL });
  const api = await apiAs(other);
  const reg = await api.post('/api/v1/auth/register', { name: 'Mallory', email: `mallory.${Date.now()}@example.com`, password: PASSWORD, acceptTerms: true });
  expect(reg.status()).toBe(201);
  const csrf = (await reg.json()).data.csrfToken;
  expect((await other.patch(`/api/v1/diary/entries/${entryId}`, { data: { quantity: 9 }, headers: { 'X-CSRF-Token': csrf } })).status()).toBe(404);
  expect((await other.delete(`/api/v1/diary/entries/${entryId}`, { headers: { 'X-CSRF-Token': csrf } })).status()).toBe(404);
  const theirDay = await (await other.get(`/api/v1/diary?date=${today}`)).json();
  expect(theirDay.data.logged).toBe(false);
  expect((await other.get('/api/v1/exports/diary.csv?from=' + today + '&to=' + today)).status()).toBe(200);
  expect(await (await other.get('/api/v1/exports/diary.csv?from=' + today + '&to=' + today)).text()).not.toContain('Creamy Peanut Butter');
  await other.dispose();

  // Unauthenticated access is rejected.
  const anon = await playwright.request.newContext({ baseURL });
  expect((await anon.get(`/api/v1/diary?date=${today}`)).status()).toBe(401);
  await anon.dispose();
});

test('provider outage and network failures are recoverable without losing input', async ({ page }) => {
  await registerAndOnboard(page);

  // Provider outage: meaningful error, retry, no invented results.
  await page.getByRole('button', { name: 'Add food' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: /Search foods/ }).fill('fixture-outage');
  await expect(dialog.getByText('Food search is unavailable')).toBeVisible();
  await expect(dialog.getByRole('option')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /Try again/ })).toBeVisible();
  await dialog.getByRole('combobox', { name: /Search foods/ }).fill('brown rice');
  await dialog.getByRole('option', { name: /Brown rice/ }).click();
  await dialog.getByLabel(/Notes/).fill('keep me');

  // Network failure on save: the form keeps its values; a retry succeeds once the network is back.
  await page.route('**/api/v1/diary/entries', (route) => route.abort('failed'));
  await dialog.getByRole('button', { name: 'Add to diary' }).click();
  await expect(dialog.getByText(/Could not reach the server/)).toBeVisible();
  await expect(dialog.getByLabel(/Notes/)).toHaveValue('keep me');
  await page.unroute('**/api/v1/diary/entries');
  await dialog.getByRole('button', { name: 'Add to diary' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Brown rice, cooked').first()).toBeVisible();

  // Slow/failed page data shows an error state with a working retry.
  await page.route('**/api/v1/calendar/month**', (route) => route.abort('timedout'));
  await page.goto('/calendar');
  await expect(page.getByRole('button', { name: /Try again/ }).first()).toBeVisible({ timeout: 20_000 });
  await page.unroute('**/api/v1/calendar/month**');
  await page.getByRole('button', { name: /Try again/ }).first().click();
  await expect(page.getByRole('grid')).toBeVisible();
});
