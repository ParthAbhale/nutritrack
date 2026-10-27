import { expect, type APIRequestContext, type Page } from '@playwright/test';

let n = 0;
export const uniqueEmail = () => `e2e.${Date.now()}.${++n}@example.com`;
export const PASSWORD = 'E2ePassword123';

/** Registers through the UI and completes onboarding with simple values. */
export async function registerAndOnboard(page: Page, email = uniqueEmail(), name = 'Eve Tester') {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel('Height').fill('170');
  await page.getByLabel('Current weight').fill('70');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Set your daily targets' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return { email };
}

/** Logs a fixture food through the global add-food dialog. */
export async function logFood(page: Page, query: string, resultName: string, opts: { servings?: string; meal?: string } = {}) {
  await page.getByRole('button', { name: 'Add food' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: /Search foods/ }).fill(query);
  await dialog.getByRole('option', { name: new RegExp(resultName) }).first().click();
  if (opts.servings) await dialog.getByLabel('Number of servings').fill(opts.servings);
  if (opts.meal) await dialog.getByLabel('Meal').selectOption({ label: opts.meal });
  await dialog.getByRole('button', { name: 'Add to diary' }).click();
  await expect(dialog).toBeHidden();
}

/** API client using a separate cookie jar (a different user/device). */
export async function apiAs(request: APIRequestContext) {
  const csrf = (await (await request.get('/api/v1/auth/csrf')).json()).data.csrfToken as string;
  return {
    csrf,
    post: (url: string, data: unknown) => request.post(url, { data, headers: { 'X-CSRF-Token': csrf } }),
    patch: (url: string, data: unknown) => request.patch(url, { data, headers: { 'X-CSRF-Token': csrf } }),
    del: (url: string) => request.delete(url, { headers: { 'X-CSRF-Token': csrf } }),
    get: (url: string) => request.get(url),
  };
}
