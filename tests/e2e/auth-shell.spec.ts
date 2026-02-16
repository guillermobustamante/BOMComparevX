import { expect, test } from '@playwright/test';

const e2eApiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4100';
const uniqueEmail = (prefix: string) => `${prefix}.${Date.now()}@example.com`;

test('upload route redirects to login when unauthenticated', async ({ page }) => {
  await page.goto('/upload');
  await expect(page).toHaveURL(/\/login\?returnTo=(%2Fupload|\/upload)$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('login page has provider actions', async ({ page }) => {
  await page.goto('/login?returnTo=/history');

  const googleLink = page.getByRole('link', { name: 'Continue with Google' });
  const microsoftLink = page.getByRole('link', { name: 'Continue with Microsoft' });

  await expect(googleLink).toBeVisible();
  await expect(microsoftLink).toBeVisible();

  await expect(googleLink).toHaveAttribute('href', /\/api\/auth\/google\/start\?returnTo=%2Fhistory$/);
  await expect(microsoftLink).toHaveAttribute('href', /\/api\/auth\/microsoft\/start\?returnTo=%2Fhistory$/);
});

test('unsafe returnTo is sanitized to /upload', async ({ page }) => {
  await page.goto('/login?returnTo=https://malicious.example');

  const googleLink = page.getByRole('link', { name: 'Continue with Google' });
  await expect(googleLink).toHaveAttribute('href', /returnTo=%2Fupload$/);
});

test('authenticated user can load upload shell', async ({ browser, request, baseURL }) => {
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email: 'playwright.user@example.com',
      displayName: 'Playwright User',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const storageState = await request.storageState();
  const context = await browser.newContext({
    baseURL,
    storageState
  });
  const page = await context.newPage();

  await page.goto('/upload');
  await expect(page.getByRole('heading', { name: 'Upload' })).toBeVisible();
  await expect(page.getByText('playwright.user@example.com')).toBeVisible();
  await expect(page.getByText('tenant: tenant-playwright')).toBeVisible();

  await context.close();
});

test('upload validation shows backend rejection for invalid file type', async ({ browser, request, baseURL }) => {
  const email = uniqueEmail('playwright.invalid-type');
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Playwright User',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const storageState = await request.storageState();
  const context = await browser.newContext({
    baseURL,
    storageState
  });
  const page = await context.newPage();

  await page.goto('/upload');
  await page.setInputFiles('[data-testid="file-input-a"]', {
    name: 'bad.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not-valid')
  });
  await page.setInputFiles('[data-testid="file-input-b"]', {
    name: 'good.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('part,qty\nA,1\n')
  });
  await page.getByTestId('validate-upload-btn').click();

  await expect(page.getByTestId('upload-validation-error')).toContainText('UPLOAD_FILE_TYPE_INVALID');
  await context.close();
});

test('upload shows cooldown blocked banner, disables controls, and shows More credits link', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.cooldown');
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Playwright User',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const storageState = await request.storageState();
  const context = await browser.newContext({
    baseURL,
    storageState
  });
  const page = await context.newPage();

  await page.goto('/upload');
  await page.setInputFiles('[data-testid="file-input-a"]', {
    name: 'good-a.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('part,qty\nA,1\n')
  });
  await page.setInputFiles('[data-testid="file-input-b"]', {
    name: 'good-b.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('part,qty\nB,2\n')
  });

  for (let i = 0; i < 3; i += 1) {
    await page.getByTestId('validate-upload-btn').click();
    await expect(page.getByTestId('upload-validation-success')).toBeVisible();
  }

  await page.getByTestId('validate-upload-btn').click();
  await expect(page.getByTestId('upload-policy-blocked-banner')).toBeVisible();
  await expect(page.getByTestId('more-credits-link')).toBeVisible();
  await expect(page.getByTestId('validate-upload-btn')).toBeDisabled();
  await expect(page.getByTestId('file-input-a')).toBeDisabled();
  await expect(page.getByTestId('file-input-b')).toBeDisabled();

  await context.close();
});

test('upload can queue a valid intake and show accepted job feedback', async ({ browser, request, baseURL }) => {
  const email = uniqueEmail('playwright.intake');
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Playwright User',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const storageState = await request.storageState();
  const context = await browser.newContext({
    baseURL,
    storageState
  });
  const page = await context.newPage();

  await page.goto('/upload');
  await page.setInputFiles('[data-testid="file-input-a"]', {
    name: 'good-a.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('part,qty\nA,1\n')
  });
  await page.setInputFiles('[data-testid="file-input-b"]', {
    name: 'good-b.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('part,qty\nB,2\n')
  });
  await page.getByTestId('queue-upload-btn').click();

  await expect(page.getByTestId('upload-intake-success')).toContainText('UPLOAD_ACCEPTED');
  await expect(page.getByTestId('upload-intake-success')).toContainText('Status: accepted');
  await context.close();
});
