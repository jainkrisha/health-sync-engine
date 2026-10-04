/**
 * The sign-in screen shows two ID passes: PHC (local doctor, works offline) and
 * Admin (central system at the district hospital). Each account only opens on
 * its own pass, and each pass flips over to create an account.
 */
import { expect, test } from '@playwright/test';

const run = Date.now().toString(36);

test('PHC and Admin passes at sign-in', async ({ page }) => {
  await page.goto('/');
  const phc = page.getByRole('region', { name: 'PHC sign-in pass' });
  const admin = page.getByRole('region', { name: 'Admin sign-in pass' });

  // Register a PHC doctor on the back of the PHC pass.
  await phc.getByRole('button', { name: 'Create account' }).click();
  await phc.getByLabel('Full name').fill('Dr. Portal Test');
  await phc.locator('#pass-phc-r-username').fill(`e2e_phc_${run}`);
  await phc.locator('#pass-phc-r-password').fill('password123');
  await phc.getByLabel('PHC name').fill('PHC Hadapsar');
  await phc.getByRole('button', { name: 'Create PHC account' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText('PHC Hadapsar').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conflict Review' })).toHaveCount(0);
  await page.getByRole('button', { name: /Sign out|Log out/ }).first().click();

  // The same PHC account is refused on the Admin pass.
  await admin.locator('#pass-district-user').fill(`e2e_phc_${run}`);
  await admin.locator('#pass-district-pass').fill('password123');
  await admin.getByRole('button', { name: 'Sign in to district system' }).click();
  await expect(admin.getByRole('alert')).toContainText('This is a PHC account');

  // A district administrator registers on the back of the Admin pass.
  await admin.getByRole('button', { name: 'Create account' }).click();
  await expect(admin.getByLabel('PHC name')).toHaveCount(0);
  await admin.locator('#pass-district-r-name').fill('District Admin');
  await admin.locator('#pass-district-r-username').fill(`e2e_dist_${run}`);
  await admin.locator('#pass-district-r-password').fill('password123');
  await admin.getByRole('button', { name: 'Create district account' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText('District Hospital').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conflict Review' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Audit Trail' })).toBeVisible();
});
