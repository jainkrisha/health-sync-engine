/**
 * Real offline behaviour (browser network switched off, not the demo toggle).
 * Needs the production build, where the service worker caches the app shell:
 *   npm run build && npm run preview   (or docker compose)
 */
import { expect, test } from '@playwright/test';

const run = Date.now().toString(36);
const user = { username: `e2e_off_${run}`, name: 'Offline Worker', role: 'health_worker', portal: 'phc', facility: 'PHC Offline Test', password: 'password123' };

test('records can be created and read with no network, then sync', async ({ browser, request }) => {
  expect((await request.post('/api/auth/register', { data: user })).status()).toBe(201);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  const hasSw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 5000))]);
    return Boolean(reg);
  });
  test.skip(!hasSw, 'Service worker only runs in the production build (npm run build && npm run preview)');

  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('radio', { name: /^PHC/ }).check({ force: true });
  await page.getByRole('button', { name: 'Sign in to PHC' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Synced' }).first()).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Hello/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible();

  const name = `Offline Patient ${run}`;
  await page.getByRole('link', { name: 'Add patient' }).first().click();
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Date of birth').fill('1975-01-01');
  await page.getByRole('button', { name: 'Save patient' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Changes not synced yet')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText('Synced', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Changes not synced yet')).toHaveCount(0);

  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('healthsync.auth') ?? '{}').token as string);
  const res = await request.get('/api/patients', { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json()) as { patients: { name: string }[] };
  expect(body.patients.map((p) => p.name)).toContain(name);
});
