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
  await expect(page.locator('#sentiment-badge')).toBeVisible({ timeout: 60000 });
  await expect.poll(async () => page.locator('#insights-content > div').count(), { timeout: 15000 }).toBeGreaterThan(0);

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

test('theme toggle switches mode and persists after reload', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'light');

  await page.locator('#toggle-theme').click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('stpac_theme'))).toBe('dark');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(root).toHaveAttribute('data-theme', 'dark');
});

test('target date blocks dates in the future', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const date = page.locator('#stock-date');
  const maxDate = await date.getAttribute('max');
  expect(maxDate).toBeTruthy();
  expect(Number.isNaN(Date.parse(maxDate))).toBeFalsy();
  await date.fill('2099-01-01');
  expect(await date.evaluate(el => el.validity.rangeOverflow)).toBeTruthy();
});

test('How It Works section expands and collapses', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const content = page.locator('#how-it-works-content');
  await expect(content).toHaveClass(/hidden/);

  await page.locator('#toggle-how-it-works').click();
  await expect(content).not.toHaveClass(/hidden/);

  await page.locator('#toggle-how-it-works').click();
  await expect(content).toHaveClass(/hidden/);
});

test('autocomplete shows matching stock suggestions and selects a symbol', async ({ page }) => {
  await page.route('https://raw.githubusercontent.com/akashgiri/stocks-list/master/nse-listed-stocks.json', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        'Reliance Industries Limited': 'RELIANCE',
        'Tata Consultancy Services Limited': 'TCS',
        'HDFC Bank Limited': 'HDFCBANK'
      })
    });
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const input = page.locator('#stock-name');
  const suggestions = page.locator('#suggestions');

  await input.fill('reli');
  await expect(suggestions).toBeVisible();
  await expect(suggestions.locator('.suggestion-item')).toContainText('RELIANCE');
  await suggestions.locator('.suggestion-item').filter({ hasText: 'RELIANCE' }).click();
  await expect(input).toHaveValue('RELIANCE');
  await expect(suggestions).toBeHidden();
});

test('chart timeframe buttons request the selected range', async ({ page }) => {
  await page.route('**/api/insights', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: 'Trend: Stable\\nSupport: 100\\nResistance: 120\\nRisk: Moderate\\nBULLISH' })
    });
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('#stock-name').fill('TCS');
  await page.locator('#stock-date').fill(TEST_DATE);
  await page.locator('#stock-form button[type="submit"]').click();
  await expect(page.locator('#price-card')).toBeVisible({ timeout: 30000 });

  const sixMonthResponse = page.waitForResponse(response =>
    response.url().includes('/api/stock?') && response.url().includes('range=90')
  );
  await page.locator('.timeframe-btn[data-range="90"]').click();
  await sixMonthResponse;
  await expect(page.locator('.timeframe-btn[data-range="90"]')).toHaveClass(/timeframe-btn-active/);

  const oneYearResponse = page.waitForResponse(response =>
    response.url().includes('/api/stock?') && response.url().includes('range=180')
  );
  await page.locator('.timeframe-btn[data-range="180"]').click();
  await oneYearResponse;
  await expect(page.locator('.timeframe-btn[data-range="180"]')).toHaveClass(/timeframe-btn-active/);
});

test('mobile layout keeps main controls within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#stock-form')).toBeVisible();
  await expect(page.locator('#stock-name')).toBeVisible();
  await expect(page.locator('#stock-date')).toBeVisible();
  await expect(page.locator('#toggle-theme')).toBeVisible();
  await expect(page.locator('#open-watchlist')).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  expect(
    dimensions.documentWidth,
    `Mobile horizontal overflow: document width ${dimensions.documentWidth}px vs viewport ${dimensions.viewportWidth}px`
  ).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test('initial page load has no uncaught JavaScript errors or failed same-origin requests', async ({ page }) => {
  const pageErrors = [];
  const failedSameOriginRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => {
    if (new URL(request.url()).origin === new URL(BASE_URL).origin) {
      failedSameOriginRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || 'request failed'}`);
    }
  });

  const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('#stock-form')).toBeVisible();
  await page.waitForTimeout(1500);

  expect(pageErrors, 'Uncaught browser JavaScript errors').toEqual([]);
  expect(failedSameOriginRequests, 'Failed same-origin network requests').toEqual([]);
});

test('tablet layout keeps primary controls and page within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#stock-form')).toBeVisible();
  await expect(page.locator('#stock-name')).toBeVisible();
  await expect(page.locator('#stock-date')).toBeVisible();
  await expect(page.locator('#open-watchlist')).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  expect(
    dimensions.documentWidth,
    `Tablet horizontal overflow: document width ${dimensions.documentWidth}px vs viewport ${dimensions.viewportWidth}px`
  ).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test('watchlist opens and closes with its controls', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const watchlist = page.locator('#watchlist-sidebar');

  await page.locator('#open-watchlist').click();
  await expect(watchlist).toHaveClass(/open/);

  const closeButton = watchlist.locator('button').filter({ has: page.locator('svg') }).first();
  if (await closeButton.count()) {
    await closeButton.click();
    await expect(watchlist).not.toHaveClass(/open/);
  } else {
    // Avoid silently claiming close behavior was tested if no close control is available.
    throw new Error('Could not find a close control inside the watchlist sidebar');
  }
});

