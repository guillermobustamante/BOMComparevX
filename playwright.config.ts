import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: [
    {
      command:
        'npm --prefix apps/backend run start:test',
      port: 4000,
      reuseExistingServer: true,
      timeout: 120000
    },
    {
      command:
        'npm --prefix apps/frontend run dev',
      port: 3000,
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000'
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
