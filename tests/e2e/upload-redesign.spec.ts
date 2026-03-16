import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext } from '@playwright/test';

const e2eApiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4100';
const uniqueEmail = (prefix: string) => `${prefix}.${Date.now()}@example.com`;

async function loginForUpload(
  browser: Browser,
  request: APIRequestContext,
  baseURL: string | undefined,
  prefix: string
): Promise<{ context: BrowserContext; email: string }> {
  const email = uniqueEmail(prefix);
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Playwright Upload User',
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

test('upload redesign keeps deterministic master dropzone mapping', async ({
  browser,
  request,
  baseURL
}) => {
  const { context } = await loginForUpload(browser, request, baseURL, 'playwright.upload.masterdrop');
  const page = await context.newPage();

  await page.goto('/upload');
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['part,qty\nA,1\n'], 'drop-a.csv', { type: 'text/csv' }));
    dt.items.add(new File(['part,qty\nB,2\n'], 'drop-b.csv', { type: 'text/csv' }));
    return dt;
  });

  await page.dispatchEvent('[data-testid="upload-dropzone"]', 'drop', { dataTransfer });

  await expect(page.getByTestId('upload-source-a')).toContainText('drop-a.csv');
  await expect(page.getByTestId('upload-source-b')).toContainText('drop-b.csv');
  await expect(page.getByTestId('upload-status-a')).toContainText('Ready for comparison');
  await expect(page.getByTestId('upload-status-b')).toContainText('Ready for comparison');
  await expect(page.getByTestId('compare-upload-btn')).toBeEnabled();

  await context.close();
});

test('upload redesign supports drag and drop directly onto Revision A and Revision B cards', async ({
  browser,
  request,
  baseURL
}) => {
  const { context } = await loginForUpload(browser, request, baseURL, 'playwright.upload.carddrop');
  const page = await context.newPage();

  await page.goto('/upload');

  const dataTransferA = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['part,qty\nA,1\n'], 'card-a.csv', { type: 'text/csv' }));
    return dt;
  });
  await page.dispatchEvent('[data-testid="upload-card-a"]', 'drop', { dataTransfer: dataTransferA });

  await expect(page.getByTestId('upload-source-a')).toContainText('card-a.csv');
  await expect(page.getByTestId('upload-source-b')).toContainText('Drag file here or select');
  await expect(page.getByTestId('upload-status-a')).toContainText('Ready for comparison');
  await expect(page.getByTestId('upload-status-b')).toContainText('Waiting for source');

  const dataTransferB = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['part,qty\nB,2\n'], 'card-b.csv', { type: 'text/csv' }));
    return dt;
  });
  await page.dispatchEvent('[data-testid="upload-card-b"]', 'drop', { dataTransfer: dataTransferB });

  await expect(page.getByTestId('upload-source-b')).toContainText('card-b.csv');
  await expect(page.getByTestId('upload-status-b')).toContainText('Ready for comparison');
  await expect(page.getByTestId('compare-upload-btn')).toBeEnabled();

  await context.close();
});
