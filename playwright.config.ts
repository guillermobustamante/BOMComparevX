import { defineConfig, devices } from '@playwright/test';

process.env.E2E_API_BASE_URL = process.env.E2E_API_BASE_URL || 'http://localhost:4100';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: [
    {
      command:
        'npm --prefix apps/backend run start:test:e2e',
      port: 4100,
      reuseExistingServer: false,
      timeout: 120000
    },
    {
      command:
        'npm --prefix apps/frontend run start:e2e',
      port: 3100,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4100'
      }
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
