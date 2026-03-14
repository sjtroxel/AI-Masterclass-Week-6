import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration.
 * All specs run against two viewports per the testing rules:
 *   - Mobile: 375×812 (iPhone SE)
 *   - Desktop: 1280×800
 *
 * Assumes both servers are running before `npm run test:e2e`:
 *   npm run dev:server   (Express on :3001)
 *   npm run dev:client   (Angular on :4200, proxies /api → :3001)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // serial within a file — avoids shared DB state issues
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
