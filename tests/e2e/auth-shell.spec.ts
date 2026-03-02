import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const e2eApiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4100';
const uniqueEmail = (prefix: string) => `${prefix}.${Date.now()}@example.com`;
const fixturePath = (name: string) => resolve(process.cwd(), 'tests', 'fixtures', 'stage4', name);
const bomExamplePath = (name: string) => resolve(process.cwd(), 'docs', 'BOM Examples', name);

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
  await expect(page.getByTestId('upload-view-results-link')).toBeVisible();
  await context.close();
});

test('upload can open results using uploaded revision pair (real file rows)', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.upload.results');
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
  await page.setInputFiles('[data-testid="file-input-a"]', fixturePath('bill-of-materials.xlsx'));
  await page.setInputFiles('[data-testid="file-input-b"]', fixturePath('bill-of-materialsv2.xlsx'));

  await page.getByTestId('queue-upload-btn').click();
  await expect(page.getByTestId('upload-view-results-link')).toBeVisible();
  await page.getByTestId('upload-view-results-link').click();

  await expect(page).toHaveURL(/\/results\?/);
  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('results-grid-table')).toContainText('3023');
  await expect(page.getByTestId('results-grid-table')).toContainText('modified');
  await expect(page.getByTestId('results-grid-table')).toContainText('color');
  await expect(page.getByTestId('results-grid-table')).toContainText('quantity');
  await expect(page.getByTestId('results-grid-table')).toContainText('cost');
  await context.close();
});

test('results load starts a single diff job and does not auto-restart in a loop', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.results.single-start');
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

  let diffStartCount = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/diff-jobs')) {
      diffStartCount += 1;
    }
  });

  await page.goto('/upload');
  await page.setInputFiles('[data-testid="file-input-a"]', fixturePath('bill-of-materials.xlsx'));
  await page.setInputFiles('[data-testid="file-input-b"]', fixturePath('bill-of-materialsv2.xlsx'));

  await page.getByTestId('queue-upload-btn').click();
  await expect(page.getByTestId('upload-view-results-link')).toBeVisible();
  await page.getByTestId('upload-view-results-link').click();

  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1200);
  expect(diffStartCount).toBe(1);

  await context.close();
});

test('stage 7 adapter scenario: SAP same-vs-same yields no-change-dominant without replaced noise', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.s7.sap.same');
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
  await page.setInputFiles('[data-testid="file-input-a"]', bomExamplePath('Example 3 ver 1 SAP.xlsx'));
  await page.setInputFiles('[data-testid="file-input-b"]', bomExamplePath('Example 3 ver 1 SAP.xlsx'));
  await page.getByTestId('queue-upload-btn').click();
  await expect(page.getByTestId('upload-view-results-link')).toBeVisible();
  await page.getByTestId('upload-view-results-link').click();

  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 20000 });
  const noChangeCount = await page.locator('[data-testid="results-grid-table"] .chip-no_change').count();
  const replacedCount = await page.locator('[data-testid="results-grid-table"] .chip-replaced').count();
  expect(noChangeCount).toBeGreaterThan(0);
  expect(replacedCount).toBe(0);

  await context.close();
});

test('stage 7 adapter scenario: SAP version delta surfaces modified changed fields', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.s7.sap.delta');
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
  await page.setInputFiles('[data-testid="file-input-a"]', bomExamplePath('Example 3 ver 1 SAP.xlsx'));
  await page.setInputFiles('[data-testid="file-input-b"]', bomExamplePath('Example 3 ver 2 SAP.xlsx'));
  await page.getByTestId('queue-upload-btn').click();
  await expect(page.getByTestId('upload-view-results-link')).toBeVisible();
  await page.getByTestId('upload-view-results-link').click();

  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('results-change-filter').selectOption('modified');
  await expect(page.getByTestId('results-grid-table')).toContainText('modified');
  const hasPartOrPlantField = await page
    .locator('[data-testid="results-grid-table"]')
    .filter({ hasText: /partNumber|plant/i })
    .count();
  expect(hasPartOrPlantField).toBeGreaterThan(0);

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

test('results page supports tree mode toggle and expand/collapse behavior', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.results.tree');
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
    name: 'tree-a.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'part_number,description,quantity,parentPath,position,level\nROOT,Root Node,1,/root,10,0\nCH-1,Child 1,1,/root/10,20,1\nCH-2,Child 2,1,/root/10,30,1\n'
    )
  });
  await page.setInputFiles('[data-testid="file-input-b"]', {
    name: 'tree-b.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'part_number,description,quantity,parentPath,position,level\nROOT,Root Node,1,/root,10,0\nCH-1,Child 1,2,/root/10,20,1\nCH-2,Child 2,1,/root/10,30,1\n'
    )
  });
  await page.getByTestId('queue-upload-btn').click();
  await expect(page.getByTestId('upload-view-results-link')).toBeVisible();
  await page.getByTestId('upload-view-results-link').click();

  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('results-view-tree-btn').click();
  await expect(page.getByTestId('results-tree-table')).toBeVisible();
  await expect
    .poll(
      async () => page.locator('[data-testid^="tree-toggle-"]').count(),
      { timeout: 10000 }
    )
    .toBeGreaterThan(0);

  const toggleButtons = page.locator('[data-testid^="tree-toggle-"]');
  const toggleCount = await toggleButtons.count();
  expect(toggleCount).toBeGreaterThan(0);

  const beforeCount = await page.locator('[data-testid^="tree-node-"]').count();
  await toggleButtons.first().click();
  await page.waitForTimeout(300);
  const afterCount = await page.locator('[data-testid^="tree-node-"]').count();
  expect(afterCount).toBeGreaterThanOrEqual(beforeCount);

  await page.getByTestId('results-change-filter').selectOption('quantity_change');
  await expect(page.getByTestId('results-tree-table')).toContainText('quantity_change');

  await context.close();
});

