import { chromium, request as playwrightRequest } from '@playwright/test';

const appBaseUrl = process.env.E2E_APP_BASE_URL || 'http://localhost:3100';
const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4100';
const outputPath = process.env.RESULTS_SCREENSHOT_PATH || 'artifacts/results-live-check.png';
const email = `results.visual.${Date.now()}@example.com`;

async function main() {
  const api = await playwrightRequest.newContext();
  await api.post(`${apiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Results Visual QA',
      tenantId: 'tenant-playwright',
      provider: 'google'
    }
  });

  const storageState = await api.storageState();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: appBaseUrl,
    storageState,
    viewport: { width: 2048, height: 1320 }
  });
  const page = await context.newPage();

  await page.goto('/results');
  await page.getByTestId('results-complete-badge').waitFor({ timeout: 20000 });
  await page.screenshot({ path: outputPath, fullPage: true });

  await context.close();
  await browser.close();
  await api.dispose();

  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
