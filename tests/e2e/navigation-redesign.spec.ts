import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext } from '@playwright/test';

const e2eApiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4100';
const uniqueEmail = (prefix: string) => `${prefix}.${Date.now()}@example.com`;

async function loginForShell(
  browser: Browser,
  request: APIRequestContext,
  baseURL: string | undefined,
  prefix: string
): Promise<{ context: BrowserContext; email: string }> {
  const email = uniqueEmail(prefix);
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Playwright Nav User',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const storageState = await request.storageState();
  const context = await browser.newContext({
    baseURL,
    storageState
  });
  return { context, email };
}

test('navigation redesign preserves tooltips, collapse behavior, and theme toggle', async ({
  browser,
  request,
  baseURL
}) => {
  const { context, email } = await loginForShell(browser, request, baseURL, 'playwright.nav.tooltips');
  const page = await context.newPage();

  await page.goto('/upload');
  const shell = page.locator('.missionShellRoot');
  await expect(shell).toHaveAttribute('data-nav', 'expanded');
  await expect(shell).toHaveAttribute('data-theme', 'light');

  await expect(page.getByTestId('nav-toggle-btn')).toHaveAttribute('title', 'Collapse navigation');
  await expect(page.getByTestId('nav-link-compare')).toHaveAttribute('title', 'Compare: Revision intake');
  await expect(page.getByTestId('nav-link-mapping')).toHaveAttribute('title', 'Mapping: Governance and review');
  await expect(page.getByTestId('nav-link-results')).toHaveAttribute('title', 'Results: Diff workspace');
  await expect(page.getByTestId('theme-toggle-switch')).toHaveAttribute('title', 'Toggle Theme');
  await expect(page.getByTestId('theme-toggle-btn')).toHaveAttribute('title', 'Toggle Theme');
  await expect(page.getByTestId('nav-profile-toggle')).toHaveAttribute('title', email);
  await expect(page.getByTestId('nav-profile-menu')).toHaveCount(0);

  await page.getByTestId('theme-toggle-btn').click();
  await expect(shell).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-toggle-btn').click();
  await expect(shell).toHaveAttribute('data-theme', 'light');

  await page.getByTestId('nav-profile-toggle').click();
  await expect(page.getByTestId('nav-profile-menu')).toBeVisible();
  await expect(page.getByTestId('nav-switch-account-link')).toHaveAttribute('href', '/login');
  await page.getByTestId('nav-profile-toggle').click();
  await expect(page.getByTestId('nav-profile-menu')).toHaveCount(0);

  await page.getByTestId('nav-toggle-btn').click();
  await expect(shell).toHaveAttribute('data-nav', 'collapsed');
  await expect(page.getByTestId('nav-toggle-btn')).toHaveAttribute('title', 'Expand navigation');

  await page.getByTestId('nav-toggle-btn').click();
  await expect(shell).toHaveAttribute('data-nav', 'expanded');

  await context.close();
});

test('navigation redesign keeps route wiring working across shell links', async ({
  browser,
  request,
  baseURL
}) => {
  const { context } = await loginForShell(browser, request, baseURL, 'playwright.nav.routing');
  const page = await context.newPage();

  await page.goto('/upload');
  await page.getByTestId('nav-link-history').click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();

  await page.getByTestId('nav-link-results').click();
  await expect(page).toHaveURL(/\/results/);
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();

  await page.getByTestId('nav-link-compare').click();
  await expect(page).toHaveURL(/\/upload$/);
  await expect(page.getByRole('heading', { name: 'Compare BOMs' })).toBeVisible();

  await context.close();
});