test('results page exposes csv/excel export actions bound to comparisonId', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.results.exports');
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
    storageState,
    acceptDownloads: true
  });
  const page = await context.newPage();

  await page.goto('/results');
  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 15000 });

  const csvLink = page.getByTestId('results-export-csv-link');
  const excelLink = page.getByTestId('results-export-excel-link');
  await expect(csvLink).toBeVisible();
  await expect(excelLink).toBeVisible();
  const currentUrl = new URL(page.url());
  const fromQuery = currentUrl.searchParams.get('comparisonId');
  const csvHref = await csvLink.getAttribute('href');
  const fromHref = csvHref?.split('/').pop() || null;
  const comparisonId = fromQuery || fromHref;
  expect(comparisonId).toBeTruthy();
  await expect(csvLink).toHaveAttribute('href', new RegExp(`/api/exports/csv/${comparisonId}$`));
  await expect(excelLink).toHaveAttribute('href', new RegExp(`/api/exports/excel/${comparisonId}$`));

  const [csvDownload] = await Promise.all([page.waitForEvent('download'), csvLink.click()]);
  expect(csvDownload.suggestedFilename().toLowerCase()).toContain('.csv');

  const [excelDownload] = await Promise.all([page.waitForEvent('download'), excelLink.click()]);
  expect(excelDownload.suggestedFilename().toLowerCase()).toContain('.xlsx');

  await context.close();
});

test('results sharing panel supports invite for owner, and invited user can open shared comparison', async ({
  browser,
  request,
  baseURL
}) => {
  const ownerEmail = uniqueEmail('playwright.share.owner');
  const viewerEmail = uniqueEmail('playwright.share.viewer');
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email: ownerEmail,
      displayName: 'Share Owner',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const ownerStorageState = await request.storageState();
  const ownerContext = await browser.newContext({ baseURL, storageState: ownerStorageState });
  const ownerPage = await ownerContext.newPage();

  await ownerPage.goto('/results');
  await expect(ownerPage.getByTestId('results-complete-badge')).toBeVisible({ timeout: 20000 });
  await ownerPage.getByTestId('share-invite-input').fill(viewerEmail);
  await ownerPage.getByTestId('share-invite-btn').click();
  await expect(ownerPage.getByTestId('share-feedback')).toContainText('Invited');
  await expect(ownerPage.getByTestId('share-recipients-table')).toContainText(viewerEmail);

  const comparisonId = new URL(ownerPage.url()).searchParams.get('comparisonId');
  expect(comparisonId).toBeTruthy();

  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email: viewerEmail,
      displayName: 'Share Viewer',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });
  const viewerStorageState = await request.storageState();
  const viewerContext = await browser.newContext({ baseURL, storageState: viewerStorageState });
  const viewerPage = await viewerContext.newPage();
  await viewerPage.goto(`/results?comparisonId=${encodeURIComponent(comparisonId as string)}`);
  await expect(viewerPage.getByTestId('results-grid-table')).toBeVisible({ timeout: 20000 });

  await viewerContext.close();
  await ownerContext.close();
});

test('notifications page shows comparison outcome entries with result links', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.notifications');
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Notification User',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const storageState = await request.storageState();
  const context = await browser.newContext({ baseURL, storageState });
  const page = await context.newPage();

  await page.goto('/results');
  await expect(page.getByTestId('results-complete-badge')).toBeVisible({ timeout: 20000 });
  await page.goto('/notifications');
  await expect(page.getByTestId('notifications-panel')).toBeVisible();
  await expect(page.getByTestId('notifications-table')).toContainText('comparison_completed');
  await expect(page.getByTestId('notifications-table')).toContainText('Open');

  await context.close();
});

test('admin page supports user search and upload policy override/reset for admins', async ({
  browser,
  request,
  baseURL
}) => {
  const adminEmail = uniqueEmail('playwright.admin');
  const targetEmail = uniqueEmail('playwright.policy.target');

  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email: adminEmail,
      displayName: 'Admin User',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });
  await request.post(`${e2eApiBaseUrl}/api/admin/test/grant-role`, {
    data: { userEmail: adminEmail }
  });
  await request.post(`${e2eApiBaseUrl}/api/admin/upload-policy/override`, {
    data: {
      userEmail: targetEmail,
      isUnlimited: false,
      reason: 'seed'
    }
  });

  const adminStorageState = await request.storageState();
  const context = await browser.newContext({ baseURL, storageState: adminStorageState });
  const page = await context.newPage();

  await page.goto('/admin');
  await expect(page.getByTestId('admin-users-table')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('admin-user-search-input').fill(targetEmail);
  await page.getByTestId('admin-user-search-btn').click();
  await expect(page.getByTestId('admin-users-table')).toContainText(targetEmail);
  await page.getByTestId(`admin-toggle-unlimited-${targetEmail}`).click();
  await expect(page.getByTestId('admin-feedback')).toContainText('Enabled unlimited');
  await page.getByTestId(`admin-reset-${targetEmail}`).click();
  await expect(page.getByTestId('admin-feedback')).toContainText('Reset policy');

  await context.close();
});
