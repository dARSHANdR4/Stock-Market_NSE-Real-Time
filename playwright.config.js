import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://stock-market-nse-real-time.pages.dev',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
