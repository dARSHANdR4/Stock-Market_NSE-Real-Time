import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://stock-market-nse-real-time.pages.dev';
const TEST_DATE = '2026-10-14';

test('health endpoint responds', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/api/health`);
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({ ok: true, service: 'stockpulse-api' });
});

test('stock API rejects an invalid symbol', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/api/stock?stock=%3Cscript%3E&date=${TEST_DATE}&range=15`);
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain('valid NSE stock symbol');
});

test('stock API returns historical data for TCS', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/api/stock?stock=TCS&date=${TEST_DATE}&range=15`);
  const responseBody = await response.json();
  expect(response.ok(), JSON.stringify(responseBody)).toBeTruthy();
  const data = responseBody;
  expect(data.stock).toBe('TCS');
  expect(Number(data.price)).toBeGreaterThan(0);
  expect(Array.isArray(data.history)).toBeTruthy();
  expect(data.history.length).toBeGreaterThan(0);
});

test('stock page renders data, charts, AI insights and persistent watchlist', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#stock-form')).toBeVisible();

  await page.locator('#stock-name').fill('TCS');
  await page.locator('#stock-date').fill(TEST_DATE);
  await page.locator('#stock-form button[type="submit"]').click();

  await expect(page.locator('#result-stock-name')).toHaveText('TCS', { timeout: 30000 });
  await expect(page.locator('#price-card')).toBeVisible();
  await expect(page.locator('#result-price')).not.toBeEmpty();
  await expect(page.locator('#chart-section')).toBeVisible();
  await expect(page.locator('#price-chart')).toBeVisible();
  await expect(page.locator('#rsi-chart')).toBeVisible();

  // The production AI endpoint is exercised as part of this end-to-end test.
  await expect(page.locator('#insights-content > div')).toHaveCount(4, { timeout: 60000 });
  await expect(page.locator('#sentiment-badge')).toBeVisible({ timeout: 10000 });

  await page.locator('#toggle-favorite').click();
  await page.locator('#open-watchlist').click();
  await expect(page.locator('#watchlist-sidebar')).toHaveClass(/open/);
  await expect(page.locator('#watchlist-items')).toContainText('TCS');

  // Verify localStorage-backed watchlist survives a page reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#open-watchlist').click();
  await expect(page.locator('#watchlist-items')).toContainText('TCS');

  // Clean up the test symbol so repeat runs do not leave state behind.
  await page.locator('#watchlist-items .remove-stock').click();
  await expect(page.locator('#watchlist-items')).toContainText('Your watchlist is empty.');
  expect(pageErrors, 'Unexpected browser JavaScript errors').toEqual([]);
});
