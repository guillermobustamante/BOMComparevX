import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext } from '@playwright/test';

const e2eApiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4100';
const uniqueEmail = (prefix: string) => `${prefix}.${Date.now()}@example.com`;

async function loginForResults(
  browser: Browser,
  request: APIRequestContext,
  baseURL: string | undefined,
  prefix: string
): Promise<BrowserContext> {
  const email = uniqueEmail(prefix);
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Playwright Results User',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const storageState = await request.storageState();
  return browser.newContext({
    baseURL,
    storageState,
    viewport: { width: 1440, height: 960 }
  });
}

test('results redesign preserves toolbar tooltips and action dialogs', async ({ browser, request, baseURL }) => {
  const context = await loginForResults(browser, request, baseURL, 'playwright.results.redesign.toolbar');
  const page = await context.newPage();

  await page.goto('/results');
  const shell = page.locator('.missionShellRoot');
  await expect(page.getByTestId('results-panel')).toBeVisible();
  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.getByText('Mission Control')).toHaveCount(0);
  await expect(shell).toHaveAttribute('data-theme', 'light');
  await expect(page.getByTestId('theme-toggle-btn')).toHaveAttribute('title', 'Toggle Theme');

  const uploadButtonBox = await page.getByTestId('results-upload-next-btn').boundingBox();
  const searchInputBox = await page.getByTestId('results-search-input').boundingBox();
  const pageSizeBox = await page.getByTestId('results-page-size-select').boundingBox();
  if (!uploadButtonBox || !searchInputBox || !pageSizeBox) {
    throw new Error('Results toolbar controls did not render with measurable layout boxes');
  }
  expect(uploadButtonBox.y).toBeLessThan(searchInputBox.y);
  expect(Math.abs(searchInputBox.y - pageSizeBox.y)).toBeLessThan(6);

  await page.locator('label[title="Toggle Theme"]').click();
  await expect(shell).toHaveAttribute('data-theme', 'dark');
  await page.locator('label[title="Toggle Theme"]').click();
  await expect(shell).toHaveAttribute('data-theme', 'light');

  await expect(page.getByTestId('results-upload-next-btn')).toHaveAttribute('title', 'Current session is unavailable');
  await expect(page.getByTestId('results-session-history-btn')).toHaveAttribute('title', 'Current session is unavailable');
  await expect(page.getByTestId('results-view-flat-btn')).toHaveAttribute('title', 'Flat view');
  await expect(page.getByTestId('results-view-tree-btn')).toHaveAttribute('title', 'Tree view');
  await expect(page.getByTestId('results-share-btn')).toHaveAttribute('title', 'Share');
  await expect(page.getByTestId('results-export-menu-btn')).toHaveAttribute('title', 'Export');
  await expect(page.getByTestId('results-run-btn')).toHaveAttribute('title', 'Run diff');
  await expect(page.getByTestId('results-page-prev')).toHaveAttribute('title', 'Previous page');
  await expect(page.getByTestId('results-page-next')).toHaveAttribute('title', 'Next page');

  await page.getByTestId('results-export-menu-btn').click();
  const exportDialog = page.getByRole('dialog', { name: 'Download format' });
  await expect(exportDialog).toBeVisible();
  await expect(page.getByTestId('results-export-csv-link')).toBeVisible();
  await expect(page.getByTestId('results-export-excel-link')).toBeVisible();
  await exportDialog.getByRole('button', { name: 'Close export dialog' }).click();

  await page.getByTestId('results-share-btn').click();
  const shareDialog = page.getByTestId('share-panel');
  await expect(shareDialog).toBeVisible();
  await expect(page.getByTestId('share-invite-input')).toBeVisible();
  await shareDialog.getByRole('button', { name: 'Close share dialog' }).click();

  await context.close();
});

test('results redesign keeps filtering, tree toggle, and impact dialog behavior', async ({ browser, request, baseURL }) => {
  const context = await loginForResults(browser, request, baseURL, 'playwright.results.redesign.flow');
  const page = await context.newPage();

  await page.goto('/results');
  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 20000 });

  await page.getByTestId('results-search-input').fill('PN200');
  await expect(page.getByTestId('results-grid-table')).toContainText('PN200');

  await page.getByTestId('results-change-filter').selectOption('quantity_change');
  await expect(page.getByTestId('results-grid-table')).toContainText('quantity_change');

  await page.getByTestId('results-view-tree-btn').click();
  await expect(page.getByTestId('results-tree-table')).toBeVisible();

  await page.getByTestId('results-view-flat-btn').click();
  await expect(page.getByTestId('results-grid-table')).toBeVisible();

  const impactButton = page.locator('button[data-testid^="results-impact-detail-"]:not([disabled])').first();
  await expect(impactButton).toBeVisible();
  await impactButton.click();
  const impactDialog = page.getByTestId('results-impact-dialog');
  await expect(impactDialog).toBeVisible();
  await impactDialog.getByRole('button', { name: 'Close change impact dialog' }).click();

  await context.close();
});
