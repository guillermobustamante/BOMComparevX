import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { resolve } from 'node:path';

const e2eApiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4100';
const uniqueEmail = (prefix: string) => `${prefix}.${Date.now()}@example.com`;
const fixturePath = (name: string) => resolve(process.cwd(), 'tests', 'fixtures', 'stage4', name);
const bomExamplePath = (name: string) => resolve(process.cwd(), 'docs', 'BOM Examples', name);

async function createResultsSessionChain(request: APIRequestContext, prefix: string) {
  const firstIntakeResponse = await request.post(`${e2eApiBaseUrl}/api/uploads/intake`, {
    multipart: {
      fileA: {
        name: `${prefix}-a.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from('part_number,description,quantity\nBOM-H,Widget H,2\n')
      },
      fileB: {
        name: `${prefix}-b.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from('part_number,description,quantity\nBOM-H,Widget H,3\n')
      }
    }
  });
  expect(firstIntakeResponse.ok()).toBeTruthy();
  const firstIntake = (await firstIntakeResponse.json()) as {
    sessionId: string;
    leftRevisionId: string;
    rightRevisionId: string;
    historyId: string;
  };

  const firstComparisonResponse = await request.post(`${e2eApiBaseUrl}/api/diff-jobs`, {
    data: {
      sessionId: firstIntake.sessionId,
      leftRevisionId: firstIntake.leftRevisionId,
      rightRevisionId: firstIntake.rightRevisionId
    }
  });
  expect(firstComparisonResponse.ok()).toBeTruthy();
  const firstComparison = (await firstComparisonResponse.json()) as { jobId: string };

  const secondIntakeResponse = await request.post(`${e2eApiBaseUrl}/api/uploads/intake`, {
    multipart: {
      sessionId: firstIntake.sessionId,
      fileB: {
        name: `${prefix}-c.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from('part_number,description,quantity\nBOM-H,Widget H,4\n')
      }
    }
  });
  expect(secondIntakeResponse.ok()).toBeTruthy();
  const secondIntake = (await secondIntakeResponse.json()) as {
    sessionId: string;
    leftRevisionId: string;
    rightRevisionId: string;
    historyId: string;
  };

  const secondComparisonResponse = await request.post(`${e2eApiBaseUrl}/api/diff-jobs`, {
    data: {
      sessionId: secondIntake.sessionId,
      leftRevisionId: secondIntake.leftRevisionId,
      rightRevisionId: secondIntake.rightRevisionId
    }
  });
  expect(secondComparisonResponse.ok()).toBeTruthy();
  const secondComparison = (await secondComparisonResponse.json()) as { jobId: string };

  return {
    sessionId: firstIntake.sessionId,
    firstHistoryId: firstIntake.historyId,
    secondHistoryId: secondIntake.historyId,
    firstComparisonId: firstComparison.jobId,
    secondComparisonId: secondComparison.jobId
  };
}

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
  await page.getByTestId('compare-upload-btn').click({ force: true });

  await expect(page.getByTestId('upload-progress-indicator')).toBeVisible();
  await expect(page.getByTestId('upload-view-results-link')).toBeVisible();
  await context.close();
});

test('history page supports rename, tag, and soft-delete actions', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.history');
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
    name: 'history-a.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('part_number,description,quantity\nHX-100,History Item,1\n')
  });
  await page.setInputFiles('[data-testid="file-input-b"]', {
    name: 'history-b.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('part_number,description,quantity\nHX-100,History Item,2\n')
  });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/uploads/intake') &&
        response.request().method() === 'POST' &&
        response.status() === 202
    ),
    page.getByTestId('compare-upload-btn').click({ force: true })
  ]);

  await page.goto('/history');
  await expect(page.getByTestId('history-session-list')).toBeVisible();
  const session = page.locator('details[data-testid^="history-session-"]').first();
  await expect(session).toBeVisible();
  const sessionTestId = await session.getAttribute('data-testid');
  expect(sessionTestId).toBeTruthy();

  await session.locator('summary').click();
  await session.locator('[data-testid^="history-session-name-input-"]').fill('History Smoke');
  await session.locator('[data-testid^="history-session-name-save-"]').click();
  await expect(page.getByTestId('history-feedback')).toContainText('Session title updated.');

  await session.locator('[data-testid^="history-details-open-"]').first().click();
  const detailsDialog = page.getByTestId('history-comparison-details-dialog');
  await expect(detailsDialog).toBeVisible();
  await detailsDialog.locator('input').fill('smoke');
  await detailsDialog.getByRole('button', { name: 'Save label' }).click();
  await expect(page.getByTestId('history-feedback')).toContainText('Private label updated.');
  await detailsDialog.getByRole('button', { name: 'Close comparison details dialog' }).click();

  await session.locator('[data-testid^="history-delete-btn-"]').first().click();
  await expect(page.getByTestId('history-feedback')).toContainText('Latest comparison removed.');
  await expect(page.locator(`details[data-testid="${sessionTestId}"]`)).toHaveCount(0);

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

  await page.getByTestId('compare-upload-btn').click({ force: true });
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

  await page.getByTestId('compare-upload-btn').click({ force: true });
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
  await page.getByTestId('compare-upload-btn').click({ force: true });
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
  await page.getByTestId('compare-upload-btn').click({ force: true });
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
  const tenantId = `tenant-${Date.now()}-preview`;
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Playwright User',
      tenantId,
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
  await expect(page.getByTestId('mapping-row-part-number')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('mapping-preview-panel')).toBeVisible();
  await expect(page.getByTestId('mapping-summary-card-comparison')).toContainText('Ready');
  await expect(page.getByTestId('mapping-row-descriptin')).toBeVisible();
  await expect(page.getByTestId('mapping-row-mystery-header')).toBeVisible();
  const warningAck = page.getByTestId('mapping-warning-ack');
  if (await warningAck.count()) {
    await expect(warningAck).toBeVisible();
    await expect(page.getByTestId('mapping-confirm-btn')).toBeDisabled();
    await warningAck.locator('input[type="checkbox"]').check();
  }
  await expect(page.getByTestId('mapping-confirm-btn')).toBeEnabled();

  await context.close();
});

test('mapping preview allows edits and submits deterministic confirmation payload', async ({
  browser,
  request,
  baseURL
}) => {
  const email = uniqueEmail('playwright.mapping.confirm');
  const tenantId = `tenant-${Date.now()}-confirm`;
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Playwright User',
      tenantId,
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
  await expect(page.getByTestId('mapping-select-mystery-header')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('mapping-select-mystery-header').selectOption('supplier');
  const warningAck = page.getByTestId('mapping-warning-ack');
  if (await warningAck.count()) {
    await warningAck.locator('input[type="checkbox"]').check();
  }
  const confirmResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/mappings/confirm') && response.request().method() === 'POST',
    { timeout: 15000 }
  );
  await page.getByTestId('mapping-confirm-cta').click();
  await confirmResponse;

  await expect(page.getByTestId('mapping-confirm-success')).toContainText('MAPPING_CONFIRM_SUBMITTED', {
    timeout: 15000
  });
  await expect(page.getByTestId('mapping-learned-alias-suggestions')).toContainText('Mystery Header');
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
  await page.getByTestId('compare-upload-btn').click({ force: true });
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

test('history session surface reopens the original comparison id', async ({ browser, request, baseURL }) => {
  const ownerEmail = uniqueEmail('playwright.results.history.owner');
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email: ownerEmail,
      displayName: 'Results History Owner',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const chain = await createResultsSessionChain(request, 'results-history');

  const storageState = await request.storageState();
  const context = await browser.newContext({ baseURL, storageState });
  const ownerPage = await context.newPage();

  await ownerPage.goto('/history');
  await expect(ownerPage.getByTestId('history-session-list')).toBeVisible({ timeout: 20000 });
  const session = ownerPage.locator('details[data-testid^="history-session-"]').first();
  await expect(session).toContainText('results-history-c.csv');
  await session.locator('summary').click();
  await expect(session).toContainText('completed');
  await expect(session).toContainText('results-history-b.csv');
  await expect(session).toContainText('results-history-c.csv');

  await ownerPage.getByTestId(`history-open-results-${chain.firstHistoryId}`).click();
  await expect(ownerPage).toHaveURL(
    new RegExp(`/results\\?comparisonId=${chain.firstComparisonId}(?:&|$)`),
    { timeout: 20000 }
  );
  await expect(ownerPage.getByTestId('results-complete-badge')).toBeVisible({ timeout: 20000 });

  await context.close();
});

test('results session header saves the shared name and restores the active workspace', async ({
  browser,
  request,
  baseURL
}) => {
  const ownerEmail = uniqueEmail('playwright.results.restore.owner');
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email: ownerEmail,
      displayName: 'Results Restore Owner',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const chain = await createResultsSessionChain(request, 'results-restore');
  const storageState = await request.storageState();
  const context = await browser.newContext({ baseURL, storageState });
  const page = await context.newPage();

  await page.goto(`/results?comparisonId=${encodeURIComponent(chain.secondComparisonId)}`);
  await expect(page.getByTestId('results-session-title-bar')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('results-current-comparison-btn')).toBeVisible({ timeout: 20000 });

  await page.getByTestId('results-current-comparison-btn').click();
  await expect(page.getByTestId('results-current-comparison-dialog')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('results-current-comparison-card')).toContainText('results-restore-c.csv');
  await page.getByRole('button', { name: 'Close current file comparison dialog' }).click();

  await page.getByTestId('results-session-name-input').fill('Flight Deck Review');
  await page.getByTestId('results-session-name-input').blur();
  await expect(page.getByTestId('results-session-name-save')).toHaveCount(0, { timeout: 20000 });

  await page.goto('/notifications');
  await expect(page.getByTestId('notifications-active-workspace')).toContainText('Flight Deck Review');

  await page.goto('/results');
  await expect(page).toHaveURL(new RegExp(`/results\\?comparisonId=${chain.secondComparisonId}(?:&|$)`), {
    timeout: 20000
  });
  await expect(page.getByTestId('results-grid-table')).toBeVisible({ timeout: 20000 });

  await context.close();
});

test('results delete-latest rolls back to the previous comparison', async ({ browser, request, baseURL }) => {
  const ownerEmail = uniqueEmail('playwright.results.rollback.owner');
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email: ownerEmail,
      displayName: 'Results Rollback Owner',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const chain = await createResultsSessionChain(request, 'results-rollback');
  const storageState = await request.storageState();
  const context = await browser.newContext({ baseURL, storageState });
  const page = await context.newPage();

  await page.goto(`/results?comparisonId=${encodeURIComponent(chain.secondComparisonId)}`);
  await page.getByTestId('results-session-history-btn').click();
  await expect(page.getByTestId('results-session-history-dialog')).toBeVisible({ timeout: 20000 });
  await page.getByTestId(`results-session-history-delete-${chain.secondHistoryId}`).click();
  await expect(page).toHaveURL(new RegExp(`/results\\?comparisonId=${chain.firstComparisonId}(?:&|$)`), {
    timeout: 20000
  });
  await page.getByTestId('results-session-history-btn').click();
  await expect(page.getByTestId(`results-session-history-delete-${chain.secondHistoryId}`)).toHaveCount(0, {
    timeout: 20000
  });

  await context.close();
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
  await expect(page.getByTestId('notifications-table')).toContainText('Completed');
  await expect(page.getByTestId('notifications-table')).toContainText('Open');
  await expect(page.locator('[data-testid^="notification-link-"]').first()).toBeVisible();

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
  await page.getByTestId('admin-section-toggle-accessRoles').click();
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

test('admin taxonomy editor supports automotive category styling and tag insertion', async ({
  browser,
  request,
  baseURL
}) => {
  const adminEmail = uniqueEmail('playwright.admin.taxonomy');
  const tenantId = `tenant-taxonomy-${Date.now()}`;

  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email: adminEmail,
      displayName: 'Admin Taxonomy User',
      tenantId,
      provider: 'google'
    }
  });
  await request.post(`${e2eApiBaseUrl}/api/admin/test/grant-role`, {
    data: { userEmail: adminEmail }
  });

  const adminStorageState = await request.storageState();
  const context = await browser.newContext({ baseURL, storageState: adminStorageState });
  const page = await context.newPage();

  await page.goto('/admin');
  await page.getByTestId('admin-section-toggle-taxonomyImpacts').click();
  await expect(page.getByTestId('taxonomy-editor')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('taxonomy-working-industry-select').selectOption('Automotive');
  await expect(page.getByTestId('taxonomy-category-title-0')).toHaveValue('Product design or form-fit-function change');
  await expect(page.getByTestId('taxonomy-criticality-badge-0')).toContainText('High Impact');
  await expect(page.getByTestId('taxonomy-panel-content-0')).toBeHidden();

  await page.getByTestId('taxonomy-toggle-0').click();
  await expect(page.getByTestId('taxonomy-panel-content-0')).toBeVisible();
  await page.getByTestId('taxonomy-impact-criticality-0').selectOption('Low');
  await expect(page.getByTestId('taxonomy-criticality-badge-0')).toContainText('Low Impact');

  await page.getByTestId('taxonomy-add-triggerProperties-0').click();
  await page.getByTestId('taxonomy-popover-input-triggerProperties-0').fill('Playwright Trigger Property');
  await page.getByTestId('taxonomy-popover-submit-triggerProperties-0').click();
  await expect(page.locator('.taxonomyCard').first()).toContainText('Playwright Trigger Property');

  await context.close();
});
