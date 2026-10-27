import { expect, test } from '@playwright/test';
import { registerAndOnboard } from './helpers';

test('mobile layout has no horizontal overflow and keeps primary actions reachable', async ({ page }) => {
  await registerAndOnboard(page);
  for (const path of ['/dashboard', '/diary', '/calendar', '/reports', '/settings']) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
  await page.getByRole('button', { name: 'Add food' }).last().click();
  await expect(page.getByRole('dialog', { name: 'Add food' })).toBeVisible();
});
