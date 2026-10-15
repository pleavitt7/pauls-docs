import { defineConfig } from '@playwright/test';

const baseURL = process.env.DIAGRAM_BASE_URL ?? 'http://127.0.0.1:4322';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL,
    headless: true,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
