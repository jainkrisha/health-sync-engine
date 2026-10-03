import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a running stack:
 *   docker compose up --build        (http://localhost:8080)
 * or the dev servers (server: npm run dev in /server, client: npm run dev) at http://localhost:5173.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
});
