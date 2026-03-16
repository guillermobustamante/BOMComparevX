import { test, expect } from '@playwright/test';

const e2eApiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4100';
const uniqueEmail = () => `playwright.results.capture.${Date.now()}@example.com`;

test('capture results page screenshot for visual QA', async ({ browser, request, baseURL }) => {
  const email = uniqueEmail();
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Playwright Results Capture',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const storageState = await request.storageState();
  const context = await browser.newContext({
    baseURL,
    storageState,
    viewport: { width: 2048, height: 1320 }
  });
  const page = await context.newPage();

  await page.goto('/results');
  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: 'artifacts/results-visual-capture.png', fullPage: true });

  await context.close();
});
