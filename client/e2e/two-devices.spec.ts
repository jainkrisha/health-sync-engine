/**
 * The core demo, automated: two devices edit the same patient while offline,
 * reconnect, and the system merges allergies automatically, sends the
 * conflicting medication dose to a clinical reviewer, and records everything.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

/** Desktop navigation is the card wheel: open it at the left edge, then pick a card. */
async function openMenuItem(page: Page, name: string | RegExp) {
  await page.mouse.move(2, 420);
  const link = page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name, exact: typeof name === 'string' });
  await link.focus();
  await page.keyboard.press('Enter');
}

const run = Date.now().toString(36);
const password = 'password123';
const users = {
  a: { username: `e2e_a_${run}`, name: 'Device A Worker', role: 'health_worker' },
  b: { username: `e2e_b_${run}`, name: 'Device B Worker', role: 'health_worker' },
  reviewer: { username: `e2e_r_${run}`, name: 'E2E Reviewer', role: 'clinical_reviewer' },
  auditor: { username: `e2e_au_${run}`, name: 'E2E Auditor', role: 'auditor' },
};
const patientName = `E2E Patient ${run}`;

async function device(browser: Browser, user: { username: string; role: string }): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  // The illustrated intro is scroll-driven; skip it to reach the passes.
  await page.getByRole('button', { name: 'Skip intro' }).click();
  // Health workers sign in on the PHC pass; everyone else on the district (Admin) pass.
  const portal = user.role === 'health_worker' ? 'phc' : 'district';
  const pass = page.getByRole('region', {
    name: portal === 'phc' ? 'PHC sign-in pass' : 'Admin sign-in pass',
  });
  await pass.locator(`#pass-${portal}-user`).fill(user.username);
  await pass.locator(`#pass-${portal}-pass`).fill(password);
  await pass
    .getByRole('button', {
      name: portal === 'phc' ? 'Sign in to PHC' : 'Sign in to district system',
    })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole('status').filter({ hasText: 'Synced' }).first()).toBeVisible();
  return page;
}

async function setOffline(page: Page, offline: boolean) {
  const toggle = page.getByLabel('Simulate offline');
  if ((await toggle.isChecked()) !== offline) await toggle.click({ force: true });
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: offline ? 'Offline' : 'Synced' })
      .first(),
  ).toBeVisible();
}

async function openPatient(page: Page) {
  await openMenuItem(page, 'Patients');
  await page
    .getByRole('link', { name: new RegExp(patientName) })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: patientName })).toBeVisible();
}

test.beforeAll(async ({ request }) => {
  for (const u of Object.values(users)) {
    const res = await request.post('/api/auth/register', { data: { ...u, password } });
    expect(res.status(), await res.text()).toBe(201);
  }
});

