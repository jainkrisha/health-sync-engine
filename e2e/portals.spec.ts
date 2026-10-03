/**
 * The sign-in screen offers two portals: PHC (local doctor, works offline) and
 * Admin (central system at the district hospital). Each account only opens in
 * its own portal.
 */
import { expect, test } from '@playwright/test';

const run = Date.now().toString(36);

test('PHC and Admin portals at sign-in', async ({ page }) => {
  await page.goto('/');

  // Register a PHC doctor through the UI.
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByRole('radio', { name: /^PHC/ }).check({ force: true });
  await page.getByLabel('Full name').fill('Dr. Portal Test');
  await page.getByLabel('Username').fill(`e2e_phc_${run}`);
  await page.getByLabel('Password').fill('password123');
  await page.getByLabel('PHC name').fill('PHC Hadapsar');
  await page.getByRole('button', { name: 'Create PHC account' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText('PHC Hadapsar').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conflict Review' })).toHaveCount(0);
  await page.getByRole('button', { name: /Sign out|Log out/ }).first().click();

  // The same PHC account is refused by the district system.
  await page.getByRole('radio', { name: /^Admin/ }).check({ force: true });
  await page.getByLabel('Username').fill(`e2e_phc_${run}`);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in to district system' }).click();
  await expect(page.getByRole('alert')).toContainText('This is a PHC account');

  // A district administrator registers and sees the central views.
  await page.getByRole('tab', { name: 'Create account' }).click();
  await expect(page.getByLabel('PHC name')).toHaveCount(0);
  await page.getByLabel('Full name').fill('District Admin');
  await page.getByLabel('Username').fill(`e2e_dist_${run}`);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create district account' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText('District Hospital').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conflict Review' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Audit Trail' })).toBeVisible();
});
