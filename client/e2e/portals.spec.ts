/**
 * Sign-in asks "Where do you work?": a PHC (local doctor, works offline) or the
 * district hospital (central system). Each account only opens in its own
 * place, and the same card switches to "Create an account".
 */
import { expect, test } from '@playwright/test';

const run = Date.now().toString(36);

test('PHC and district hospital sign-in', async ({ page }) => {
  await page.goto('/');
  const phc = page.getByRole('radio', { name: /Primary Health Centre/ });
  const district = page.getByRole('radio', { name: /District hospital/ });

  // Register a PHC doctor.
  await phc.check();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Full name').fill('Dr. Portal Test');
  await page.getByLabel('PHC name').fill('PHC Hadapsar');
  await page.getByLabel('Choose a username').fill(`e2e_phc_${run}`);
  await page.getByLabel('Choose a password').fill('password123');
  await page.getByRole('button', { name: 'Create PHC account' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText('PHC Hadapsar').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /^Dose reviews/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out' }).first().click();

  // The same PHC account is refused at the district hospital.
  await district.check();
  await page.getByLabel('Username').fill(`e2e_phc_${run}`);
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Sign in to district system' }).click();
  await expect(page.getByRole('alert')).toContainText('This is a PHC account');

  // A district administrator registers: no PHC name, a job instead.
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByLabel('PHC name')).toHaveCount(0);
  await page.getByLabel('Full name').fill('District Admin');
  await page.getByRole('radio', { name: /Administrator/ }).check();
  await page.getByLabel('Choose a username').fill(`e2e_dist_${run}`);
  await page.getByLabel('Choose a password').fill('password123');
  await page.getByRole('button', { name: 'Create district account' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText('District Hospital').filter({ visible: true }).first()).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Dose reviews' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Change history' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Health centres' })).toBeVisible();
});

test('patient list downloads as Excel and CSV', async ({ page, request }) => {
  const user = { username: `e2e_exp_${run}`, name: 'Export Worker', role: 'health_worker', portal: 'phc', facility: 'PHC Export Test', password: 'password123' };
  expect((await request.post('/api/auth/register', { data: user })).status()).toBe(201);
  await page.goto('/');
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in to PHC' }).click();
  await expect(page).toHaveURL(/dashboard/);

  // One patient of our own, so the file has a known row.
  const name = `Export Patient ${run}`;
  await page.getByRole('link', { name: 'Register a patient' }).first().click();
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Date of birth').fill('1990-02-03');
  await page.getByRole('button', { name: 'Save patient' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Patients', exact: true }).click();
  await page.getByLabel('Search patients').fill(name);
  await page.getByText('Download patient list').click();
  await page.getByRole('radio', { name: /Only the 1 patient shown/ }).check();

  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download file' }).click()]);
  expect(xlsx.suggestedFilename()).toMatch(/^patient-export-patient-.*\.xlsx$/);
  const bytes = await (await xlsx.createReadStream()).toArray();
  expect(Buffer.concat(bytes).subarray(0, 2).toString()).toBe('PK');

  await page.getByRole('radio', { name: /CSV file/ }).check();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download file' }).click()]);
  const text = Buffer.concat(await (await csv.createReadStream()).toArray()).toString('utf8');
  expect(text).toContain('Name,Date of birth,Age (years)');
  expect(text).toContain(`${name},1990-02-03`);
});