test('concurrent offline edits merge, dose conflict goes to review', async ({ browser }) => {
  const a = await device(browser, users.a);

  // Device A creates the patient and syncs it.
  await a.getByRole('link', { name: 'Add patient' }).first().click();
  await a.getByLabel('Full name').fill(patientName);
  await a.getByLabel('Date of birth').fill('1980-05-20');
  await a.getByLabel('Blood type').selectOption('B+');
  await a.getByRole('button', { name: 'Add allergy' }).click();
  await a.locator('#allergies-0-allergen').fill('Penicillin');
  await a.locator('#allergies-0-severity').selectOption('severe');
  await a.getByRole('button', { name: 'Add medication' }).click();
  await a.locator('#medications-0-name').fill('Metformin');
  await a.locator('#medications-0-dosage').fill('500 mg');
  await a.locator('#medications-0-frequency').fill('Twice daily');
  await a.getByRole('button', { name: 'Save patient' }).click();
  await expect(a.getByRole('heading', { name: patientName })).toBeVisible();
  await expect(a.getByText('Synced', { exact: true }).first()).toBeVisible();

  // Device B receives it.
  const b = await device(browser, users.b);
  await openPatient(b);
  await expect(b.getByText('500 mg · Twice daily')).toBeVisible();

  // Both go offline and edit the same record.
  await setOffline(a, true);
  await setOffline(b, true);

  await a.getByRole('link', { name: 'Edit' }).click();
  await a.locator('#medications-0-dosage').fill('850 mg');
  await a.getByRole('button', { name: 'Add allergy' }).click();
  await a.locator('#allergies-1-allergen').fill('Latex');
  await a.getByRole('button', { name: 'Save changes' }).click();
  await expect(a.getByText('Changes not synced yet')).toBeVisible();

  await b.getByRole('link', { name: 'Edit' }).click();
  await b.locator('#medications-0-dosage').fill('1000 mg');
  await b.getByRole('button', { name: 'Add allergy' }).click();
  await b.locator('#allergies-1-allergen').fill('Peanuts');
  await b.getByLabel('Heart rate (bpm)').fill('88');
  await b.getByRole('button', { name: 'Save changes' }).click();
  await expect(b.getByText('Changes not synced yet')).toBeVisible();

  // Reconnect: A first, then B.
  await setOffline(a, false);
  await setOffline(b, false);

  for (const page of [a, b]) {
    // Allergies from both devices survive (never-lose rule)...
    for (const allergen of ['Latex', 'Peanuts', 'Penicillin']) {
      await expect(page.getByText(allergen, { exact: true })).toBeVisible();
    }
    // ...and the conflicting dose is held for review, keeping A's value meanwhile.
    await expect(page.getByText('Medication under review')).toBeVisible();
    await expect(page.getByText('850 mg · Twice daily')).toBeVisible();
  }

  // A clinical reviewer resolves it with a corrected dose.
  const reviewer = await device(browser, users.reviewer);
  await openMenuItem(reviewer, 'Conflict Review');
  const card = reviewer.locator('article').filter({ hasText: patientName });
  await expect(card.getByText('850 mg · Twice daily').first()).toBeVisible();
  await expect(card.getByText('1000 mg · Twice daily').first()).toBeVisible();
  await card.getByRole('button', { name: 'Enter a corrected dose' }).click();
  await card.getByLabel('Corrected dosage').fill('750 mg');
  await card.getByLabel(/Reviewer note/).fill('Confirmed with the doctor');
  await card.getByRole('button', { name: 'Save corrected dose' }).click();
  await expect(reviewer.getByText(`resolved`, { exact: false }).first()).toBeVisible();

  // Every device converges on the reviewed value.
  for (const page of [a, b]) {
    await expect(page.getByText('750 mg · Twice daily')).toBeVisible();
    await expect(page.getByText('Medication under review')).toHaveCount(0);
  }

  // Data at rest on the device is ciphertext, not readable JSON.
  const stored = await a.evaluate(async () => {
    const req = indexedDB.open('HealthSync');
    const dbh = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const rows = await new Promise<unknown[]>((resolve) => {
      const r = dbh.transaction('patients').objectStore('patients').getAll();
      r.onsuccess = () => resolve(r.result);
    });
    const first = rows[0] as { enc: { iv: Uint8Array; data: ArrayBuffer } };
    const text = new TextDecoder().decode(new Uint8Array(first.enc.data));
    return {
      keys: Object.keys(first).sort(),
      ivLength: first.enc.iv.length,
      readable: text.includes('Penicillin') || text.includes('Metformin'),
    };
  });
  expect(stored).toEqual({ keys: ['enc', 'id', 'updatedAt'], ivLength: 12, readable: false });

  // The auditor sees the manual decision in the read-only trail.
  const auditor = await device(browser, users.auditor);
  await openMenuItem(auditor, 'Audit Trail');
  // Branch graph: both tablets' doses side by side in the merge, with the reviewer's result.
  const graphPick = auditor.locator('#graph-patient');
  await expect(graphPick.locator('option', { hasText: patientName })).toHaveCount(1);
  const option = (await graphPick.locator('option').allTextContents()).find((o) =>
    o.startsWith(patientName),
  )!;
  await graphPick.selectOption({ label: option });
  const merge = auditor.locator('.bg-merge');
  await expect(merge.getByText('850 mg', { exact: true })).toBeVisible();
  await expect(merge.getByText('1000 mg', { exact: true })).toBeVisible();
  await expect(merge.getByText(/Resolved by/)).toBeVisible();
  await expect(auditor.locator('.bg-clash')).toHaveCount(2);
  // The flat list still filters by resolution type.
  await auditor.getByRole('tab', { name: 'All entries' }).click();
  await auditor.getByLabel('Resolution').selectOption('manual');
  await expect(auditor.getByText(/Confirmed with the doctor/).first()).toBeVisible();
  await expect(auditor.getByRole('link', { name: /^Conflict Review/ })).toHaveCount(0);
});
