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

test('upload drag/drop assigns deterministic slots and validates', async ({ browser, request, baseURL }) => {
  const email = uniqueEmail('playwright.dragdrop');
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
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['part,qty\nA,1\n'], 'drop-a.csv', { type: 'text/csv' }));
    dt.items.add(new File(['part,qty\nB,2\n'], 'drop-b.csv', { type: 'text/csv' }));
    return dt;
  });

  await page.dispatchEvent('[data-testid="upload-dropzone"]', 'drop', { dataTransfer });
  await expect(page.getByText(/File A: drop-a\.csv/)).toBeVisible();
  await expect(page.getByText(/File B: drop-b\.csv/)).toBeVisible();

  await page.getByTestId('validate-upload-btn').click();
  await expect(page.getByTestId('upload-validation-success')).toContainText('UPLOAD_VALIDATED');
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

test('mapping preview shows strategy/confidence and requires warning acknowledgement', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.mapping.preview');
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

  await page.goto('/mappings/rev-s3-preview');
  await expect(page.getByTestId('mapping-preview-panel')).toBeVisible();
  await expect(page.getByTestId('mapping-row-part-number')).toBeVisible();
  await expect(page.getByTestId('mapping-row-descriptin')).toBeVisible();
  await expect(page.getByTestId('mapping-row-mystery-header')).toBeVisible();
  await expect(page.getByTestId('mapping-warning-ack')).toBeVisible();

  await expect(page.getByTestId('mapping-confirm-btn')).toBeDisabled();
  await page.getByTestId('mapping-warning-ack').locator('input[type="checkbox"]').check();
  await expect(page.getByTestId('mapping-confirm-btn')).toBeEnabled();

  await context.close();
});

test('mapping preview allows edits and submits deterministic confirmation payload', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.mapping.confirm');
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

  await page.goto('/mappings/rev-s3-preview');
  await page.getByTestId('mapping-select-mystery-header').selectOption('supplier');
  await page.getByTestId('mapping-warning-ack').locator('input[type="checkbox"]').check();
  await page.getByTestId('mapping-confirm-btn').click();

  await expect(page.getByTestId('mapping-confirm-success')).toContainText('MAPPING_CONFIRM_SUBMITTED');
  await context.close();
});

test('results page streams partial-to-final diff rows with rationale metadata', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.results.stream');
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

  await page.goto('/results');
  await expect(page.getByTestId('results-panel')).toBeVisible();
  await expect(page.getByTestId('results-grid-table')).toBeVisible();
  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="results-grid-table"] .chip-quantity_change').first()).toBeVisible();
  await expect(page.getByText('matched_quantity_change')).toBeVisible();

  await context.close();
});

test('results page supports search/sort/filter/change-type controls', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.results.filters');
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

  await page.goto('/results');
  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 15000 });

  await page.getByTestId('results-search-input').fill('PN200');
  await expect(page.getByTestId('results-grid-table')).toContainText('PN200');

  await page.getByTestId('results-change-filter').selectOption('quantity_change');
  await expect(page.getByTestId('results-grid-table')).toContainText('quantity_change');

  await page.getByTestId('results-part-filter-input').fill('PN300');
  await expect(page.getByTestId('results-grid-table')).not.toContainText('PN200');

  await page.getByTestId('results-sort-select').selectOption('change');
  await expect(page.getByTestId('results-grid-table')).toBeVisible();

  await context.close();
});
